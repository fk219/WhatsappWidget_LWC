public with sharing class WhatsAppConfigUtil {
    
    // Check if the current user has the correct license and if the app is active
    public static void checkLicenseStatus() {
        // 1. Check Custom Setting for global lock
        App_License_Status__c licenseStatus = App_License_Status__c.getOrgDefaults();
        if (licenseStatus != null && licenseStatus.Status__c == 'LOCKED') {
            throw new AuraHandledException('Your subscription has expired. Please contact billing.');
        }

        // 2. Check User License
        if (!isUserLicensed(UserInfo.getUserId())) {
            throw new AuraHandledException('You do not have a license to use this widget.');
        }
    }

    // Helper to check if a specific user is licensed
    public static Boolean isUserLicensed(Id userId) {
        // In a real managed package, this would be: return UserInfo.isCurrentUserLicensed('namespace');
        // Or checking a specific Custom Permission assignment for the given userId.
        // For development, we'll assume it's true or use a custom permission.
        return true; 
    }

    // Get the active provider settings from Custom Metadata
    public static WhatsApp_Provider_Setting__mdt getActiveProviderSettings() {
        // Query the first record. In a real scenario, you might have a "Is_Active__c" checkbox, 
        // but for now we'll assume there is only one configuration record intended to be used.
        List<WhatsApp_Provider_Setting__mdt> settings = [
            SELECT Provider_Type__c, Twilio_Account_SID__c, Twilio_Auth_Token__c, 
                   Meta_App_ID__c, Meta_Access_Token__c, Phone_Number_ID__c, Business_Phone_Number__c
            FROM WhatsApp_Provider_Setting__mdt 
            LIMIT 1
        ];
        
        if (settings.isEmpty()) {
            throw new AuraHandledException('WhatsApp Provider Settings are not configured.');
        }
        return settings[0];
    }

    // Get the object mapping for a specific Object API Name
    public static WhatsApp_Object_Mapping__mdt getObjectMapping(String objectApiName) {
        List<WhatsApp_Object_Mapping__mdt> mappings = [
            SELECT Object_API_Name__c, Primary_Phone_Field__c, Country_Code_Field__c
            FROM WhatsApp_Object_Mapping__mdt
            WHERE Object_API_Name__c = :objectApiName
            LIMIT 1
        ];
        
        if (mappings.isEmpty()) {
            throw new AuraHandledException('WhatsApp mapping is not configured for object: ' + objectApiName);
        }
        return mappings[0];
    }
}
