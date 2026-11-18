/**
 * Typed access to org-wide WhatsApp settings and credentials.
 *
 * Credentials live in WhatsApp_Credential__c (private object, Long Text Area)
 * because Custom Settings cannot store more than 255 characters and protected
 * Custom Metadata cannot be DML'd from the admin UI.
 */
public without sharing class WhatsAppSettingsService {
  public static WhatsApp_Settings__c getSettings() {
    WhatsApp_Settings__c settings = WhatsApp_Settings__c.getOrgDefaults();
    return settings == null ? new WhatsApp_Settings__c() : settings;
  }

  public static WhatsApp_Credential__c getActiveCredential() {
    List<WhatsApp_Credential__c> credentials = [
      SELECT
        Id,
        Label__c,
        Provider__c,
        App_Id__c,
        Messaging_Account_Id__c,
        Phone_Number_Id__c,
        Access_Token__c,
        App_Secret__c,
        Verify_Token__c,
        Token_Expiry__c,
        Is_Active__c
      FROM WhatsApp_Credential__c
      WHERE Is_Active__c = TRUE
      ORDER BY LastModifiedDate DESC
      LIMIT 1
    ];
    if (credentials.isEmpty()) {
      throw new WhatsAppException(
        'WhatsApp credentials are not configured. Open WhatsApp Setup and connect a Meta account.'
      );
    }
    return credentials[0];
  }

  public static String getGraphVersion() {
    WhatsApp_Settings__c settings = getSettings();
    return String.isNotBlank(settings.Graph_API_Version__c)
      ? settings.Graph_API_Version__c
      : WhatsAppConstants.GRAPH_API_VERSION_DEFAULT;
  }

  public static String getBaseUrl() {
    return WhatsAppConstants.GRAPH_API_HOST + '/' + getGraphVersion();
  }

  public static String getAccessToken() {
    String token = getActiveCredential().Access_Token__c;
    if (String.isBlank(token)) {
      throw new WhatsAppException(
        'The Meta access token is missing. Update WhatsApp Setup.'
      );
    }
    return token;
  }

  public static String getAppSecret() {
    String secret = getActiveCredential().App_Secret__c;
    if (String.isBlank(secret)) {
      throw new WhatsAppException(
        'The Meta app secret is missing. Update WhatsApp Setup.'
      );
    }
    return secret;
  }

  public static String getVerifyToken() {
    String token = getActiveCredential().Verify_Token__c;
    if (String.isBlank(token)) {
      throw new WhatsAppException(
        'The webhook verify token is missing. Update WhatsApp Setup.'
      );
    }
    return token;
  }

  public static String getDefaultPhoneNumberId() {
    return getActiveCredential().Phone_Number_Id__c;
  }

  public static String getDefaultMessagingAccountId() {
    return getActiveCredential().Messaging_Account_Id__c;
  }
}
