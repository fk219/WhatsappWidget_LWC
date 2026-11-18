/**
 * Public Meta webhook endpoint.
 *
 * GET  /services/apexrest/whatsapp/webhook  -> Meta verification challenge
 * POST /services/apexrest/whatsapp/webhook  -> signed event staging
 *
 * The POST path only verifies the signature and inserts a create-only staging
 * record. Business processing happens asynchronously in
 * WhatsAppWebhookProcessQueueable, so Meta gets a fast 200.
 */
@RestResource(urlMapping='/whatsapp/webhook/*')
global without sharing class WhatsAppWebhookResource {
  private static final Integer MAX_PAYLOAD = 131072;

  @HttpGet
  global static void verify() {
    RestRequest request = RestContext.request;
    RestResponse response = RestContext.response;
    response.addHeader('Content-Type', 'text/plain');
    response.addHeader('Cache-Control', 'no-store');

    String mode = request.params.get('hub.mode');
    String token = request.params.get('hub.verify_token');
    String challenge = request.params.get('hub.challenge');

    String expectedToken;
    try {
      expectedToken = WhatsAppSettingsService.getVerifyToken();
    } catch (Exception e) {
      response.statusCode = 500;
      return;
    }

    if (
      mode == 'subscribe' &&
      String.isNotBlank(challenge) &&
      token == expectedToken
    ) {
      response.statusCode = 200;
      response.responseBody = Blob.valueOf(challenge);
    } else {
      response.statusCode = 403;
    }
  }

  @HttpPost
  global static void receive() {
    RestRequest request = RestContext.request;
    RestResponse response = RestContext.response;
    response.addHeader('Content-Type', 'application/json');
    response.addHeader('Cache-Control', 'no-store');

    Blob body = request.requestBody;
    if (body == null || body.size() == 0) {
      response.statusCode = 400;
      response.responseBody = Blob.valueOf('{"error":"empty body"}');
      return;
    }

    String appSecret;
    try {
      appSecret = WhatsAppSettingsService.getAppSecret();
    } catch (Exception e) {
      response.statusCode = 500;
      response.responseBody = Blob.valueOf('{"error":"not configured"}');
      return;
    }

    String signature = request.headers.get('X-Hub-Signature-256');
    Blob expectedMac = Crypto.generateMac(
      'HmacSHA256',
      body,
      Blob.valueOf(appSecret)
    );
    String expectedSignature =
      'sha256=' + EncodingUtil.convertToHex(expectedMac);
    if (
      String.isBlank(signature) ||
      !signature.equalsIgnoreCase(expectedSignature)
    ) {
      response.statusCode = 401;
      response.responseBody = Blob.valueOf('{"error":"invalid signature"}');
      return;
    }

    Map<String, Object> payload;
    try {
      payload = (Map<String, Object>) JSON.deserializeUntyped(body.toString());
    } catch (Exception e) {
      response.statusCode = 400;
      response.responseBody = Blob.valueOf('{"error":"invalid json"}');
      return;
    }

    String objectType = (String) payload.get('object');
    if (objectType != 'whatsapp_business_account') {
      response.statusCode = 200;
      response.responseBody = Blob.valueOf('{"received":true,"ignored":true}');
      return;
    }

    List<WhatsApp_Webhook_Event__c> events = new List<WhatsApp_Webhook_Event__c>();
    List<Object> entries = (List<Object>) payload.get('entry');
    if (entries != null) {
      for (Object entryItem : entries) {
        Map<String, Object> entry = (Map<String, Object>) entryItem;
        String entryId = (String) entry.get('id');
        List<Object> changes = (List<Object>) entry.get('changes');
        if (changes == null) {
          continue;
        }
        for (Object changeItem : changes) {
          Map<String, Object> change = (Map<String, Object>) changeItem;
          String field = (String) change.get('field');
          Map<String, Object> value = (Map<String, Object>) change.get('value');
          if (value == null) {
            continue;
          }
          String payloadJson = JSON.serialize(value);
          String phoneNumberId;
          Map<String, Object> metadata = (Map<String, Object>) value.get(
            'metadata'
          );
          if (metadata != null) {
            phoneNumberId = (String) metadata.get('phone_number_id');
          }
          String digest = EncodingUtil.convertToHex(
            Crypto.generateDigest('SHA-256', Blob.valueOf(payloadJson))
          );
          String dedupeKey =
            (String.isBlank(entryId) ? '' : entryId) +
            ':' +
            field +
            ':' +
            digest;

          WhatsApp_Webhook_Event__c event = new WhatsApp_Webhook_Event__c(
            Provider__c = WhatsAppConstants.PROVIDER_META,
            Event_Type__c = field,
            Field__c = field,
            WABA_Id__c = entryId,
            Phone_Number_Id__c = phoneNumberId,
            Dedupe_Key__c = dedupeKey,
            Payload__c = truncate(payloadJson, MAX_PAYLOAD),
            Status__c = 'Received',
            Received_At__c = Datetime.now(),
            Signature_Valid__c = true,
            Source_IP__c = request.remoteAddress,
            Retention_Date__c = Date.today().addDays(30)
          );
          if (payloadJson.length() > MAX_PAYLOAD) {
            event.Error__c =
              'Payload truncated at ' +
              MAX_PAYLOAD +
              ' characters.';
            event.Status__c = 'Failed';
          }
          events.add(event);
        }
      }
    }

    if (events.isEmpty()) {
      response.statusCode = 200;
      response.responseBody = Blob.valueOf('{"received":true}');
      return;
    }

    Boolean failed = false;
    List<Database.SaveResult> results = Database.insert(events, false);
    for (Database.SaveResult result : results) {
      if (result.isSuccess()) {
        continue;
      }
      for (Database.Error error : result.getErrors()) {
        if (error.getStatusCode() != StatusCode.DUPLICATE_VALUE) {
          failed = true;
        }
      }
    }

    response.statusCode = failed ? 500 : 200;
    response.responseBody = Blob.valueOf('{"received":true}');
  }

  private static String truncate(String value, Integer maxLength) {
    if (value == null || value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }
}
