/**
 * Finds or creates the WhatsApp account row for a Meta phone number ID.
 */
public without sharing class WhatsAppAccountService {
  public static WhatsApp_Account__c getOrCreate(
    String phoneNumberId,
    String messagingAccountId,
    String displayPhoneNumber
  ) {
    if (String.isBlank(phoneNumberId)) {
      throw new WhatsAppException(
        'The webhook did not include a phone_number_id.'
      );
    }
    List<WhatsApp_Account__c> accounts = [
      SELECT
        Id,
        Phone_Number_Id__c,
        Messaging_Account_Id__c,
        Display_Phone_Number__c,
        Is_Default__c,
        Is_Active__c
      FROM WhatsApp_Account__c
      WHERE Phone_Number_Id__c = :phoneNumberId
      LIMIT 1
    ];
    if (!accounts.isEmpty()) {
      return accounts[0];
    }

    WhatsApp_Account__c account = new WhatsApp_Account__c(
      Phone_Number_Id__c = phoneNumberId,
      Messaging_Account_Id__c = messagingAccountId,
      Display_Phone_Number__c = displayPhoneNumber,
      Status__c = 'Active',
      Is_Active__c = true,
      Is_Default__c = true,
      Webhook_Status__c = 'Connected'
    );
    try {
      insert account;
      return account;
    } catch (DmlException e) {
      // Another transaction may have created it; re-query.
      List<WhatsApp_Account__c> retry = [
        SELECT
          Id,
          Phone_Number_Id__c,
          Messaging_Account_Id__c,
          Display_Phone_Number__c,
          Is_Default__c,
          Is_Active__c
        FROM WhatsApp_Account__c
        WHERE Phone_Number_Id__c = :phoneNumberId
        LIMIT 1
      ];
      if (!retry.isEmpty()) {
        return retry[0];
      }
      throw new WhatsAppException(
        'Unable to create the WhatsApp account record.'
      );
    }
  }

  public static WhatsApp_Account__c getDefault() {
    List<WhatsApp_Account__c> accounts = [
      SELECT
        Id,
        Phone_Number_Id__c,
        Messaging_Account_Id__c,
        Display_Phone_Number__c,
        Is_Default__c,
        Is_Active__c
      FROM WhatsApp_Account__c
      WHERE Is_Default__c = TRUE
      LIMIT 1
    ];
    if (!accounts.isEmpty()) {
      return accounts[0];
    }
    accounts = [
      SELECT
        Id,
        Phone_Number_Id__c,
        Messaging_Account_Id__c,
        Display_Phone_Number__c,
        Is_Default__c,
        Is_Active__c
      FROM WhatsApp_Account__c
      WHERE Is_Active__c = TRUE
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    if (!accounts.isEmpty()) {
      return accounts[0];
    }
    WhatsApp_Credential__c credential = WhatsAppSettingsService.getActiveCredential();
    if (String.isBlank(credential.Phone_Number_Id__c)) {
      throw new WhatsAppException(
        'No WhatsApp phone number is configured. Open WhatsApp Setup.'
      );
    }
    return getOrCreate(
      credential.Phone_Number_Id__c,
      credential.Messaging_Account_Id__c,
      null
    );
  }
}
