@IsTest
private class WhatsAppWebhookProcessorTest {
  @IsTest
  static void createsInboundMessage() {
    WhatsApp_Webhook_Event__c event = new WhatsApp_Webhook_Event__c(
      Provider__c = WhatsAppConstants.PROVIDER_META,
      Event_Type__c = 'messages',
      Field__c = 'messages',
      WABA_Id__c = WhatsAppTestDataFactory.WABA_ID,
      Phone_Number_Id__c = WhatsAppTestDataFactory.PHONE_NUMBER_ID,
      Dedupe_Key__c = 'test-inbound',
      Payload__c = inboundPayload(),
      Status__c = 'Received'
    );
    insert event;

    Test.startTest();
    WhatsAppWebhookProcessor.process(event.Id);
    Test.stopTest();

    System.assertEquals(
      1,
      [SELECT COUNT() FROM WhatsApp_Message__c WHERE WAMID__c = 'wamid.inbound']
    );
    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_Profile__c]);
    System.assertEquals(1, [SELECT COUNT() FROM WhatsApp_Conversation__c]);
    Id eventId = event.Id;
    WhatsApp_Webhook_Event__c processed = [
      SELECT Status__c
      FROM WhatsApp_Webhook_Event__c
      WHERE Id = :eventId
    ];
    System.assertEquals('Processed', processed.Status__c);
  }

  @IsTest
  static void advancesMessageStatus() {
    WhatsAppTestDataFactory.createCredential();
    WhatsApp_Account__c account = WhatsAppTestDataFactory.createAccount();
    WhatsApp_Profile__c profile = WhatsAppTestDataFactory.createProfile(
      account.Id,
      WhatsAppTestDataFactory.WA_ID
    );
    WhatsApp_Conversation__c conversation = WhatsAppTestDataFactory.createConversation(
      account.Id,
      profile.Id,
      WhatsAppTestDataFactory.WA_ID,
      Datetime.now().addHours(24)
    );
    WhatsApp_Message__c message = WhatsAppTestDataFactory.createMessage(
      conversation.Id,
      account.Id,
      'wamid.status',
      WhatsAppConstants.STATUS_SENT
    );

    WhatsApp_Webhook_Event__c event = new WhatsApp_Webhook_Event__c(
      Provider__c = WhatsAppConstants.PROVIDER_META,
      Event_Type__c = 'messages',
      Field__c = 'messages',
      WABA_Id__c = WhatsAppTestDataFactory.WABA_ID,
      Phone_Number_Id__c = WhatsAppTestDataFactory.PHONE_NUMBER_ID,
      Dedupe_Key__c = 'test-status',
      Payload__c = statusPayload('wamid.status', 'delivered'),
      Status__c = 'Received'
    );
    insert event;

    Test.startTest();
    WhatsAppWebhookProcessor.process(event.Id);
    Test.stopTest();

    Id messageRecordId = message.Id;
    WhatsApp_Message__c updated = [
      SELECT Status__c
      FROM WhatsApp_Message__c
      WHERE Id = :messageRecordId
    ];
    System.assertEquals(WhatsAppConstants.STATUS_DELIVERED, updated.Status__c);
    System.assertEquals(
      1,
      [
        SELECT COUNT()
        FROM WhatsApp_Message_Status__c
        WHERE Message__c = :messageRecordId
      ]
    );
  }

  private static String inboundPayload() {
    Map<String, Object> value = new Map<String, Object>{
      'metadata' => new Map<String, Object>{
        'phone_number_id' => WhatsAppTestDataFactory.PHONE_NUMBER_ID,
        'display_phone_number' => '+15550001111'
      },
      'contacts' => new List<Object>{
        new Map<String, Object>{
          'wa_id' => WhatsAppTestDataFactory.WA_ID,
          'profile' => new Map<String, Object>{ 'name' => 'Test Customer' }
        }
      },
      'messages' => new List<Object>{
        new Map<String, Object>{
          'from' => WhatsAppTestDataFactory.WA_ID,
          'id' => 'wamid.inbound',
          'timestamp' => '1700000000',
          'type' => 'text',
          'text' => new Map<String, Object>{ 'body' => 'Hello' }
        }
      }
    };
    return JSON.serialize(value);
  }

  private static String statusPayload(String wamid, String status) {
    Map<String, Object> value = new Map<String, Object>{
      'metadata' => new Map<String, Object>{
        'phone_number_id' => WhatsAppTestDataFactory.PHONE_NUMBER_ID,
        'display_phone_number' => '+15550001111'
      },
      'statuses' => new List<Object>{
        new Map<String, Object>{
          'id' => wamid,
          'status' => status,
          'timestamp' => '1700000100',
          'recipient_id' => WhatsAppTestDataFactory.WA_ID,
          'pricing' => new Map<String, Object>{
            'billable' => true,
            'pricing_model' => 'PMP',
            'type' => 'regular',
            'category' => 'service'
          }
        }
      }
    };
    return JSON.serialize(value);
  }
}
