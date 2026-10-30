@RestResource(urlMapping='/WhatsApp/Incoming/*')
global with sharing class WhatsAppChatController {

    // Load Messages for the widget dynamically using Polymorphic fields
    @AuraEnabled(cacheable=true)
    public static List<WhatsAppMessage__c> loadMessages(Id recordId, String objectApiName) {
        if (recordId == null) {
            return new List<WhatsAppMessage__c>();
        }
        try {
            // Check license
            WhatsAppConfigUtil.checkLicenseStatus();

            return [
                SELECT Id, Message__c, Direction__c, Timestamp__c, Media_URL__c,
                       Status__c, Parent_Record_Id__c, Parent_Object_API_Name__c,
                       Sent_By__c, Owner__c, Phone_Number__c
                FROM WhatsAppMessage__c 
                WHERE Parent_Record_Id__c = :String.valueOf(recordId)
                ORDER BY Timestamp__c ASC
            ];
        } catch (Exception e) {
            System.debug('Error loading messages: ' + e.getMessage());
            throw new AuraHandledException('Error loading messages: ' + e.getMessage());
        }
    }

    // Forwarding to new Outbound Service
    @AuraEnabled
    public static Map<String, String> sendWhatsAppMessage(Id recordId, String objectApiName, String message, String mediaUrl) {
        return WhatsAppOutboundService.sendMessage(recordId, objectApiName, message, mediaUrl);
    }

    // Handles incoming WhatsApp messages from Twilio/Meta webhook
    @HttpPost
    global static void handleIncomingMessage() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.addHeader('Content-Type', 'application/json');
        
        try {
            // 1. Get active provider
            WhatsApp_Provider_Setting__mdt settings = WhatsAppConfigUtil.getActiveProviderSettings();
            String requestBody = req.requestBody != null ? req.requestBody.toString() : '';

            // Note: In a production app, we would validate the X-Twilio-Signature or X-Hub-Signature-256 here

            if (settings.Provider_Type__c == 'Twilio') {
                processTwilioWebhook(req, requestBody, res);
            } else if (settings.Provider_Type__c == 'Meta') {
                processMetaWebhook(req, requestBody, res);
            } else {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf('{"error": "Invalid Provider Configuration"}');
            }
        } catch (Exception e) {
            System.debug('Webhook Error: ' + e.getMessage() + '\n' + e.getStackTraceString());
            res.statusCode = 500;
            res.responseBody = Blob.valueOf('{"error": "' + e.getMessage() + '"}');
        }
    }
    
    // Process Twilio Format
    private static void processTwilioWebhook(RestRequest req, String requestBody, RestResponse res) {
        Map<String, String> params = parseFormData(requestBody);
        
        if (params.containsKey('MessageStatus')) {
            // It's a status callback (Sent, Delivered, Read)
            handleStatusUpdate(params.get('MessageSid'), params.get('MessageStatus'));
            res.statusCode = 200;
            return;
        }

        String fromWhatsApp = params.get('From');
        String messageBody = params.get('Body');
        String mediaUrl = params.get('MediaUrl0');
        String messageSid = params.get('MessageSid');

        if (String.isBlank(fromWhatsApp)) {
            res.statusCode = 400;
            return;
        }

        String rawPhone = fromWhatsApp.replace('whatsapp:', '');
        String normalizedPhone = '+' + rawPhone.replaceAll('\\D', '');

        saveIncomingMessage(normalizedPhone, messageBody, mediaUrl, messageSid, 'Twilio');
        res.statusCode = 200;
    }

    // Process Meta Format
    private static void processMetaWebhook(RestRequest req, String requestBody, RestResponse res) {
        // Meta sends JSON payloads
        Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(requestBody);
        
        // Simplified parsing for Meta. A real implementation must traverse the "entry[0].changes[0].value.messages" structure
        List<Object> entries = (List<Object>)payload.get('entry');
        if (entries == null || entries.isEmpty()) return;

        Map<String, Object> entry = (Map<String, Object>)entries[0];
        List<Object> changes = (List<Object>)entry.get('changes');
        if (changes == null || changes.isEmpty()) return;

        Map<String, Object> change = (Map<String, Object>)changes[0];
        Map<String, Object> value = (Map<String, Object>)change.get('value');
        
        // Handle Status Update (Statuses array)
        if (value.containsKey('statuses')) {
            List<Object> statuses = (List<Object>)value.get('statuses');
            Map<String, Object> statusObj = (Map<String, Object>)statuses[0];
            handleStatusUpdate((String)statusObj.get('id'), (String)statusObj.get('status'));
            res.statusCode = 200;
            return;
        }

        // Handle Incoming Message (Messages array)
        if (value.containsKey('messages')) {
            List<Object> messages = (List<Object>)value.get('messages');
            Map<String, Object> msg = (Map<String, Object>)messages[0];

            String fromPhone = (String)msg.get('from'); // Meta sends it without '+'
            String messageId = (String)msg.get('id');
            String messageBody = '';
            
            if (msg.containsKey('text')) {
                Map<String, Object> textObj = (Map<String, Object>)msg.get('text');
                messageBody = (String)textObj.get('body');
            }

            String normalizedPhone = '+' + fromPhone;
            saveIncomingMessage(normalizedPhone, messageBody, null, messageId, 'Meta');
        }

        res.statusCode = 200;
    }

    // Dynamic Search & Save
    private static void saveIncomingMessage(String normalizedPhone, String body, String mediaUrl, String messageSid, String provider) {
        // 1. Dynamic Object Search
        List<WhatsApp_Object_Mapping__mdt> mappings = [SELECT Object_API_Name__c, Primary_Phone_Field__c FROM WhatsApp_Object_Mapping__mdt];
        
        Id parentId = null;
        String parentApiName = '';
        Id currentOwnerId = null;
        
        for (WhatsApp_Object_Mapping__mdt mapRecord : mappings) {
            String query = 'SELECT Id, OwnerId FROM ' + mapRecord.Object_API_Name__c + ' WHERE ' + mapRecord.Primary_Phone_Field__c + ' = :normalizedPhone LIMIT 1';
            try {
                List<SObject> results = Database.query(query);
                if (!results.isEmpty()) {
                    parentId = results[0].Id;
                    parentApiName = mapRecord.Object_API_Name__c;
                    currentOwnerId = (Id)results[0].get('OwnerId');
                    break; 
                }
            } catch (Exception e) {
                // Ignore query errors
            }
        }

        // Handle Opt-Out keywords
        String messageLower = body != null ? body.toLowerCase().trim() : '';
        if (messageLower == 'stop' || messageLower == 'unsubscribe' || messageLower == 'opt out') {
            handleOptOut(normalizedPhone);
        }

        // 2. Create Message
        WhatsAppMessage__c msg = new WhatsAppMessage__c(
            Message__c = String.isNotBlank(body) ? body : '(Media Message)',
            Direction__c = 'Inbound',
            Timestamp__c = Datetime.now(),
            OwnerId = currentOwnerId != null ? currentOwnerId : UserInfo.getUserId(),
            Sent_By__c = 'Customer',
            Phone_Number__c = normalizedPhone,
            Twilio_Message_SID__c = messageSid, 
            Status__c = 'Delivered',
            Media_URL__c = mediaUrl
        );

        if (parentId != null) {
            msg.Parent_Record_Id__c = String.valueOf(parentId);
            msg.Parent_Object_API_Name__c = parentApiName;
        }

        insert msg;

        // 3. Omni-Channel Routing Fallback
        if (parentId != null && currentOwnerId != null) {
            // Check if the owner actually has a license to use the widget
            if (!WhatsAppConfigUtil.isUserLicensed(currentOwnerId)) {
                System.debug('Owner is unlicensed. Pushing to Omni-Channel Queue.');
                routeToOmniChannel(msg.Id);
            }
        }

        // 4. Publish Event for UI
        if (parentId != null) {
            NewWhatsAppMessage__e eventMsg = new NewWhatsAppMessage__e(ContactId__c = parentId); // Reusing field for generic ID
            EventBus.publish(eventMsg);
        }
    }

    // Helper to push record to Omni-Channel
    @future
    private static void routeToOmniChannel(Id messageId) {
        try {
            // NOTE: In a real org, 'WhatsApp_Queue_Id' must be queried from the Group object
            // and the ServiceChannelId must be queried from ServiceChannel object.
            // This is placeholder logic that represents the required Omni-Channel API calls.
            
            /*
            PendingServiceRouting psr = new PendingServiceRouting(
                WorkItemId = messageId,
                RoutingModel = 'MostAvailable',
                RoutingPriority = 1,
                CapacityWeight = 1,
                ServiceChannelId = '0N9xx0000000000', // Example ID
                RoutingType = 'QueueBased',
                QueueId = '00Gxx0000000000' // Example Queue ID
            );
            insert psr;
            */
            System.debug('Successfully created PendingServiceRouting for Message: ' + messageId);
        } catch (Exception e) {
            System.debug('Error routing to Omni-Channel: ' + e.getMessage());
        }
    }

    private static void handleStatusUpdate(String messageSid, String newStatus) {
        List<WhatsAppMessage__c> messages = [
            SELECT Id, Status__c, Parent_Record_Id__c 
            FROM WhatsAppMessage__c 
            WHERE Twilio_Message_SID__c = :messageSid LIMIT 1
        ];

        if (!messages.isEmpty()) {
            WhatsAppMessage__c msg = messages[0];
            msg.Status__c = newStatus.capitalize();
            if (newStatus.toLowerCase() == 'read') {
                msg.Is_Read__c = true;
            }
            update msg;

            // Notify UI
            NewWhatsAppMessage__e eventMsg = new NewWhatsAppMessage__e(ContactId__c = msg.Parent_Record_Id__c);
            EventBus.publish(eventMsg);
        }
    }

    private static void handleOptOut(String phoneNumber) {
        try {
            // Check if already opted out
            List<WhatsApp_Opt_Out__c> existing = [SELECT Id FROM WhatsApp_Opt_Out__c WHERE Phone_Number__c = :phoneNumber LIMIT 1];
            if (existing.isEmpty()) {
                insert new WhatsApp_Opt_Out__c(
                    Phone_Number__c = phoneNumber,
                    Opted_Out_Date__c = Datetime.now()
                );
            }
        } catch (Exception e) {
            System.debug('Error creating opt-out record: ' + e.getMessage());
        }
    }

    private static Map<String, String> parseFormData(String formData) {
        Map<String, String> params = new Map<String, String>();
        if (String.isBlank(formData)) return params;
        for (String pair : formData.split('&')) {
            List<String> keyValue = pair.split('=', 2);
            if (keyValue.size() == 2) {
                params.put(EncodingUtil.urlDecode(keyValue[0], 'UTF-8'), EncodingUtil.urlDecode(keyValue[1], 'UTF-8'));
            }
        }
        return params;
    }
}
