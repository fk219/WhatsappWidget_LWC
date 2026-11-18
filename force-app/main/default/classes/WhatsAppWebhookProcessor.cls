/**
 * Parses staged Meta webhook events into profiles, conversations, messages,
 * status history, media placeholders, and platform events.
 *
 * Runs asynchronously from WhatsAppWebhookProcessQueueable. All writes are
 * idempotent through external IDs / dedupe keys.
 */
public without sharing class WhatsAppWebhookProcessor {
  private static final Integer MAX_BODY = 131072;
  private static final Integer MAX_JSON = 32768;

  public static void process(Id eventId) {
    if (eventId == null) {
      return;
    }
    List<WhatsApp_Webhook_Event__c> events = [
      SELECT
        Id,
        Payload__c,
        Status__c,
        Attempts__c,
        Phone_Number_Id__c,
        WABA_Id__c
      FROM WhatsApp_Webhook_Event__c
      WHERE Id = :eventId
      LIMIT 1
    ];
    if (events.isEmpty()) {
      return;
    }
    WhatsApp_Webhook_Event__c event = events[0];
    if (event.Status__c == 'Processed' || event.Status__c == 'Ignored') {
      return;
    }

    event.Status__c = 'Processing';
    event.Attempts__c = (event.Attempts__c == null ? 0 : event.Attempts__c) + 1;
    update event;

    try {
      if (String.isBlank(event.Payload__c)) {
        event.Status__c = 'Ignored';
        event.Processed_At__c = Datetime.now();
        update event;
        return;
      }

      Map<String, Object> value = asMap(
        JSON.deserializeUntyped(event.Payload__c)
      );
      Map<String, Object> metadata = asMap(value.get('metadata'));
      String phoneNumberId = (String) metadata.get('phone_number_id');
      if (String.isBlank(phoneNumberId)) {
        phoneNumberId = event.Phone_Number_Id__c;
      }
      String displayPhone = (String) metadata.get('display_phone_number');
      WhatsApp_Account__c account = WhatsAppAccountService.getOrCreate(
        phoneNumberId,
        event.WABA_Id__c,
        displayPhone
      );

      if (value.containsKey('messages')) {
        processMessages(value, account);
      } else if (value.containsKey('statuses')) {
        processStatuses(value, account);
      } else {
        event.Status__c = 'Ignored';
        event.Processed_At__c = Datetime.now();
        update event;
        return;
      }

      event.Status__c = 'Processed';
      event.Error__c = null;
      event.Processed_At__c = Datetime.now();
      update event;
    } catch (Exception e) {
      event.Status__c = 'Failed';
      event.Error__c = truncate(
        e.getMessage() + '\n' + e.getStackTraceString(),
        MAX_JSON
      );
      event.Processed_At__c = Datetime.now();
      update event;
    }
  }

  private static void processMessages(
    Map<String, Object> value,
    WhatsApp_Account__c account
  ) {
    List<Object> messages = asList(value.get('messages'));
    List<Object> contacts = asList(value.get('contacts'));

    String contactName;
    String contactWaId;
    String contactBsuid;
    if (!contacts.isEmpty()) {
      Map<String, Object> contact = asMap(contacts[0]);
      contactWaId = (String) contact.get('wa_id');
      contactBsuid = (String) contact.get('user_id');
      contactName = (String) asMap(contact.get('profile')).get('name');
    }

    for (Object item : messages) {
      Map<String, Object> messageJson = asMap(item);
      String senderWaId = (String) messageJson.get('from');
      String fromUserId = (String) messageJson.get('from_user_id');
      String waId = String.isNotBlank(senderWaId) ? senderWaId : contactWaId;
      String bsuid = String.isNotBlank(fromUserId) ? fromUserId : contactBsuid;
      if (String.isBlank(waId) && String.isBlank(bsuid)) {
        continue;
      }

      String identityKey = String.isNotBlank(waId)
        ? 'wa:' + waId
        : 'bsuid:' + bsuid;
      String phone = String.isNotBlank(waId)
        ? '+' + waId.replaceAll('[^0-9]', '')
        : null;
      String wamid = (String) messageJson.get('id');
      if (String.isBlank(wamid)) {
        continue;
      }

      WhatsApp_Profile__c profile = WhatsAppProfileService.upsertInbound(
        account.Id,
        identityKey,
        waId,
        bsuid,
        contactName,
        phone,
        'Inbound'
      );

      Id parentId;
      String parentObject;
      if (String.isNotBlank(profile.Parent_Record_Id__c)) {
        try {
          parentId = Id.valueOf(profile.Parent_Record_Id__c);
          parentObject = profile.Parent_Object_API_Name__c;
        } catch (Exception e) {
          parentId = null;
        }
      }
      if (parentId == null) {
        parentId = WhatsAppPhoneMatcher.findOrCreateParent(
          phone,
          bsuid,
          contactName
        );
        if (parentId != null) {
          parentObject = parentId.getSObjectType().getDescribe().getName();
          WhatsAppProfileService.linkToRecord(
            profile.Id,
            parentId,
            parentObject
          );
        }
      }

      Id ownerId = getOwnerId(parentId);
      Datetime sentAt = parseTimestamp((String) messageJson.get('timestamp'));
      String originalType = (String) messageJson.get('type');
      String type = normalizeType(originalType);
      String body = extractBody(messageJson, originalType);
      String caption = extractCaption(messageJson, originalType);
      String mediaId = extractMediaId(messageJson, originalType);
      String mimeType = extractMimeType(messageJson, originalType);
      String fileName = extractFileName(messageJson, originalType);
      String contextWamid = extractContextWamid(messageJson);
      Map<String, Object> reaction = asMap(messageJson.get('reaction'));

      WhatsApp_Conversation__c conversation = WhatsAppConversationService.findOrCreate(
        account.Id,
        profile.Id,
        identityKey,
        parentId,
        parentObject,
        ownerId,
        sentAt,
        String.isNotBlank(body) ? body : type
      );

      WhatsApp_Message__c message = new WhatsApp_Message__c(
        WAMID__c = wamid,
        Conversation__c = conversation.Id,
        Account__c = account.Id,
        Direction__c = WhatsAppConstants.DIRECTION_INBOUND,
        Sender_Type__c = 'Customer',
        From_Number__c = phone,
        To_Number__c = account.Display_Phone_Number__c,
        Type__c = type,
        Body__c = truncate(body, MAX_BODY),
        Caption__c = truncate(caption, 1024),
        Reply_To_WAMID__c = contextWamid,
        Context_JSON__c = jsonOf(messageJson.get('context')),
        Interactive_JSON__c = jsonOf(messageJson.get('interactive')),
        Location_JSON__c = jsonOf(messageJson.get('location')),
        Contacts_JSON__c = jsonOf(messageJson.get('contacts')),
        Reaction_Emoji__c = (String) reaction.get('emoji'),
        Reaction_Target_WAMID__c = (String) reaction.get('message_id'),
        Status__c = WhatsAppConstants.STATUS_RECEIVED,
        Status_Updated_At__c = sentAt,
        Sent_At__c = sentAt,
        Provider__c = WhatsAppConstants.PROVIDER_META,
        Source__c = 'Webhook'
      );
      insert message;

      if (String.isNotBlank(mediaId)) {
        WhatsApp_Media__c media = new WhatsApp_Media__c(
          Meta_Media_Id__c = mediaId,
          Message__c = message.Id,
          Direction__c = WhatsAppConstants.DIRECTION_INBOUND,
          Mime_Type__c = mimeType,
          File_Name__c = fileName,
          Download_Status__c = 'Pending',
          Expires_At__c = sentAt.addDays(7)
        );
        insert media;
        message.Media_Id__c = media.Id;
        update message;
      }

      WhatsAppConversationService.incrementCounts(conversation.Id, 1, 1);
      WhatsAppEventService.publish(
        WhatsAppConstants.EVENT_TYPE_MESSAGE,
        message.Id,
        conversation.Id,
        parentId,
        message.Status__c,
        1
      );
    }
  }

  private static void processStatuses(
    Map<String, Object> value,
    WhatsApp_Account__c account
  ) {
    List<Object> statuses = asList(value.get('statuses'));
    for (Object item : statuses) {
      Map<String, Object> statusJson = asMap(item);
      String wamid = (String) statusJson.get('id');
      String rawStatus = (String) statusJson.get('status');
      if (String.isBlank(wamid) || String.isBlank(rawStatus)) {
        continue;
      }
      List<WhatsApp_Message__c> messages = [
        SELECT
          Id,
          Conversation__c,
          Status__c,
          Delivered_At__c,
          Read_At__c,
          Failed_At__c
        FROM WhatsApp_Message__c
        WHERE WAMID__c = :wamid
        LIMIT 1
      ];
      if (messages.isEmpty()) {
        continue;
      }

      WhatsApp_Message__c message = messages[0];
      String normalizedStatus = normalizeStatus(rawStatus);
      String timestamp = (String) statusJson.get('timestamp');
      Datetime statusAt = parseTimestamp(timestamp);
      String dedupeKey =
        String.valueOf(message.Id) +
        ':' +
        normalizedStatus +
        ':' +
        (String.isBlank(timestamp)
          ? String.valueOf(statusAt.getTime())
          : timestamp);

      WhatsApp_Message_Status__c history = new WhatsApp_Message_Status__c(
        Message__c = message.Id,
        Status__c = normalizedStatus,
        Timestamp__c = statusAt,
        Recipient_Id__c = (String) statusJson.get('recipient_id'),
        Dedupe_Key__c = dedupeKey,
        Raw_JSON__c = jsonOf(statusJson)
      );

      Map<String, Object> pricing = asMap(statusJson.get('pricing'));
      if (!pricing.isEmpty()) {
        history.Pricing_Category__c = (String) pricing.get('category');
        history.Pricing_Type__c = (String) pricing.get('type');
        history.Pricing_Billable__c = (Boolean) pricing.get('billable');
      }

      List<Object> errors = asList(statusJson.get('errors'));
      if (!errors.isEmpty()) {
        Map<String, Object> error = asMap(errors[0]);
        history.Error_Code__c = stringValue(error.get('code'));
        history.Error_Message__c = truncate(
          (String) error.get('message'),
          MAX_JSON
        );
      }

      Database.insert(history, false);

      if (shouldAdvance(message.Status__c, normalizedStatus)) {
        message.Status__c = normalizedStatus;
        message.Status_Updated_At__c = statusAt;
        if (normalizedStatus == 'Delivered') {
          message.Delivered_At__c = statusAt;
        } else if (normalizedStatus == 'Read') {
          message.Read_At__c = statusAt;
        } else if (normalizedStatus == 'Failed') {
          message.Failed_At__c = statusAt;
          message.Error_Code__c = history.Error_Code__c;
          message.Error_Message__c = history.Error_Message__c;
        }
        message.Pricing_Category__c = history.Pricing_Category__c;
        message.Pricing_Type__c = history.Pricing_Type__c;
        message.Pricing_Billable__c = history.Pricing_Billable__c;
        message.Pricing_Model__c = (String) pricing.get('pricing_model');
        update message;
      }

      WhatsAppEventService.publish(
        WhatsAppConstants.EVENT_TYPE_STATUS,
        message.Id,
        message.Conversation__c,
        null,
        message.Status__c,
        null
      );
    }
  }

  private static Id getOwnerId(Id recordId) {
    if (recordId == null) {
      return null;
    }
    try {
      String objectName = recordId.getSObjectType().getDescribe().getName();
      List<SObject> rows = Database.queryWithBinds(
        'SELECT OwnerId FROM ' + objectName + ' WHERE Id = :recordId LIMIT 1',
        new Map<String, Object>{ 'recordId' => recordId },
        AccessLevel.SYSTEM_MODE
      );
      if (rows.isEmpty()) {
        return null;
      }
      Id ownerId = (Id) rows[0].get('OwnerId');
      // Assigned_User__c is a User lookup; queue IDs go in Assigned_Queue_Id__c later.
      return String.valueOf(ownerId).startsWith('005') ? ownerId : null;
    } catch (Exception e) {
      return null;
    }
  }

  private static String extractBody(Map<String, Object> message, String type) {
    if (type == 'text') {
      return (String) asMap(message.get('text')).get('body');
    }
    if (
      type == 'image' ||
      type == 'video' ||
      type == 'document' ||
      type == 'audio' ||
      type == 'sticker'
    ) {
      return (String) asMap(message.get(type)).get('caption');
    }
    if (type == 'location') {
      Map<String, Object> location = asMap(message.get('location'));
      return joinNonBlank(
        new List<String>{
          (String) location.get('name'),
          (String) location.get('address')
        }
      );
    }
    if (type == 'contacts') {
      return 'Contact card';
    }
    if (type == 'interactive') {
      Map<String, Object> interactive = asMap(message.get('interactive'));
      String interactiveType = (String) interactive.get('type');
      if (interactiveType == 'button_reply') {
        return (String) asMap(interactive.get('button_reply')).get('title');
      }
      if (interactiveType == 'list_reply') {
        return (String) asMap(interactive.get('list_reply')).get('title');
      }
      if (interactiveType == 'nfm_reply') {
        String body = (String) asMap(interactive.get('nfm_reply')).get('body');
        return String.isBlank(body) ? 'Flow response' : body;
      }
      return interactiveType;
    }
    if (type == 'button') {
      return (String) asMap(message.get('button')).get('text');
    }
    if (type == 'reaction') {
      return (String) asMap(message.get('reaction')).get('emoji');
    }
    if (type == 'system') {
      return (String) asMap(message.get('system')).get('body');
    }
    if (type == 'template') {
      return (String) asMap(message.get('template')).get('name');
    }
    return 'Unsupported message type';
  }

  private static String extractCaption(
    Map<String, Object> message,
    String type
  ) {
    if (type == 'image' || type == 'video' || type == 'document') {
      return (String) asMap(message.get(type)).get('caption');
    }
    return null;
  }

  private static String extractMediaId(
    Map<String, Object> message,
    String type
  ) {
    if (
      type == 'image' ||
      type == 'video' ||
      type == 'document' ||
      type == 'audio' ||
      type == 'sticker'
    ) {
      return (String) asMap(message.get(type)).get('id');
    }
    return null;
  }

  private static String extractMimeType(
    Map<String, Object> message,
    String type
  ) {
    if (
      type == 'image' ||
      type == 'video' ||
      type == 'document' ||
      type == 'audio' ||
      type == 'sticker'
    ) {
      return (String) asMap(message.get(type)).get('mime_type');
    }
    return null;
  }

  private static String extractFileName(
    Map<String, Object> message,
    String type
  ) {
    if (type == 'document') {
      return (String) asMap(message.get('document')).get('filename');
    }
    return null;
  }

  private static String extractContextWamid(Map<String, Object> message) {
    return (String) asMap(message.get('context')).get('id');
  }

  private static String normalizeType(String type) {
    if (String.isBlank(type)) {
      return 'unsupported';
    }
    if (type == 'button' || type == 'list' || type == 'flow') {
      return 'interactive';
    }
    Set<String> supported = new Set<String>{
      'text',
      'image',
      'audio',
      'video',
      'document',
      'sticker',
      'location',
      'contacts',
      'interactive',
      'template',
      'reaction',
      'system',
      'unsupported',
      'order',
      'address'
    };
    return supported.contains(type) ? type : 'unsupported';
  }

  private static String normalizeStatus(String status) {
    if (String.isBlank(status)) {
      return 'Sent';
    }
    String lower = status.toLowerCase();
    if (lower == 'queued')
      return 'Queued';
    if (lower == 'sending')
      return 'Sending';
    if (lower == 'sent')
      return 'Sent';
    if (lower == 'delivered')
      return 'Delivered';
    if (lower == 'read')
      return 'Read';
    if (lower == 'failed')
      return 'Failed';
    if (lower == 'deleted')
      return 'Deleted';
    if (lower == 'received')
      return 'Received';
    return 'Sent';
  }

  private static Boolean shouldAdvance(String currentStatus, String newStatus) {
    if (newStatus == 'Failed' || newStatus == 'Deleted') {
      return true;
    }
    if (currentStatus == 'Failed' || currentStatus == 'Deleted') {
      return false;
    }
    return statusRank(newStatus) > statusRank(currentStatus);
  }

  private static Integer statusRank(String status) {
    if (status == 'Queued')
      return 1;
    if (status == 'Sending')
      return 2;
    if (status == 'Sent')
      return 3;
    if (status == 'Delivered')
      return 4;
    if (status == 'Read')
      return 5;
    return 0;
  }

  private static Datetime parseTimestamp(String value) {
    if (String.isBlank(value)) {
      return Datetime.now();
    }
    try {
      return Datetime.newInstance(Long.valueOf(value) * 1000);
    } catch (Exception e) {
      return Datetime.now();
    }
  }

  private static String joinNonBlank(List<String> values) {
    String result = '';
    for (String value : values) {
      if (String.isNotBlank(value)) {
        result += String.isBlank(result) ? value : ' ' + value;
      }
    }
    return result;
  }

  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<String, Object>
      ? (Map<String, Object>) value
      : new Map<String, Object>();
  }

  private static List<Object> asList(Object value) {
    return value instanceof List<Object>
      ? (List<Object>) value
      : new List<Object>();
  }

  private static String jsonOf(Object value) {
    if (value == null) {
      return null;
    }
    try {
      return truncate(JSON.serialize(value), MAX_JSON);
    } catch (Exception e) {
      return null;
    }
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static String truncate(String value, Integer maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }
}
