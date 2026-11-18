@IsTest
private class WhatsAppPhoneMatcherTest {
  @IsTest
  static void findsLeadByPhone() {
    Lead lead = WhatsAppTestDataFactory.createLeadWithPhone('+15551234567');
    Id match = WhatsAppPhoneMatcher.findByPhone('+15551234567');
    System.assertEquals(lead.Id, match);
  }

  @IsTest
  static void createsLeadWhenEnabled() {
    WhatsApp_Settings__c settings = WhatsAppTestDataFactory.createSettings();
    settings.Enable_Auto_Create_Lead__c = true;
    settings.Default_Lead_Owner__c = UserInfo.getUserId();
    update settings;

    Id recordId = WhatsAppPhoneMatcher.findOrCreateParent(
      '+15559998888',
      null,
      'New WhatsApp Person'
    );
    System.assertNotEquals(null, recordId);
    Lead created = [SELECT Id, LastName, Phone FROM Lead WHERE Id = :recordId];
    System.assertEquals('New WhatsApp Person', created.LastName);
  }
}
