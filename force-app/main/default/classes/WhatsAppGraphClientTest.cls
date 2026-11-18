@IsTest
private class WhatsAppGraphClientTest {
  @IsTest
  static void successfulCallLogsApiCall() {
    WhatsAppTestDataFactory.createCredential();
    Test.setMock(HttpCalloutMock.class, new GraphMock(200, '{"ok":true}'));

    Test.startTest();
    HttpResponse response = WhatsAppGraphClient.get('/me', null);
    Test.stopTest();

    System.assertEquals(200, response.getStatusCode());
    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_API_Log__c]);
  }

  @IsTest
  static void failedCallThrowsSafeError() {
    WhatsAppTestDataFactory.createCredential();
    Test.setMock(
      HttpCalloutMock.class,
      new GraphMock(
        400,
        '{"error":{"message":"bad request","code":100,"fbtrace_id":"trace-1"}}'
      )
    );

    Test.startTest();
    try {
      WhatsAppGraphClient.get('/me', null);
      System.assert(false, 'Expected WhatsAppException');
    } catch (WhatsAppException e) {
      System.assert(e.getMessage().contains('bad request'));
    }
    Test.stopTest();

    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_API_Log__c]);
  }

  private class GraphMock implements HttpCalloutMock {
    private final Integer statusCode;
    private final String body;

    GraphMock(Integer statusCode, String body) {
      this.statusCode = statusCode;
      this.body = body;
    }

    public HttpResponse respond(HttpRequest request) {
      HttpResponse response = new HttpResponse();
      response.setStatusCode(statusCode);
      response.setBody(body);
      response.setHeader('Content-Type', 'application/json');
      return response;
    }
  }
}
