global class WhatsAppArchiveBatch implements Database.Batchable<sObject>, Schedulable {
    
    // In a real app, this value would come from the Admin Dashboard Custom Setting
    private Integer monthsToKeepMedia = 6;
    private Integer monthsToKeepMessages = 12;

    global Database.QueryLocator start(Database.BatchableContext bc) {
        // Query messages older than retention period
        Datetime messageCutoff = Datetime.now().addMonths(-monthsToKeepMessages);
        
        // This query just finds the old messages to delete.
        return Database.getQueryLocator([
            SELECT Id, Media_URL__c 
            FROM WhatsAppMessage__c 
            WHERE Timestamp__c < :messageCutoff
        ]);
    }

    global void execute(Database.BatchableContext bc, List<WhatsAppMessage__c> scope) {
        try {
            // Delete the records
            delete scope;
            
            // Note: If media files were stored in ContentDocumentLink against these messages,
            // we would also query and delete those ContentDocuments here to save file storage.
        } catch (Exception e) {
            System.debug('Error in WhatsAppArchiveBatch: ' + e.getMessage());
        }
    }

    global void finish(Database.BatchableContext bc) {
        System.debug('WhatsAppArchiveBatch completed successfully.');
    }
    
    // Schedulable interface implementation so Admin can schedule it
    global void execute(SchedulableContext sc) {
        WhatsAppArchiveBatch batch = new WhatsAppArchiveBatch();
        Database.executeBatch(batch, 200);
    }
}
