public class WhatsAppWebhookProcessQueueable implements Queueable, Database.AllowsCallouts {
  private List<Id> eventIds;

  public WhatsAppWebhookProcessQueueable(List<Id> eventIds) {
    this.eventIds = eventIds;
  }

  public void execute(QueueableContext context) {
    for (Id eventId : eventIds) {
      WhatsAppWebhookProcessor.process(eventId);
    }
  }
}
