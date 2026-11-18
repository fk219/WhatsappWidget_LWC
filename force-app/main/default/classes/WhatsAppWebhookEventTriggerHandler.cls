public with sharing class WhatsAppWebhookEventTriggerHandler {
  private static final Integer CHUNK_SIZE = 100;

  public static void afterInsert(List<WhatsApp_Webhook_Event__c> events) {
    List<Id> eventIds = new List<Id>();
    for (WhatsApp_Webhook_Event__c event : events) {
      if (event.Status__c == 'Received') {
        eventIds.add(event.Id);
      }
    }

    for (
      Integer startIndex = 0;
      startIndex < eventIds.size();
      startIndex += CHUNK_SIZE
    ) {
      List<Id> chunk = new List<Id>();
      Integer endIndex = Math.min(startIndex + CHUNK_SIZE, eventIds.size());
      for (Integer index = startIndex; index < endIndex; index++) {
        chunk.add(eventIds[index]);
      }
      System.enqueueJob(new WhatsAppWebhookProcessQueueable(chunk));
    }
  }
}
