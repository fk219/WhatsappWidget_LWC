/**
 * Admin-only setup API for connection status, object/field mappings, routing
 * rules, and diagnostics.
 *
 * The class is without sharing because configuration records are private; every
 * entry point checks the WhatsApp_Admin custom permission first.
 */
public without sharing class WhatsAppAdminController {
  private static void assertAdmin() {
    if (!FeatureManagement.checkPermission('WhatsApp_Admin')) {
      throw new AuraHandledException(
        'You need the WhatsApp Admin permission to use setup.'
      );
    }
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getSetupState() {
    assertAdmin();
    WhatsApp_Settings__c settings = WhatsAppSettingsService.getSettings();
    List<WhatsApp_Credential__c> credentials = [
      SELECT
        Id,
        Label__c,
        Provider__c,
        App_Id__c,
        Messaging_Account_Id__c,
        Phone_Number_Id__c,
        Access_Token__c,
        Verify_Token__c,
        Token_Expiry__c
      FROM WhatsApp_Credential__c
      WHERE Is_Active__c = TRUE
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    WhatsApp_Credential__c credential = credentials.isEmpty()
      ? null
      : credentials[0];
    String siteUrl = settings.Site_Url__c;
    String path = String.isBlank(settings.Webhook_Path__c)
      ? WhatsAppConstants.WEBHOOK_PATH
      : settings.Webhook_Path__c;
    String webhookUrl = String.isBlank(siteUrl)
      ? ''
      : siteUrl.removeEnd('/') + path;

    Map<String, Object> result = new Map<String, Object>();
    result.put('configured', credential != null);
    result.put(
      'credentialLabel',
      credential == null ? null : credential.Label__c
    );
    result.put(
      'provider',
      credential == null
        ? WhatsAppConstants.PROVIDER_META
        : credential.Provider__c
    );
    result.put('appId', credential == null ? null : credential.App_Id__c);
    result.put(
      'phoneNumberId',
      credential == null ? null : credential.Phone_Number_Id__c
    );
    result.put(
      'messagingAccountId',
      credential == null ? null : credential.Messaging_Account_Id__c
    );
    result.put(
      'accessTokenMasked',
      mask(credential == null ? null : credential.Access_Token__c)
    );
    result.put(
      'verifyTokenMasked',
      mask(credential == null ? null : credential.Verify_Token__c)
    );
    result.put(
      'tokenExpiry',
      credential == null ? null : credential.Token_Expiry__c
    );
    result.put('graphVersion', settings.Graph_API_Version__c);
    result.put('webhookUrl', webhookUrl);
    result.put('setupStatus', settings.Setup_Status__c);
    result.put('lastHealthCheck', settings.Last_Health_Check__c);
    result.put('accountCount', [SELECT COUNT() FROM WhatsApp_Account__c]);
    result.put(
      'mappingCount',
      [SELECT COUNT() FROM WhatsApp_Object_Mapping__c]
    );
    result.put('ruleCount', [SELECT COUNT() FROM WhatsApp_Routing_Rule__c]);
    result.put('templateCount', [SELECT COUNT() FROM WhatsApp_Template__c]);
    result.put(
      'conversationCount',
      [SELECT COUNT() FROM WhatsApp_Conversation__c]
    );
    result.put('messageCount', [SELECT COUNT() FROM WhatsApp_Message__c]);
    return result;
  }

  @AuraEnabled(cacheable=true)
  public static List<Map<String, String>> getObjectOptions() {
    assertAdmin();
    List<Map<String, String>> options = new List<Map<String, String>>();
    for (SObjectType objectType : Schema.getGlobalDescribe().values()) {
      DescribeSObjectResult describe = objectType.getDescribe();
      if (
        !describe.isQueryable() ||
        describe.isCustomSetting() ||
        describe.isDeprecatedAndHidden()
      ) {
        continue;
      }
      String name = describe.getName();
      if (
        name.endsWith('__mdt') ||
        name.endsWith('__e') ||
        name.endsWith('__x') ||
        name.endsWith('__Share')
      ) {
        continue;
      }
      options.add(
        new Map<String, String>{
          'label' => describe.getLabel(),
          'value' => name
        }
      );
    }
    return options;
  }

  @AuraEnabled(cacheable=true)
  public static List<Map<String, String>> getFieldOptions(String objectName) {
    assertAdmin();
    List<Map<String, String>> options = new List<Map<String, String>>();
    SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
    if (objectType == null) {
      return options;
    }
    for (
      SObjectField field : objectType.getDescribe().fields.getMap().values()
    ) {
      DescribeFieldResult describe = field.getDescribe();
      if (!describe.isAccessible()) {
        continue;
      }
      Schema.DisplayType fieldType = describe.getType();
      if (
        fieldType != Schema.DisplayType.PHONE &&
        fieldType != Schema.DisplayType.STRING
      ) {
        continue;
      }
      options.add(
        new Map<String, String>{
          'label' => describe.getLabel(),
          'value' => describe.getName(),
          'type' => String.valueOf(fieldType)
        }
      );
    }
    return options;
  }

  @AuraEnabled(cacheable=true)
  public static List<WhatsApp_Object_Mapping__c> getMappings() {
    assertAdmin();
    return [
      SELECT
        Id,
        Name,
        Object_API_Name__c,
        Phone_Field__c,
        Country_Code_Field__c,
        Phone_Field_Label__c,
        Name_Field__c,
        Priority__c,
        Is_Active__c,
        Create_If_Missing__c,
        Create_Object__c,
        Default_Owner__c,
        Default_Queue__c,
        Record_Type_Id__c,
        Duplicate_Behavior__c
      FROM WhatsApp_Object_Mapping__c
      ORDER BY Priority__c ASC, Name ASC
    ];
  }

  @AuraEnabled
  public static WhatsApp_Object_Mapping__c saveMapping(
    WhatsApp_Object_Mapping__c mapping
  ) {
    assertAdmin();
    if (
      mapping == null ||
      String.isBlank(mapping.Object_API_Name__c) ||
      String.isBlank(mapping.Phone_Field__c)
    ) {
      throw new AuraHandledException('Object and phone field are required.');
    }
    SObjectType objectType = Schema.getGlobalDescribe()
      .get(mapping.Object_API_Name__c);
    if (objectType == null) {
      throw new AuraHandledException(
        'Unknown object: ' + mapping.Object_API_Name__c
      );
    }
    DescribeSObjectResult objectDescribe = objectType.getDescribe();
    mapping.Object_API_Name__c = objectDescribe.getName();

    SObjectField phoneField = objectDescribe.fields.getMap()
      .get(mapping.Phone_Field__c.toLowerCase());
    if (phoneField == null) {
      throw new AuraHandledException(
        'Unknown phone field: ' + mapping.Phone_Field__c
      );
    }
    DescribeFieldResult phoneDescribe = phoneField.getDescribe();
    if (
      phoneDescribe.getType() != Schema.DisplayType.PHONE &&
      phoneDescribe.getType() != Schema.DisplayType.STRING
    ) {
      throw new AuraHandledException(
        'The phone field must be a phone or text field.'
      );
    }
    mapping.Phone_Field__c = phoneDescribe.getName();
    mapping.Phone_Field_Label__c = phoneDescribe.getLabel();

    if (String.isNotBlank(mapping.Country_Code_Field__c)) {
      SObjectField countryField = objectDescribe.fields.getMap()
        .get(mapping.Country_Code_Field__c.toLowerCase());
      if (countryField == null) {
        throw new AuraHandledException(
          'Unknown country code field: ' + mapping.Country_Code_Field__c
        );
      }
      mapping.Country_Code_Field__c = countryField.getDescribe().getName();
    }
    if (String.isNotBlank(mapping.Name_Field__c)) {
      SObjectField nameField = objectDescribe.fields.getMap()
        .get(mapping.Name_Field__c.toLowerCase());
      if (nameField == null) {
        throw new AuraHandledException(
          'Unknown name field: ' + mapping.Name_Field__c
        );
      }
      mapping.Name_Field__c = nameField.getDescribe().getName();
    }
    if (String.isBlank(mapping.Name)) {
      mapping.Name =
        mapping.Object_API_Name__c +
        ' - ' +
        mapping.Phone_Field__c;
    }
    if (mapping.Priority__c == null) {
      mapping.Priority__c = 1;
    }
    upsert mapping;
    return mapping;
  }

  @AuraEnabled
  public static void deleteMapping(Id mappingId) {
    assertAdmin();
    if (mappingId == null) {
      return;
    }
    delete [SELECT Id FROM WhatsApp_Object_Mapping__c WHERE Id = :mappingId];
  }

  @AuraEnabled(cacheable=true)
  public static List<WhatsApp_Routing_Rule__c> getRules() {
    assertAdmin();
    return [
      SELECT
        Id,
        Name,
        Description__c,
        Object_API_Name__c,
        Priority__c,
        Is_Active__c,
        Match_Type__c,
        Conditions_JSON__c,
        Actions_JSON__c,
        Stop_On_Match__c,
        Version__c,
        Last_Tested__c,
        Test_Result__c
      FROM WhatsApp_Routing_Rule__c
      ORDER BY Priority__c ASC, Name ASC
    ];
  }

  @AuraEnabled
  public static WhatsApp_Routing_Rule__c saveRule(
    WhatsApp_Routing_Rule__c rule
  ) {
    assertAdmin();
    if (rule == null || String.isBlank(rule.Name)) {
      throw new AuraHandledException('A rule name is required.');
    }
    if (String.isNotBlank(rule.Conditions_JSON__c)) {
      validateJsonArray(rule.Conditions_JSON__c, 'Conditions');
    }
    if (String.isNotBlank(rule.Actions_JSON__c)) {
      validateJsonArray(rule.Actions_JSON__c, 'Actions');
      if (rule.Actions_JSON__c.toLowerCase().contains('sendmessage')) {
        throw new AuraHandledException(
          'Automatic message sending is not allowed. Agents initiate sends.'
        );
      }
    }
    if (rule.Priority__c == null) {
      rule.Priority__c = 10;
    }
    if (String.isBlank(rule.Version__c)) {
      rule.Version__c = '1';
    }
    upsert rule;
    return rule;
  }

  @AuraEnabled
  public static void deleteRule(Id ruleId) {
    assertAdmin();
    if (ruleId == null) {
      return;
    }
    delete [SELECT Id FROM WhatsApp_Routing_Rule__c WHERE Id = :ruleId];
  }

  @AuraEnabled(cacheable=true)
  public static Map<String, Object> getDiagnostics() {
    assertAdmin();
    Map<String, Object> result = new Map<String, Object>();
    result.put(
      'webhookEvents',
      [
        SELECT
          Id,
          Event_Type__c,
          Field__c,
          Status__c,
          Attempts__c,
          Error__c,
          Received_At__c,
          Processed_At__c
        FROM WhatsApp_Webhook_Event__c
        ORDER BY Received_At__c DESC
        LIMIT 20
      ]
    );
    result.put(
      'apiLogs',
      [
        SELECT
          Id,
          Operation__c,
          Method__c,
          Endpoint__c,
          Status_Code__c,
          Duration_Ms__c,
          Error_Code__c,
          FBTrace_Id__c,
          Created_At__c
        FROM WhatsApp_API_Log__c
        ORDER BY Created_At__c DESC
        LIMIT 20
      ]
    );
    result.put(
      'queueDepth',
      [
        SELECT COUNT()
        FROM WhatsApp_Outbound_Queue__c
        WHERE Status__c IN ('Queued', 'Retry')
      ]
    );
    result.put(
      'failedWebhooks',
      [SELECT COUNT() FROM WhatsApp_Webhook_Event__c WHERE Status__c = 'Failed']
    );
    result.put(
      'failedMessages',
      [SELECT COUNT() FROM WhatsApp_Message__c WHERE Status__c = 'Failed']
    );
    return result;
  }

  private static void validateJsonArray(String value, String label) {
    try {
      Object parsed = JSON.deserializeUntyped(value);
      if (!(parsed instanceof List<Object>)) {
        throw new AuraHandledException(label + ' must be a JSON array.');
      }
    } catch (AuraHandledException e) {
      throw e;
    } catch (Exception e) {
      throw new AuraHandledException(label + ' is not valid JSON.');
    }
  }

  private static String mask(String value) {
    if (String.isBlank(value)) {
      return null;
    }
    if (value.length() <= 4) {
      return '****';
    }
    return '****' + value.substring(value.length() - 4);
  }
}
