@IsTest
private class WhatsAppWebhookResourceTest {
  private static final String PAYLOAD = '{"object":"whatsapp_business_account","entry":[{"id":"waba-id","changes":[{"field":"messages","value":{"metadata":{"phone_number_id":"phone-number-id","display_phone_number":"+15550001111"},"contacts":[{"wa_id":"15551234567","profile":{"name":"Test Customer"}}],"messages":[{"from":"15551234567","id":"wamid.test","timestamp":"1700000000","type":"text","text":{"body":"Hello"}}]}}]}]}';

  @IsTest
  static void verifiesChallenge() {
    WhatsAppTestDataFactory.createCredential();
    RestRequest request = new RestRequest();
    RestResponse response = new RestResponse();
    request.params.put('hub.mode', 'subscribe');
    request.params.put(
      'hub.verify_token',
      WhatsAppTestDataFactory.VERIFY_TOKEN
    );
    request.params.put('hub.challenge', 'challenge-123');
    RestContext.request = request;
    RestContext.response = response;

    Test.startTest();
    WhatsAppWebhookResource.verify();
    Test.stopTest();

    System.assertEquals(200, RestContext.response.statusCode);
    System.assertEquals(
      'challenge-123',
      RestContext.response.responseBody.toString()
    );
  }

  @IsTest
  static void stagesSignedMessage() {
    WhatsAppTestDataFactory.createCredential();
    RestRequest request = signedRequest(
      PAYLOAD,
      WhatsAppTestDataFactory.APP_SECRET
    );
    RestContext.request = request;
    RestContext.response = new RestResponse();

    Test.startTest();
    WhatsAppWebhookResource.receive();
    Test.stopTest();

    System.assertEquals(200, RestContext.response.statusCode);
    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_Webhook_Event__c]);
  }

  @IsTest
  static void rejectsInvalidSignature() {
    WhatsAppTestDataFactory.createCredential();
    RestRequest request = new RestRequest();
    request.requestBody = Blob.valueOf(PAYLOAD);
    request.headers.put('X-Hub-Signature-256', 'sha256=invalid');
    RestContext.request = request;
    RestContext.response = new RestResponse();

    Test.startTest();
    WhatsAppWebhookResource.receive();
    Test.stopTest();

    System.assertEquals(401, RestContext.response.statusCode);
    System.assertEquals(0, [SELECT COUNT() FROM WhatsApp_Webhook_Event__c]);
  }

  @IsTest
  static void deduplicatesRepeatedPayload() {
    WhatsAppTestDataFactory.createCredential();
    RestRequest request = signedRequest(
      PAYLOAD,
      WhatsAppTestDataFactory.APP_SECRET
    );
    RestContext.request = request;
    RestContext.response = new RestResponse();

    Test.startTest();
    WhatsAppWebhookResource.receive();
    WhatsAppWebhookResource.receive();
    Test.stopTest();

    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_Webhook_Event__c]);
  }

  private static RestRequest signedRequest(String payload, String secret) {
    Blob body = Blob.valueOf(payload);
    String signature =
      'sha256=' +
      EncodingUtil.convertToHex(
        Crypto.generateMac('HmacSHA256', body, Blob.valueOf(secret))
      );
    RestRequest request = new RestRequest();
    request.requestBody = body;
    request.headers.put('X-Hub-Signature-256', signature);
    return request;
  }
}
