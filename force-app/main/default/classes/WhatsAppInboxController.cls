/**
 * Full-page inbox API. Returns conversations the current agent can work.
 */
public without sharing class WhatsAppInboxController {
  private static void assertAgent() {
    if (
      !FeatureManagement.checkPermission('WhatsApp_Agent') &&
      !FeatureManagement.checkPermission('WhatsApp_Admin')
    ) {
      throw new AuraHandledException('You need the WhatsApp Agent permission.');
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<ConversationRow> getConversations(String filter) {
    assertAgent();
    String userId = UserInfo.getUserId();
    Boolean isAdmin = FeatureManagement.checkPermission('WhatsApp_Admin');
    String query =
      'SELECT Id, Name, Parent_Record_Id__c, Parent_Object_API_Name__c, Assigned_User__c, Assigned_User__r.Name, ' +
      'Status__c, Last_Message_At__c, Last_Message_Preview__c, Unread_Count__c, Case__c, ' +
      'Profile__r.Profile_Name__c, Profile__r.Phone__c ' +
      'FROM WhatsApp_Conversation__c ' +
      'WHERE Status__c != \'Closed\' ';
    if (filter == 'mine') {
      query += 'AND Assigned_User__c = :userId ';
    } else if (filter == 'unassigned') {
      query += 'AND Assigned_User__c = NULL ';
    } else if (!isAdmin) {
      query += 'AND (Assigned_User__c = :userId OR Assigned_User__c = NULL) ';
    }
    query += 'ORDER BY Last_Message_At__c DESC LIMIT 50';

    List<WhatsApp_Conversation__c> conversations = Database.query(query);
    List<ConversationRow> rows = new List<ConversationRow>();
    for (WhatsApp_Conversation__c conversation : conversations) {
      ConversationRow row = new ConversationRow();
      row.id = conversation.Id;
      row.name = String.isNotBlank(conversation.Profile__r.Profile_Name__c)
        ? conversation.Profile__r.Profile_Name__c
        : (String.isNotBlank(conversation.Profile__r.Phone__c)
            ? conversation.Profile__r.Phone__c
            : 'WhatsApp conversation');
      row.recordId = conversation.Parent_Record_Id__c;
      row.objectApiName = conversation.Parent_Object_API_Name__c;
      row.preview = conversation.Last_Message_Preview__c;
      row.lastMessageAt = conversation.Last_Message_At__c;
      row.unreadCount = conversation.Unread_Count__c == null
        ? 0
        : conversation.Unread_Count__c.intValue();
      row.status = conversation.Status__c;
      row.assignedUserName = conversation.Assigned_User__r == null
        ? null
        : conversation.Assigned_User__r.Name;
      row.phone = conversation.Profile__r.Phone__c;
      row.caseId = conversation.Case__c;
      rows.add(row);
    }
    return rows;
  }

  @AuraEnabled
  public static void claimConversation(Id conversationId) {
    assertAgent();
    WhatsApp_Conversation__c conversation = [
      SELECT Id, Assigned_User__c, Status__c
      FROM WhatsApp_Conversation__c
      WHERE Id = :conversationId
      LIMIT 1
    ];
    conversation.Assigned_User__c = UserInfo.getUserId();
    conversation.Status__c = 'Open';
    update conversation;
  }

  @AuraEnabled
  public static void closeConversation(Id conversationId) {
    assertAgent();
    WhatsApp_Conversation__c conversation = [
      SELECT Id, Status__c, Closed_At__c
      FROM WhatsApp_Conversation__c
      WHERE Id = :conversationId
      LIMIT 1
    ];
    conversation.Status__c = 'Closed';
    conversation.Closed_At__c = Datetime.now();
    update conversation;
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Integer> getCounts() {
    assertAgent();
    String userId = UserInfo.getUserId();
    Map<String, Integer> counts = new Map<String, Integer>();
    counts.put(
      'unassigned',
      [
        SELECT COUNT()
        FROM WhatsApp_Conversation__c
        WHERE Assigned_User__c = NULL AND Status__c != 'Closed'
      ]
    );
    counts.put(
      'mine',
      [
        SELECT COUNT()
        FROM WhatsApp_Conversation__c
        WHERE Assigned_User__c = :userId AND Status__c != 'Closed'
      ]
    );
    Integer unread = 0;
    for (AggregateResult result : [
      SELECT SUM(Unread_Count__c) total
      FROM WhatsApp_Conversation__c
      WHERE Assigned_User__c = :userId AND Status__c != 'Closed'
    ]) {
      Decimal total = (Decimal) result.get('total');
      unread = total == null ? 0 : total.intValue();
    }
    counts.put('unread', unread);
    return counts;
  }

  public class ConversationRow {
    @AuraEnabled
    public Id id { get; set; }
    @AuraEnabled
    public String name { get; set; }
    @AuraEnabled
    public String recordId { get; set; }
    @AuraEnabled
    public String objectApiName { get; set; }
    @AuraEnabled
    public String preview { get; set; }
    @AuraEnabled
    public Datetime lastMessageAt { get; set; }
    @AuraEnabled
    public Integer unreadCount { get; set; }
    @AuraEnabled
    public String status { get; set; }
    @AuraEnabled
    public String assignedUserName { get; set; }
    @AuraEnabled
    public String phone { get; set; }
    @AuraEnabled
    public Id caseId { get; set; }
  }
}
