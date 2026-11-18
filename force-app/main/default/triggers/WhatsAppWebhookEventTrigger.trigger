trigger WhatsAppWebhookEventTrigger on WhatsApp_Webhook_Event__c(after insert) {
  WhatsAppWebhookEventTriggerHandler.afterInsert(Trigger.new);
}
