import { LightningElement, track, wire } from 'lwc';
import getActiveConversations from '@salesforce/apex/WhatsAppInboxController.getActiveConversations';

export default class WhatsappInbox extends LightningElement {
    @track conversations = [];
    @track selectedRecordId = null;
    @track selectedObjectApiName = null;
    @track isLoading = true;

    connectedCallback() {
        this.loadConversations();
    }

    loadConversations() {
        this.isLoading = true;
        getActiveConversations()
            .then(result => {
                this.conversations = result;
                this.isLoading = false;
            })
            .catch(error => {
                console.error('Error loading conversations', error);
                this.isLoading = false;
            });
    }

    handleConversationSelect(event) {
        const recordId = event.currentTarget.dataset.id;
        const objectApiName = event.currentTarget.dataset.object;
        
        this.selectedRecordId = recordId;
        this.selectedObjectApiName = objectApiName;
        
        // The embedded c-whatsapp-chat-widget handles fetching its own messages 
        // when its @api recordId changes.
    }

    getConversationClass(recordId) {
        return this.selectedRecordId === recordId ? 'conversation-item active' : 'conversation-item';
    }
}
