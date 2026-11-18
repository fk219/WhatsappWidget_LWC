@IsTest
public class WhatsAppTestDataFactory {
  public static final String PHONE_NUMBER_ID = 'phone-number-id';
  public static final String WABA_ID = 'waba-id';
  public static final String WA_ID = '15551234567';
  public static final String ACCESS_TOKEN = 'test-access-token';
  public static final String APP_SECRET = 'test-app-secret';
  public static final String VERIFY_TOKEN = 'test-verify-token';

  public static WhatsApp_Credential__c createCredential() {
    WhatsApp_Credential__c credential = new WhatsApp_Credential__c(
      Label__c = 'Test Credential',
      Provider__c = WhatsAppConstants.PROVIDER_META,
      App_Id__c = 'test-app-id',
      Messaging_Account_Id__c = WABA_ID,
      Phone_Number_Id__c = PHONE_NUMBER_ID,
      Access_Token__c = ACCESS_TOKEN,
      App_Secret__c = APP_SECRET,
      Verify_Token__c = VERIFY_TOKEN,
      Is_Active__c = true
    );
    insert credential;
    return credential;
  }

  public static WhatsApp_Settings__c createSettings() {
    WhatsApp_Settings__c settings = new WhatsApp_Settings__c(
      Provider__c = WhatsAppConstants.PROVIDER_META,
      Graph_API_Version__c = WhatsAppConstants.GRAPH_API_VERSION_DEFAULT,
      Default_Country_Code__c = '1',
      Enable_Signature_Validation__c = true,
      Enable_Auto_Create_Lead__c = false,
      Auto_Create_Case__c = false,
      Enable_Read_Receipts__c = true,
      Enable_Notifications__c = true,
      Max_Inbound_Media_MB__c = 10,
      Message_Retention_Days__c = 365,
      Media_Retention_Days__c = 365,
      Billing_Model__c = 'Seat'
    );
    insert settings;
    return settings;
  }

  public static WhatsApp_Account__c createAccount() {
    WhatsApp_Account__c account = new WhatsApp_Account__c(
      Phone_Number_Id__c = PHONE_NUMBER_ID,
      Messaging_Account_Id__c = WABA_ID,
      Display_Phone_Number__c = '+15550001111',
      Verified_Name__c = 'Test Business',
      Status__c = 'Active',
      Is_Default__c = true,
      Is_Active__c = true,
      Webhook_Status__c = 'Connected'
    );
    insert account;
    return account;
  }

  public static WhatsApp_Profile__c createProfile(Id accountId, String waId) {
    WhatsApp_Profile__c profile = new WhatsApp_Profile__c(
      Identity_Key__c = 'wa:' + waId,
      Wa_Id__c = waId,
      Phone__c = '+' + waId,
      Profile_Name__c = 'Test Customer',
      Account__c = accountId,
      First_Seen__c = Datetime.now(),
      Last_Seen__c = Datetime.now(),
      Source__c = 'Test'
    );
    insert profile;
    return profile;
  }

  public static WhatsApp_Conversation__c createConversation(
    Id accountId,
    Id profileId,
    String waId,
    Datetime windowExpiresAt
  ) {
    WhatsApp_Conversation__c conversation = new WhatsApp_Conversation__c(
      Conversation_Key__c = String.valueOf(accountId) + ':wa:' + waId,
      Account__c = accountId,
      Profile__c = profileId,
      Status__c = 'Open',
      Last_Inbound_At__c = Datetime.now(),
      Window_Expires_At__c = windowExpiresAt,
      Last_Message_At__c = Datetime.now(),
      Last_Message_Direction__c = WhatsAppConstants.DIRECTION_INBOUND,
      Last_Message_Preview__c = 'Test',
      Unread_Count__c = 0,
      Message_Count__c = 0
    );
    insert conversation;
    return conversation;
  }

  public static WhatsApp_Message__c createMessage(
    Id conversationId,
    Id accountId,
    String wamid,
    String status
  ) {
    WhatsApp_Message__c message = new WhatsApp_Message__c(
      WAMID__c = wamid,
      Conversation__c = conversationId,
      Account__c = accountId,
      Direction__c = WhatsAppConstants.DIRECTION_INBOUND,
      Sender_Type__c = 'Customer',
      From_Number__c = '+' + WA_ID,
      To_Number__c = '+15550001111',
      Type__c = WhatsAppConstants.MESSAGE_TYPE_TEXT,
      Body__c = 'Test message',
      Status__c = status,
      Status_Updated_At__c = Datetime.now(),
      Sent_At__c = Datetime.now(),
      Provider__c = WhatsAppConstants.PROVIDER_META,
      Source__c = 'Test'
    );
    insert message;
    return message;
  }

  public static Lead createLeadWithPhone(String phone) {
    Lead lead = new Lead(
      LastName = 'Test Lead',
      Company = 'Test Company',
      Phone = phone
    );
    insert lead;
    return lead;
  }
}
