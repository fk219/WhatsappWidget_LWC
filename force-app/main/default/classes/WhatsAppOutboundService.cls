/**
 * Agent-initiated outbound WhatsApp messages.
 *
 * v1 supports free-form text inside an open 24-hour service window. Templates,
 * media, interactive messages, and bulk sends build on the same queue.
 */
public with sharing class WhatsAppOutboundService {
  @AuraEnabled
  public static Map<String, String> sendText(
    Id recordId,
    String objectApiName,
    String message
  ) {
    if (recordId == null) {
      throw new AuraHandledException('A record is required.');
    }
    if (String.isBlank(message)) {
      throw new AuraHandledException('A message is required.');
    }
    if (message.length() > WhatsAppConstants.MAX_TEXT_LENGTH) {
      throw new AuraHandledException(
        'WhatsApp text messages are limited to 4,096 characters.'
      );
    }

    String objectName = String.isBlank(objectApiName)
      ? recordId.getSObjectType().getDescribe().getName()
      : objectApiName;

    Map<String, String> mapping = resolveMapping(objectName);
    String phoneField = mapping.get('phoneField');
    String countryCodeField = mapping.get('countryCodeField');

    String query = 'SELECT Id, OwnerId, ' + phoneField;
    if (String.isNotBlank(countryCodeField)) {
      query += ', ' + countryCodeField;
    }
    query += ' FROM ' + objectName + ' WHERE Id = :recordId LIMIT 1';

    List<SObject> records;
    try {
      records = Database.queryWithBinds(
        query,
        new Map<String, Object>{ 'recordId' => recordId },
        AccessLevel.USER_MODE
      );
    } catch (Exception e) {
      throw new AuraHandledException(
        'You do not have access to this record or its phone field.'
      );
    }
    if (records.isEmpty()) {
      throw new AuraHandledException('Record not found.');
    }

    SObject record = records[0];
    String rawPhone = (String) record.get(phoneField);
    String countryCode = String.isNotBlank(countryCodeField)
      ? (String) record.get(countryCodeField)
      : null;
    if (String.isBlank(rawPhone)) {
      throw new AuraHandledException(
        'This record has no WhatsApp phone number.'
      );
    }
    String phone = normalizePhone(rawPhone, countryCode);
    String digits = phone.replace('+', '');

    WhatsApp_Consent__c consent = findConsent(phone, digits);
    if (
      consent != null &&
      consent.Opt_In_Status__c == WhatsAppConstants.CONSENT_OPTED_OUT
    ) {
      throw new AuraHandledException(
        'This customer has opted out of WhatsApp messages.'
      );
    }

    WhatsApp_Account__c account = WhatsAppAccountService.getDefault();
    WhatsApp_Profile__c profile = findOrCreateProfile(
      account.Id,
      digits,
      phone
    );
    Id ownerId = (Id) record.get('OwnerId');
    if (ownerId != null && !String.valueOf(ownerId).startsWith('005')) {
      ownerId = null;
    }

    WhatsApp_Conversation__c conversation = WhatsAppConversationService.findOrCreate(
      account.Id,
      profile.Id,
      profile.Identity_Key__c,
      recordId,
      objectName,
      ownerId,
      null,
      message
    );

    if (
      conversation.Window_Expires_At__c == null ||
      conversation.Window_Expires_At__c <= Datetime.now()
    ) {
      throw new AuraHandledException(
        'The 24-hour customer service window is closed. Send an approved template to re-engage.'
      );
    }

    String idempotencyKey =
      String.valueOf(recordId) +
      '-' +
      String.valueOf(Datetime.now().getTime()) +
      '-' +
      String.valueOf(Math.abs(Crypto.getRandomInteger()));

    WhatsApp_Message__c outbound = new WhatsApp_Message__c(
      WAMID__c = 'PENDING-' + idempotencyKey,
      Conversation__c = conversation.Id,
      Account__c = account.Id,
      Direction__c = WhatsAppConstants.DIRECTION_OUTBOUND,
      Sender_Type__c = 'Agent',
      Sent_By__c = UserInfo.getUserId(),
      From_Number__c = account.Display_Phone_Number__c,
      To_Number__c = phone,
      Type__c = WhatsAppConstants.MESSAGE_TYPE_TEXT,
      Body__c = message,
      Status__c = WhatsAppConstants.STATUS_QUEUED,
      Status_Updated_At__c = Datetime.now(),
      Sent_At__c = Datetime.now(),
      Provider__c = WhatsAppConstants.PROVIDER_META,
      Source__c = 'LWC'
    );
    insert outbound;

    WhatsApp_Outbound_Queue__c queue = new WhatsApp_Outbound_Queue__c(
      Message__c = outbound.Id,
      Status__c = 'Queued',
      Attempts__c = 0,
      Priority__c = 1,
      Idempotency_Key__c = idempotencyKey,
      Created_At__c = Datetime.now()
    );
    insert queue;

    System.enqueueJob(new WhatsAppOutboundQueueable(queue.Id));
    WhatsAppEventService.publish(
      WhatsAppConstants.EVENT_TYPE_MESSAGE,
      outbound.Id,
      conversation.Id,
      recordId,
      outbound.Status__c,
      null
    );

    return new Map<String, String>{
      'messageId' => outbound.Id,
      'status' => outbound.Status__c
    };
  }

  private static Map<String, String> resolveMapping(String objectName) {
    List<WhatsApp_Object_Mapping__c> mappings = [
      SELECT Object_API_Name__c, Phone_Field__c, Country_Code_Field__c
      FROM WhatsApp_Object_Mapping__c
      WHERE Object_API_Name__c = :objectName AND Is_Active__c = TRUE
      ORDER BY Priority__c ASC
      LIMIT 1
    ];
    if (!mappings.isEmpty()) {
      String validatedField = validateField(
        objectName,
        mappings[0].Phone_Field__c
      );
      String validatedCountryField = validateField(
        objectName,
        mappings[0].Country_Code_Field__c
      );
      if (String.isNotBlank(validatedField)) {
        return new Map<String, String>{
          'phoneField' => validatedField,
          'countryCodeField' => validatedCountryField
        };
      }
    }

    String fallback = validateField(objectName, 'Phone');
    if (
      String.isBlank(fallback) &&
      (objectName == 'Lead' ||
      objectName == 'Contact')
    ) {
      fallback = validateField(objectName, 'MobilePhone');
    }
    if (String.isBlank(fallback)) {
      throw new AuraHandledException(
        'No WhatsApp phone field is configured for ' + objectName + '.'
      );
    }
    return new Map<String, String>{
      'phoneField' => fallback,
      'countryCodeField' => null
    };
  }

  private static String validateField(String objectName, String fieldName) {
    if (String.isBlank(fieldName)) {
      return null;
    }
    SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
    if (objectType == null) {
      return null;
    }
    SObjectField field = objectType.getDescribe()
      .fields.getMap()
      .get(fieldName.toLowerCase());
    if (field == null) {
      return null;
    }
    DescribeFieldResult describe = field.getDescribe();
    if (!describe.isAccessible()) {
      return null;
    }
    Schema.DisplayType type = describe.getType();
    if (type != Schema.DisplayType.PHONE && type != Schema.DisplayType.STRING) {
      return null;
    }
    return describe.getName();
  }

  private static WhatsApp_Consent__c findConsent(String phone, String digits) {
    List<WhatsApp_Consent__c> consents = [
      SELECT Id, Opt_In_Status__c
      FROM WhatsApp_Consent__c
      WHERE Phone__c = :phone OR Wa_Id__c = :digits
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    return consents.isEmpty() ? null : consents[0];
  }

  private static WhatsApp_Profile__c findOrCreateProfile(
    Id accountId,
    String digits,
    String phone
  ) {
    List<WhatsApp_Profile__c> profiles = [
      SELECT
        Id,
        Identity_Key__c,
        Wa_Id__c,
        BSUID__c,
        Phone__c,
        Parent_Record_Id__c
      FROM WhatsApp_Profile__c
      WHERE Wa_Id__c = :digits OR Phone__c = :phone
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    if (!profiles.isEmpty()) {
      return profiles[0];
    }
    return WhatsAppProfileService.upsertInbound(
      accountId,
      'wa:' + digits,
      digits,
      null,
      null,
      phone,
      'Outbound'
    );
  }

  private static String normalizePhone(String rawPhone, String countryCode) {
    String digits = rawPhone.replaceAll('[^0-9]', '');
    if (String.isBlank(digits)) {
      throw new AuraHandledException('The phone number is invalid.');
    }
    if (digits.startsWith('00')) {
      digits = digits.substring(2);
    }

    Boolean hadPlus = rawPhone.trim().startsWith('+');
    String cc = String.isBlank(countryCode)
      ? WhatsAppSettingsService.getSettings().Default_Country_Code__c
      : countryCode;
    cc = cc == null ? '' : cc.replaceAll('[^0-9]', '');

    if (!hadPlus && String.isNotBlank(cc)) {
      if (digits.startsWith('0')) {
        digits = digits.substring(1);
      }
      if (!digits.startsWith(cc)) {
        digits = cc + digits;
      }
    } else if (!hadPlus && digits.length() == 10) {
      digits = '1' + digits;
    }

    if (digits.length() < 8 || digits.length() > 15) {
      throw new AuraHandledException(
        'The phone number must be in E.164 format.'
      );
    }
    return '+' + digits;
  }
}
