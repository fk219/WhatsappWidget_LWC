@IsTest
private class WhatsAppOutboundServiceTest {
  @IsTest
  static void sendsTextAndUpdatesMessage() {
    WhatsAppTestDataFactory.createCredential();
    WhatsAppTestDataFactory.createSettings();
    WhatsApp_Account__c account = WhatsAppTestDataFactory.createAccount();
    WhatsApp_Profile__c profile = WhatsAppTestDataFactory.createProfile(
      account.Id,
      WhatsAppTestDataFactory.WA_ID
    );
    WhatsAppTestDataFactory.createConversation(
      account.Id,
      profile.Id,
      WhatsAppTestDataFactory.WA_ID,
      Datetime.now().addHours(24)
    );
    Lead lead = WhatsAppTestDataFactory.createLeadWithPhone('+15551234567');

    Test.setMock(HttpCalloutMock.class, new GraphMock());

    Test.startTest();
    Map<String, String> result = WhatsAppOutboundService.sendText(
      lead.Id,
      'Lead',
      'Hello from Salesforce'
    );
    Test.stopTest();

    String messageId = result.get('messageId');
    System.assertNotEquals(null, messageId);
    WhatsApp_Message__c message = [
      SELECT WAMID__c, Status__c, Direction__c
      FROM WhatsApp_Message__c
      WHERE Id = :messageId
    ];
    System.assertEquals('wamid.outbound', message.WAMID__c);
    System.assertEquals(WhatsAppConstants.STATUS_SENT, message.Status__c);
    System.assertEquals(
      WhatsAppConstants.DIRECTION_OUTBOUND,
      message.Direction__c
    );

    Id messageRecordId = message.Id;
    WhatsApp_Outbound_Queue__c queue = [
      SELECT Status__c
      FROM WhatsApp_Outbound_Queue__c
      WHERE Message__c = :messageRecordId
    ];
    System.assertEquals('Sent', queue.Status__c);
  }

  private class GraphMock implements HttpCalloutMock {
    public HttpResponse respond(HttpRequest request) {
      HttpResponse response = new HttpResponse();
      response.setStatusCode(200);
      response.setHeader('Content-Type', 'application/json');
      response.setBody(
        '{"messaging_product":"whatsapp","messages":[{"id":"wamid.outbound"}]}'
      );
      return response;
    }
  }
}
