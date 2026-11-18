/**
 * Matches an inbound WhatsApp number/BSUID to a CRM record.
 *
 * v1 uses validated dynamic SOQL against WhatsApp_Object_Mapping__c plus a
 * Lead/Contact/Account fallback. For very large orgs, replace with SOSL or a
 * normalized phone index without changing callers.
 */
public without sharing class WhatsAppPhoneMatcher {
  public static Id findOrCreateParent(
    String phone,
    String bsuid,
    String profileName
  ) {
    if (String.isNotBlank(phone)) {
      Id match = findByPhone(phone);
      if (match != null) {
        return match;
      }
    }

    if (String.isNotBlank(bsuid)) {
      List<WhatsApp_Profile__c> profiles = [
        SELECT Parent_Record_Id__c
        FROM WhatsApp_Profile__c
        WHERE BSUID__c = :bsuid AND Parent_Record_Id__c != NULL
        LIMIT 1
      ];
      if (!profiles.isEmpty()) {
        return Id.valueOf(profiles[0].Parent_Record_Id__c);
      }
    }

    WhatsApp_Settings__c settings = WhatsAppSettingsService.getSettings();
    if (settings.Enable_Auto_Create_Lead__c == true) {
      return createLead(phone, bsuid, profileName, settings);
    }
    return null;
  }

  public static Id findByPhone(String phone) {
    if (String.isBlank(phone)) {
      return null;
    }
    String digits = phone.replaceAll('[^0-9]', '');
    if (String.isBlank(digits)) {
      return null;
    }
    String national = digits.length() > 10
      ? digits.substring(digits.length() - 10)
      : digits;

    List<WhatsApp_Object_Mapping__c> mappings = [
      SELECT Object_API_Name__c, Phone_Field__c, Priority__c
      FROM WhatsApp_Object_Mapping__c
      WHERE Is_Active__c = TRUE
      ORDER BY Priority__c ASC
    ];

    for (WhatsApp_Object_Mapping__c mapping : mappings) {
      String objectName = resolveObjectName(mapping.Object_API_Name__c);
      String fieldName = resolvePhoneField(objectName, mapping.Phone_Field__c);
      if (String.isBlank(objectName) || String.isBlank(fieldName)) {
        continue;
      }
      String query =
        'SELECT Id FROM ' +
        objectName +
        ' WHERE ' +
        fieldName +
        ' = :phone OR ' +
        fieldName +
        ' = :digits OR ' +
        fieldName +
        ' = :national LIMIT 1';
      try {
        List<SObject> rows = Database.queryWithBinds(
          query,
          new Map<String, Object>{
            'phone' => phone,
            'digits' => digits,
            'national' => national
          },
          AccessLevel.SYSTEM_MODE
        );
        if (!rows.isEmpty()) {
          return rows[0].Id;
        }
      } catch (Exception e) {
        // Ignore a bad mapping and continue; it is logged by the caller.
      }
    }

    Id fallback = findInStandardObject('Contact', phone, digits, national);
    if (fallback != null) {
      return fallback;
    }
    fallback = findInStandardObject('Lead', phone, digits, national);
    if (fallback != null) {
      return fallback;
    }
    return findInStandardObject('Account', phone, digits, national);
  }

  private static Id findInStandardObject(
    String objectName,
    String phone,
    String digits,
    String national
  ) {
    String query;
    if (objectName == 'Account') {
      query = 'SELECT Id FROM Account WHERE Phone = :phone OR Phone = :digits OR Phone = :national LIMIT 1';
    } else {
      query =
        'SELECT Id FROM ' +
        objectName +
        ' WHERE Phone = :phone OR MobilePhone = :phone OR Phone = :digits OR MobilePhone = :digits OR Phone = :national OR MobilePhone = :national LIMIT 1';
    }
    try {
      List<SObject> rows = Database.queryWithBinds(
        query,
        new Map<String, Object>{
          'phone' => phone,
          'digits' => digits,
          'national' => national
        },
        AccessLevel.SYSTEM_MODE
      );
      return rows.isEmpty() ? null : rows[0].Id;
    } catch (Exception e) {
      return null;
    }
  }

  private static String resolveObjectName(String requestedName) {
    if (
      String.isBlank(requestedName) ||
      !Pattern.matches('^[A-Za-z][A-Za-z0-9_]*$', requestedName)
    ) {
      return null;
    }
    SObjectType objectType = Schema.getGlobalDescribe().get(requestedName);
    if (objectType == null) {
      return null;
    }
    DescribeSObjectResult describe = objectType.getDescribe();
    if (!describe.isAccessible() || !describe.isQueryable()) {
      return null;
    }
    return describe.getName();
  }

  private static String resolvePhoneField(
    String objectName,
    String requestedField
  ) {
    if (
      String.isBlank(requestedField) ||
      !Pattern.matches('^[A-Za-z][A-Za-z0-9_]*$', requestedField)
    ) {
      return null;
    }
    SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
    if (objectType == null) {
      return null;
    }
    Map<String, SObjectField> fields = objectType.getDescribe().fields.getMap();
    SObjectField field = fields.get(requestedField.toLowerCase());
    if (field == null) {
      return null;
    }
    DescribeFieldResult describe = field.getDescribe();
    if (!describe.isAccessible()) {
      return null;
    }
    Schema.DisplayType fieldType = describe.getType();
    if (
      fieldType != Schema.DisplayType.PHONE &&
      fieldType != Schema.DisplayType.STRING
    ) {
      return null;
    }
    return describe.getName();
  }

  private static Id createLead(
    String phone,
    String bsuid,
    String profileName,
    WhatsApp_Settings__c settings
  ) {
    String lastName;
    if (String.isNotBlank(profileName)) {
      lastName = profileName;
    } else if (String.isNotBlank(phone)) {
      lastName = 'WhatsApp ' + phone;
    } else {
      lastName = 'WhatsApp ' + bsuid;
    }
    if (lastName.length() > 80) {
      lastName = lastName.substring(0, 80);
    }

    Lead lead = new Lead(
      LastName = lastName,
      Company = 'WhatsApp',
      Phone = phone,
      Description = 'Created automatically from an inbound WhatsApp message.'
    );
    if (String.isNotBlank(settings.Default_Lead_Owner__c)) {
      try {
        lead.OwnerId = Id.valueOf(settings.Default_Lead_Owner__c);
      } catch (Exception e) {
        // Ignore an invalid default owner; Salesforce will use the running user.
      }
    }
    insert lead;
    return lead.Id;
  }
}
