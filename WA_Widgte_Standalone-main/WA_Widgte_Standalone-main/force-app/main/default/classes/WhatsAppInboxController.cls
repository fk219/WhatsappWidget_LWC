public with sharing class WhatsAppInboxController {
    
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getActiveConversations() {
        // Query the most recent messages per Parent_Record_Id__c
        // This is a simplified approach. For production with huge data volumes,
        // it's better to maintain a "WhatsApp_Session__c" object to query directly.
        List<AggregateResult> results = [
            SELECT Parent_Record_Id__c, Parent_Object_API_Name__c, MAX(Timestamp__c) lastMsg
            FROM WhatsAppMessage__c
            WHERE OwnerId = :UserInfo.getUserId()
            GROUP BY Parent_Record_Id__c, Parent_Object_API_Name__c
            ORDER BY MAX(Timestamp__c) DESC
            LIMIT 50
        ];
        
        List<Map<String, String>> conversations = new List<Map<String, String>>();
        for (AggregateResult ar : results) {
            Map<String, String> conv = new Map<String, String>();
            conv.put('recordId', (String)ar.get('Parent_Record_Id__c'));
            conv.put('objectApiName', (String)ar.get('Parent_Object_API_Name__c'));
            
            // Format timestamp simply
            Datetime dt = (Datetime)ar.get('lastMsg');
            conv.put('lastMessageTime', dt.format('h:mm a'));
            
            // In a real app, we would query the actual record Name dynamically
            conv.put('name', 'Record: ' + ((String)ar.get('Parent_Record_Id__c')).substring(0, 5) + '...');
            
            conversations.add(conv);
        }
        
        return conversations;
    }
}
