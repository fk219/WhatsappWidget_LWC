/**
 * Publishes lightweight platform events for the LWC real-time layer.
 * Event failures must never roll back the message DML.
 */
public without sharing class WhatsAppEventService {
  public static void publish(
    String eventType,
    Id messageId,
    Id conversationId,
    Id recordId,
    String status,
    Integer unreadCount
  ) {
    try {
      WhatsApp_Event__e event = new WhatsApp_Event__e(
        Event_Type__c = eventType,
        Message_Id__c = messageId,
        Conversation_Id__c = conversationId,
        Record_Id__c = recordId == null ? null : String.valueOf(recordId),
        Status__c = status,
        Unread_Count__c = unreadCount,
        Occurred_At__c = Datetime.now()
      );
      EventBus.publish(event);
    } catch (Exception e) {
      // Real-time is a convenience; the data is already persisted.
    }
  }
}
