public class WhatsAppOutboundQueueable implements Queueable, Database.AllowsCallouts {
  private Id queueId;

  public WhatsAppOutboundQueueable(Id queueId) {
    this.queueId = queueId;
  }

  public void execute(QueueableContext context) {
    List<WhatsApp_Outbound_Queue__c> queues = [
      SELECT Id, Message__c, Status__c, Attempts__c
      FROM WhatsApp_Outbound_Queue__c
      WHERE Id = :queueId
      LIMIT 1
    ];
    if (
      queues.isEmpty() ||
      queues[0].Status__c == 'Sent' ||
      queues[0].Status__c == 'Cancelled'
    ) {
      return;
    }
    WhatsApp_Outbound_Queue__c queue = queues[0];
    queue.Status__c = 'Processing';
    queue.Attempts__c = (queue.Attempts__c == null ? 0 : queue.Attempts__c) + 1;
    update queue;

    if (queue.Message__c == null) {
      queue.Status__c = 'Failed';
      queue.Last_Error__c = 'The queue item has no message.';
      update queue;
      return;
    }

    Id messageId = queue.Message__c;
    WhatsApp_Message__c message = [
      SELECT
        Id,
        WAMID__c,
        Conversation__c,
        Account__c,
        To_Number__c,
        Body__c,
        Status__c
      FROM WhatsApp_Message__c
      WHERE Id = :messageId
      LIMIT 1
    ];
    Id accountId = message.Account__c;
    WhatsApp_Account__c account = [
      SELECT Id, Phone_Number_Id__c
      FROM WhatsApp_Account__c
      WHERE Id = :accountId
      LIMIT 1
    ];

    try {
      Map<String, Object> payload = new Map<String, Object>{
        'messaging_product' => 'whatsapp',
        'recipient_type' => 'individual',
        'to' => message.To_Number__c.replace('+', ''),
        'type' => 'text',
        'text' => new Map<String, Object>{
          'preview_url' => false,
          'body' => message.Body__c
        }
      };

      HttpResponse response = WhatsAppGraphClient.post(
        account.Phone_Number_Id__c + '/messages',
        payload
      );
      Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(
        response.getBody()
      );
      List<Object> messages = (List<Object>) responseBody.get('messages');
      if (messages == null || messages.isEmpty()) {
        throw new WhatsAppException('Meta did not return a message ID.');
      }
      Map<String, Object> messageData = (Map<String, Object>) messages[0];
      String wamid = (String) messageData.get('id');

      message.WAMID__c = wamid;
      message.Status__c = WhatsAppConstants.STATUS_SENT;
      message.Status_Updated_At__c = Datetime.now();
      message.Sent_At__c = Datetime.now();
      update message;

      queue.Status__c = 'Sent';
      queue.Last_Error__c = null;
      update queue;

      WhatsAppEventService.publish(
        WhatsAppConstants.EVENT_TYPE_MESSAGE,
        message.Id,
        message.Conversation__c,
        null,
        message.Status__c,
        null
      );
    } catch (Exception e) {
      message.Status__c = WhatsAppConstants.STATUS_FAILED;
      message.Status_Updated_At__c = Datetime.now();
      message.Failed_At__c = Datetime.now();
      message.Error_Message__c = e.getMessage();
      update message;

      queue.Status__c = 'Retry';
      queue.Last_Error__c = e.getMessage();
      queue.Next_Attempt_At__c = Datetime.now().addMinutes(5);
      update queue;

      WhatsAppEventService.publish(
        WhatsAppConstants.EVENT_TYPE_MESSAGE,
        message.Id,
        message.Conversation__c,
        null,
        message.Status__c,
        null
      );
    }
  }
}
