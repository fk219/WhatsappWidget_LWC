/**
 * LWC-facing controller for the record chat.
 *
 * The class is without sharing so a conversation/message owned by a queue or
 * another agent can still be displayed, but every entry point first verifies
 * that the running user can read the parent record. Do not add a method here
 * that returns CRM data without that check.
 */
public without sharing class WhatsAppChatController {
  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getContext(
    Id recordId,
    String objectApiName
  ) {
    if (recordId == null) {
      throw new AuraHandledException('A record is required.');
    }
    String objectName = String.isBlank(objectApiName)
      ? recordId.getSObjectType().getDescribe().getName()
      : objectApiName;
    String nameField = objectName == 'Case' ? 'CaseNumber' : 'Name';

    String recordName;
    try {
      List<SObject> records = Database.queryWithBinds(
        'SELECT Id, ' +
          nameField +
          ' FROM ' +
          objectName +
          ' WHERE Id = :recordId LIMIT 1',
        new Map<String, Object>{ 'recordId' => recordId },
        AccessLevel.USER_MODE
      );
      if (records.isEmpty()) {
        throw new AuraHandledException('Record not found or not accessible.');
      }
      recordName = (String) records[0].get(nameField);
    } catch (AuraHandledException e) {
      throw e;
    } catch (Exception e) {
      throw new AuraHandledException('You do not have access to this record.');
    }

    WhatsApp_Conversation__c conversation = findConversation(recordId);
    String consentStatus = WhatsAppConstants.CONSENT_UNKNOWN;
    String recordIdString = String.valueOf(recordId);
    List<WhatsApp_Consent__c> consents = [
      SELECT Opt_In_Status__c
      FROM WhatsApp_Consent__c
      WHERE Parent_Record_Id__c = :recordIdString
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    if (
      !consents.isEmpty() && String.isNotBlank(consents[0].Opt_In_Status__c)
    ) {
      consentStatus = consents[0].Opt_In_Status__c;
    }

    List<WhatsApp_Message__c> messages = conversation == null
      ? new List<WhatsApp_Message__c>()
      : loadMessagesInternal(conversation.Id, 100);

    Map<String, Object> result = new Map<String, Object>();
    result.put('recordName', recordName);
    result.put('consentStatus', consentStatus);
    result.put('messages', messages);
    if (conversation != null) {
      result.put('conversationId', conversation.Id);
      result.put('windowExpiresAt', conversation.Window_Expires_At__c);
    } else {
      result.put('conversationId', null);
      result.put('windowExpiresAt', null);
    }
    return result;
  }

  @AuraEnabled
  public static List<WhatsApp_Message__c> loadMessages(
    Id conversationId,
    Integer maxMessages
  ) {
    assertConversationAccess(conversationId);
    Integer limitSize = maxMessages == null
      ? 100
      : Math.min(Math.max(maxMessages, 1), 200);
    return loadMessagesInternal(conversationId, limitSize);
  }

  @AuraEnabled
  public static Map<String, String> sendText(
    Id recordId,
    String objectApiName,
    String message
  ) {
    return WhatsAppOutboundService.sendText(recordId, objectApiName, message);
  }

  private static WhatsApp_Conversation__c findConversation(Id recordId) {
    String recordIdString = String.valueOf(recordId);
    List<WhatsApp_Conversation__c> conversations = [
      SELECT
        Id,
        Window_Expires_At__c,
        Last_Message_At__c,
        Unread_Count__c,
        Status__c
      FROM WhatsApp_Conversation__c
      WHERE Parent_Record_Id__c = :recordIdString
      ORDER BY Last_Message_At__c DESC
      LIMIT 1
    ];
    return conversations.isEmpty() ? null : conversations[0];
  }

  private static List<WhatsApp_Message__c> loadMessagesInternal(
    Id conversationId,
    Integer limitSize
  ) {
    List<WhatsApp_Message__c> descending = [
      SELECT
        Id,
        Body__c,
        Caption__c,
        Direction__c,
        Type__c,
        Status__c,
        Sent_At__c,
        Media_Id__c,
        Error_Message__c,
        Reaction_Emoji__c,
        Reply_To_WAMID__c,
        Sent_By__c
      FROM WhatsApp_Message__c
      WHERE Conversation__c = :conversationId
      ORDER BY Sent_At__c DESC
      LIMIT :limitSize
    ];
    List<WhatsApp_Message__c> ascending = new List<WhatsApp_Message__c>();
    for (Integer index = descending.size() - 1; index >= 0; index--) {
      ascending.add(descending[index]);
    }
    return ascending;
  }

  private static void assertConversationAccess(Id conversationId) {
    if (conversationId == null) {
      throw new AuraHandledException('A conversation is required.');
    }
    List<WhatsApp_Conversation__c> conversations = [
      SELECT Id, Parent_Record_Id__c, Parent_Object_API_Name__c
      FROM WhatsApp_Conversation__c
      WHERE Id = :conversationId
      LIMIT 1
    ];
    if (conversations.isEmpty()) {
      throw new AuraHandledException('Conversation not found.');
    }
    String parentId = conversations[0].Parent_Record_Id__c;
    String objectName = conversations[0].Parent_Object_API_Name__c;
    if (String.isBlank(parentId) || String.isBlank(objectName)) {
      throw new AuraHandledException(
        'This conversation is not linked to a record.'
      );
    }
    try {
      List<SObject> parents = Database.queryWithBinds(
        'SELECT Id FROM ' + objectName + ' WHERE Id = :parentId LIMIT 1',
        new Map<String, Object>{ 'parentId' => Id.valueOf(parentId) },
        AccessLevel.USER_MODE
      );
      if (parents.isEmpty()) {
        throw new AuraHandledException(
          'You do not have access to this conversation.'
        );
      }
    } catch (AuraHandledException e) {
      throw e;
    } catch (Exception e) {
      throw new AuraHandledException(
        'You do not have access to this conversation.'
      );
    }
  }
}
