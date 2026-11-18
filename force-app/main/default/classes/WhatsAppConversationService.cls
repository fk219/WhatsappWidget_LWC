/**
 * Finds or creates the conversation thread for a profile + account.
 */
public without sharing class WhatsAppConversationService {
  public static WhatsApp_Conversation__c findOrCreate(
    Id accountId,
    Id profileId,
    String identityKey,
    Id parentRecordId,
    String parentObjectApiName,
    Id ownerId,
    Datetime inboundAt,
    String preview
  ) {
    if (accountId == null || String.isBlank(identityKey)) {
      throw new WhatsAppException(
        'Cannot create a conversation without an account and identity key.'
      );
    }
    String conversationKey = String.valueOf(accountId) + ':' + identityKey;

    List<WhatsApp_Conversation__c> existing = [
      SELECT
        Id,
        Conversation_Key__c,
        Account__c,
        Profile__c,
        Parent_Record_Id__c,
        Parent_Object_API_Name__c,
        Assigned_User__c,
        Status__c,
        Last_Inbound_At__c,
        Window_Expires_At__c,
        Last_Message_At__c,
        Last_Message_Preview__c,
        Last_Message_Direction__c,
        Unread_Count__c,
        Message_Count__c,
        Case__c
      FROM WhatsApp_Conversation__c
      WHERE Conversation_Key__c = :conversationKey
      LIMIT 1
    ];

    WhatsApp_Conversation__c conversation = existing.isEmpty()
      ? new WhatsApp_Conversation__c(
          Conversation_Key__c = conversationKey,
          Status__c = 'Open'
        )
      : existing[0];

    conversation.Account__c = accountId;
    conversation.Profile__c = profileId;
    if (parentRecordId != null) {
      conversation.Parent_Record_Id__c = String.valueOf(parentRecordId);
      conversation.Parent_Object_API_Name__c = parentObjectApiName;
    }
    if (ownerId != null) {
      conversation.Assigned_User__c = ownerId;
    }
    if (inboundAt != null) {
      conversation.Last_Inbound_At__c = inboundAt;
      conversation.Window_Expires_At__c = inboundAt.addHours(
        WhatsAppConstants.WINDOW_HOURS
      );
      conversation.Last_Message_At__c = inboundAt;
      conversation.Last_Message_Direction__c = WhatsAppConstants.DIRECTION_INBOUND;
    }
    if (String.isNotBlank(preview)) {
      conversation.Last_Message_Preview__c = preview.length() > 255
        ? preview.substring(0, 255)
        : preview;
    }
    if (conversation.Status__c == 'Closed') {
      conversation.Status__c = 'Open';
    }

    List<WhatsApp_Conversation__c> conversations = new List<WhatsApp_Conversation__c>{
      conversation
    };
    upsert conversations WhatsApp_Conversation__c.Fields.Conversation_Key__c;
    return conversation;
  }

  public static void incrementCounts(
    Id conversationId,
    Integer unreadDelta,
    Integer messageDelta
  ) {
    if (conversationId == null) {
      return;
    }
    WhatsApp_Conversation__c conversation = [
      SELECT Id, Unread_Count__c, Message_Count__c
      FROM WhatsApp_Conversation__c
      WHERE Id = :conversationId
      LIMIT 1
    ];
    conversation.Unread_Count__c =
      (conversation.Unread_Count__c == null
        ? 0
        : conversation.Unread_Count__c) + unreadDelta;
    conversation.Message_Count__c =
      (conversation.Message_Count__c == null
        ? 0
        : conversation.Message_Count__c) + messageDelta;
    if (conversation.Unread_Count__c < 0) {
      conversation.Unread_Count__c = 0;
    }
    update conversation;
  }

  public static WhatsApp_Conversation__c getById(Id conversationId) {
    return [
      SELECT
        Id,
        Conversation_Key__c,
        Account__c,
        Profile__c,
        Parent_Record_Id__c,
        Parent_Object_API_Name__c,
        Assigned_User__c,
        Status__c,
        Last_Inbound_At__c,
        Window_Expires_At__c,
        Last_Message_At__c,
        Last_Message_Preview__c,
        Last_Message_Direction__c,
        Unread_Count__c,
        Message_Count__c,
        Case__c
      FROM WhatsApp_Conversation__c
      WHERE Id = :conversationId
      LIMIT 1
    ];
  }
}
