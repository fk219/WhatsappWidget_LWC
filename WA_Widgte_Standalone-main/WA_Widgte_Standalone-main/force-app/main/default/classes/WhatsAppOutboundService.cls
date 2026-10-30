public with sharing class WhatsAppOutboundService {

    // Main entry point for sending a message
    @AuraEnabled
    public static Map<String, String> sendMessage(Id recordId, String objectApiName, String message, String mediaUrl) {
        // 1. Check License & App Status
        WhatsAppConfigUtil.checkLicenseStatus();

        if (recordId == null || String.isBlank(message)) {
            throw new AuraHandledException('Record ID and message are required.');
        }

        // 2. Get Object Mapping & Phone Number dynamically
        WhatsApp_Object_Mapping__mdt mapping = WhatsAppConfigUtil.getObjectMapping(objectApiName);
        String phoneField = mapping.Primary_Phone_Field__c;
        String countryCodeField = mapping.Country_Code_Field__c;

        String query = 'SELECT Id, ' + phoneField;
        if (String.isNotBlank(countryCodeField)) {
            query += ', ' + countryCodeField;
        }
        query += ' FROM ' + String.escapeSingleQuotes(objectApiName) + ' WHERE Id = \'' + String.escapeSingleQuotes(String.valueOf(recordId)) + '\' LIMIT 1';

        List<SObject> records = Database.query(query);
        if (records.isEmpty()) {
            throw new AuraHandledException('Record not found.');
        }

        SObject record = records[0];
        String rawPhone = (String)record.get(phoneField);
        String rawCountryCode = String.isNotBlank(countryCodeField) ? (String)record.get(countryCodeField) : '';

        if (String.isBlank(rawPhone)) {
            throw new AuraHandledException('Phone number is missing on this record.');
        }

        // Combine and normalize phone number
        String combinedPhone = (String.isNotBlank(rawCountryCode) ? rawCountryCode : '') + rawPhone;
        String toPhoneNumber = normalizePhone(combinedPhone);

        // Check if customer opted out
        List<WhatsApp_Opt_Out__c> optOuts = [SELECT Id FROM WhatsApp_Opt_Out__c WHERE Phone_Number__c = :toPhoneNumber LIMIT 1];
        if (!optOuts.isEmpty()) {
            throw new AuraHandledException('This customer has opted out of WhatsApp messages. Outbound messages are blocked.');
        }

        // 3. Get Active Provider Settings
        WhatsApp_Provider_Setting__mdt settings = WhatsAppConfigUtil.getActiveProviderSettings();
        
        HttpResponse response;
        String messageSid;
        String status;

        // 4. Route to the correct API provider
        try {
            if (settings.Provider_Type__c == 'Twilio') {
                response = sendViaTwilio(settings, toPhoneNumber, message, mediaUrl);
            } else if (settings.Provider_Type__c == 'Meta') {
                response = sendViaMeta(settings, toPhoneNumber, message, mediaUrl);
            } else {
                throw new AuraHandledException('Invalid Provider Type configured.');
            }

            // 5. Parse Response & Save Record
            if (response.getStatusCode() == 201 || response.getStatusCode() == 200) {
                Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
                
                if (settings.Provider_Type__c == 'Twilio') {
                    messageSid = (String)responseBody.get('sid');
                    status = (String)responseBody.get('status');
                } else if (settings.Provider_Type__c == 'Meta') {
                    // Meta response format: {"messages": [{"id": "wamid.xxxx"}]}
                    List<Object> messages = (List<Object>)responseBody.get('messages');
                    if (messages != null && !messages.isEmpty()) {
                        Map<String, Object> msgData = (Map<String, Object>)messages[0];
                        messageSid = (String)msgData.get('id');
                    }
                    status = 'sent'; // Meta doesn't return status in the immediate response, relies on webhooks
                }

                // Save polymorphic message record
                WhatsAppMessage__c msgRecord = new WhatsAppMessage__c(
                    Parent_Record_Id__c = String.valueOf(recordId),
                    Parent_Object_API_Name__c = objectApiName,
                    Message__c = message,
                    Direction__c = 'Outbound',
                    Timestamp__c = Datetime.now(),
                    OwnerId = UserInfo.getUserId(),
                    Sent_By__c = UserInfo.getName(),
                    Phone_Number__c = toPhoneNumber,
                    Media_URL__c = mediaUrl,
                    Twilio_Message_SID__c = messageSid,
                    Status__c = status != null ? status.capitalize() : 'Sent'
                );
                insert msgRecord;

                // Fire Platform Event
                NewWhatsAppMessage__e eventMsg = new NewWhatsAppMessage__e(ContactId__c = recordId); // Reusing ContactId__c field on event for generic ID for now
                EventBus.publish(eventMsg);

                return new Map<String, String>{
                    'id' => msgRecord.Id,
                    'status' => status != null ? status.capitalize() : 'Sent'
                };
            } else {
                throw new CalloutException('API Error: ' + response.getStatusCode() + ' - ' + response.getBody());
            }
        } catch (Exception e) {
            throw new AuraHandledException('Failed to send message: ' + e.getMessage());
        }
    }

    // --- TWILIO IMPLEMENTATION ---
    private static HttpResponse sendViaTwilio(WhatsApp_Provider_Setting__mdt settings, String toPhone, String message, String mediaUrl) {
        String endpoint = 'https://api.twilio.com/2010-04-01/Accounts/' + settings.Twilio_Account_SID__c + '/Messages.json';
        String fromPhone = 'whatsapp:' + settings.Business_Phone_Number__c;
        String toPhoneFormatted = 'whatsapp:' + toPhone;

        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint(endpoint);
        req.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(settings.Twilio_Account_SID__c + ':' + settings.Twilio_Auth_Token__c)));
        req.setHeader('Content-Type', 'application/x-www-form-urlencoded');

        String body = 'From=' + EncodingUtil.urlEncode(fromPhone, 'UTF-8') + 
                      '&To=' + EncodingUtil.urlEncode(toPhoneFormatted, 'UTF-8') + 
                      '&Body=' + EncodingUtil.urlEncode(message, 'UTF-8');
        
        if (String.isNotBlank(mediaUrl)) {
            body += '&MediaUrl=' + EncodingUtil.urlEncode(mediaUrl, 'UTF-8');
        }
        
        req.setBody(body);
        return new Http().send(req);
    }

    // --- META OFFICIAL API IMPLEMENTATION ---
    private static HttpResponse sendViaMeta(WhatsApp_Provider_Setting__mdt settings, String toPhone, String message, String mediaUrl) {
        String endpoint = 'https://graph.facebook.com/v17.0/' + settings.Phone_Number_ID__c + '/messages';
        
        // Meta requires the phone number without the '+'
        String toPhoneClean = toPhone.replace('+', '');

        HttpRequest req = new HttpRequest();
        req.setMethod('POST');
        req.setEndpoint(endpoint);
        req.setHeader('Authorization', 'Bearer ' + settings.Meta_Access_Token__c);
        req.setHeader('Content-Type', 'application/json');

        Map<String, Object> payload = new Map<String, Object>{
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => toPhoneClean
        };

        if (String.isNotBlank(mediaUrl)) {
            // Very simplified media handling for Meta API. Real implementation needs to detect image/video/document
            payload.put('type', 'image');
            payload.put('image', new Map<String, Object>{
                'link' => mediaUrl,
                'caption' => message
            });
        } else {
            payload.put('type', 'text');
            payload.put('text', new Map<String, Object>{
                'preview_url' => false,
                'body' => message
            });
        }

        req.setBody(JSON.serialize(payload));
        return new Http().send(req);
    }

    // Helper: Normalize Phone
    private static String normalizePhone(String phoneNumber) {
        if (String.isBlank(phoneNumber)) return '';
        String normalized = phoneNumber.replaceAll('[^0-9]', '');
        if (normalized.length() == 10) {
            normalized = '1' + normalized;
        } else if (normalized.length() > 10 && !normalized.startsWith('1')) {
            if (normalized.startsWith('0')) {
                normalized = '1' + normalized.substring(1);
            } else {
                normalized = '1' + normalized; // Assumes US if no country code provided, simplistic
            }
        }
        if (!normalized.startsWith('+')) {
            normalized = '+' + normalized;
        }
        return normalized;
    }
}
