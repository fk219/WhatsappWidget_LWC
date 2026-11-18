/**
 * Upserts WhatsApp identities by phone/BSUID and links them to CRM records.
 */
public without sharing class WhatsAppProfileService {
  public static WhatsApp_Profile__c upsertInbound(
    Id accountId,
    String identityKey,
    String waId,
    String bsuid,
    String profileName,
    String phone,
    String source
  ) {
    if (String.isBlank(identityKey)) {
      throw new WhatsAppException(
        'Cannot create a WhatsApp profile without an identity key.'
      );
    }

    List<WhatsApp_Profile__c> existing = [
      SELECT
        Id,
        Identity_Key__c,
        Wa_Id__c,
        BSUID__c,
        Username__c,
        Profile_Name__c,
        Phone__c,
        Parent_Record_Id__c,
        Parent_Object_API_Name__c,
        First_Seen__c,
        Last_Seen__c,
        Blocked__c,
        Source__c,
        Account__c
      FROM WhatsApp_Profile__c
      WHERE Identity_Key__c = :identityKey
      LIMIT 1
    ];

    WhatsApp_Profile__c profile = existing.isEmpty()
      ? new WhatsApp_Profile__c(Identity_Key__c = identityKey)
      : existing[0];

    profile.Account__c = accountId;
    profile.Wa_Id__c = waId;
    profile.BSUID__c = bsuid;
    profile.Phone__c = phone;
    if (String.isNotBlank(profileName)) {
      profile.Profile_Name__c = profileName;
    }
    if (profile.First_Seen__c == null) {
      profile.First_Seen__c = Datetime.now();
    }
    profile.Last_Seen__c = Datetime.now();
    if (String.isNotBlank(source)) {
      profile.Source__c = source;
    } else if (String.isBlank(profile.Source__c)) {
      profile.Source__c = 'Inbound';
    }

    List<WhatsApp_Profile__c> profiles = new List<WhatsApp_Profile__c>{
      profile
    };
    upsert profiles WhatsApp_Profile__c.Fields.Identity_Key__c;
    return profile;
  }

  public static WhatsApp_Profile__c linkToRecord(
    Id profileId,
    Id recordId,
    String objectApiName
  ) {
    if (profileId == null || recordId == null) {
      return null;
    }
    WhatsApp_Profile__c profile = [
      SELECT Id, Parent_Record_Id__c, Parent_Object_API_Name__c
      FROM WhatsApp_Profile__c
      WHERE Id = :profileId
      LIMIT 1
    ];
    profile.Parent_Record_Id__c = String.valueOf(recordId);
    profile.Parent_Object_API_Name__c = objectApiName;
    update profile;
    return profile;
  }

  public static WhatsApp_Profile__c getById(Id profileId) {
    return [
      SELECT
        Id,
        Identity_Key__c,
        Wa_Id__c,
        BSUID__c,
        Username__c,
        Profile_Name__c,
        Phone__c,
        Parent_Record_Id__c,
        Parent_Object_API_Name__c,
        First_Seen__c,
        Last_Seen__c,
        Blocked__c,
        Source__c,
        Account__c
      FROM WhatsApp_Profile__c
      WHERE Id = :profileId
      LIMIT 1
    ];
  }
}
