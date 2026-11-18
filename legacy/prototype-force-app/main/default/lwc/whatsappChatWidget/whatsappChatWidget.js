import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import loadMessages from '@salesforce/apex/WhatsAppChatController.loadMessages';
import sendWhatsAppMessage from '@salesforce/apex/WhatsAppChatController.sendWhatsAppMessage';
// Removed specific getContactDetails call since we are dynamic now

const MESSAGES_PER_LOAD = 20;
const CHANNEL_NAME = '/event/NewWhatsAppMessage__e';

export default class WhatsappChatWidget extends LightningElement {
    // Public API properties to make component dynamic on any record page
    @api recordId;
    @api objectApiName;

    // Private fields
    _subscription = null;
    _recordId;

    // Tracked properties
    @track isChatOpen = false;
    @track messages = [];
    @track currentMessage = '';
    @track mediaUrl = '';
    @track recordName = 'WhatsApp Chat';
    @track recordInitials = 'WA';
    @track isLoading = false;
    @track showLoadMoreButton = false;
    @track showNoMessages = false;
    @track showStartConversationButton = false;
    @track showMediaInput = false;
    @track hasUnreadMessages = false;
    @track unreadCount = 0;
    @track offset = 0;
    @track totalMessages = 0;
    @track messageIds = new Set();
    @track lastMessageTimestamp = null;
    
    // 24-Hour Rule specific tracking
    @track is24HourWindowOpen = true;
    @track timeRemainingDisplay = '';
    _timerInterval;

    connectedCallback() {
        console.log('WhatsappChatWidget connected. recordId:', this.recordId, ' object:', this.objectApiName);
        this.initializeEmpApi();
        this.subscribeToMessageEvents();
        this.initializeChat();
        
        // Start the countdown timer for the 24h rule
        this._timerInterval = setInterval(() => this.calculate24HourWindow(), 60000); // Check every minute
    }

    disconnectedCallback() {
        this.unsubscribeFromMessageEvents();
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
    }

    getStatusIconForMessage(message) {
        if (!message) return '';
        
        const status = message.Status__c || '';
        const isRead = message.Is_Read__c;
        
        // Inline SVGs for each status
        const icons = {
            pending: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" fill="#8696A0"/></svg>',
            sent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8696A0"/></svg>',
            delivered: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 7l-8 8-4-4-1.41 1.41L10 17.17l9-9z" fill="#8696A0"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#8696A0"/></svg>',
            read: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 7l-8 8-4-4-1.41 1.41L10 17.17l9-9z" fill="#53BDEB"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#53BDEB"/></svg>'
        };
        
        // Map status to icon
        if (isRead) {
            return icons.read;
        } else if (status === 'delivered' || status === 'Delivered') {
            return icons.delivered;
        } else if (status === 'sent' || status === 'Sent') {
            return icons.sent;
        } else {
            return icons.pending; // For queued or other statuses
        }
    }

    // Platform Events subscription
    subscribeToMessageEvents = async () => {
        if (this._subscription) {
            console.log('Already subscribed to message events');
            return;
        }

        try {
            // Subscribe to the channel
            this._subscription = await subscribe(CHANNEL_NAME, -1, (message) => {
                console.log('Received platform event:', message);
                if (message && message.data && message.data.payload) {
                    this.handleNewMessage(message);
                }
            });

            // Register error handler
            onError((error) => {
                console.error('EmpApi error:', error);
                this.handleSubscriptionError();
            });

            console.log('Successfully subscribed to message events');
        } catch (error) {
            console.error('Failed to subscribe to message events:', error);
            this.showToast('Warning', 'Real-time updates may be delayed', 'warning');
        }
    }

    // Handle subscription errors
    handleSubscriptionError = () => {
        if (this._subscription) {
            this.showToast('Warning', 'Reconnecting...', 'warning');
            this.unsubscribeFromMessageEvents()
                .then(() => this.subscribeToMessageEvents())
                .catch(error => {
                    console.error('Resubscription failed:', error);
                    this.showToast('Error', 'Please refresh the page', 'error');
                });
        }
    }

    // Method to unsubscribe from Platform Events
    unsubscribeFromMessageEvents = async () => {
        if (this._subscription) {
            try {
                await unsubscribe(this._subscription);
                console.log('Unsubscribed from message events');
                this._subscription = null;
            } catch (error) {
                console.error('Error unsubscribing from message events:', error);
            }
        }
    }

    // Handle new messages from Platform Events
    handleNewMessage = (messageEvent) => {
        if (messageEvent && messageEvent.data && messageEvent.data.payload) {
            const message = messageEvent.data.payload;
            this.messages = [...this.messages, message];
            this.scrollToBottom();
        }
    }
    @track isChatOpen = false;
    @track currentContactId = null;
    @track messages = [];
    @track currentMessage = '';
    @track mediaUrl = '';
    @track contactName = 'WhatsApp Chat';
    @track contactInitials = 'WC';
    @track isLoading = false;
    @track showLoadMoreButton = false;
    @track showNoMessages = false;
    @track showStartConversationButton = false;
    @track showMediaInput = false;
    @track hasUnreadMessages = false;
    @track unreadCount = 0;
    @track offset = 0;
    @track totalMessages = 0;
    @track messageIds = new Set();
    @track lastMessageTimestamp = null;
    formatDateForSeparator(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        // If the message is from today
        if (messageDate.getTime() === today.getTime()) {
            return 'TODAY';
        }
        
        // If the message is from yesterday
        if (messageDate.getTime() === yesterday.getTime()) {
            return 'YESTERDAY';
        }
        
        // If it's from this year, show date without year
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString('en-US', { 
                month: 'long',
                day: 'numeric'
            }).toUpperCase();
        }
        
        // Otherwise show full date
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }).toUpperCase();
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    shouldShowDateSeparator(currentMsg, previousMsg) {
        if (!previousMsg) return true;
        
        const currentDate = new Date(currentMsg.Timestamp__c);
        const previousDate = new Date(previousMsg.Timestamp__c);
        
        return currentDate.toDateString() !== previousDate.toDateString();
    }
    _recordId;
    @track isChatOpen = false;
    @track currentContactId = null; // Track current contact ID
    @track messages = [];
    @track currentMessage = '';
    @track mediaUrl = '';
    @track contactName = 'WhatsApp Chat';
    @track contactInitials = 'WC';
    @track isLoading = false;
    @track showLoadMoreButton = false;
    @track showNoMessages = false;
    @track showStartConversationButton = false;
    @track showMediaInput = false;
    @track hasUnreadMessages = false;
    @track unreadCount = 0;
    @track subscription = null;
    @track offset = 0;
    @track totalMessages = 0;
    @track messageIds = new Set(); // Track message IDs to detect new messages
    @track lastMessageTimestamp = null;

    connectedCallback = async () => {
        console.log('WhatsappChatWidget connected. recordId:', this.recordId);
        
        try {
            // Initialize empApi
            await this.initializeEmpApi();
            // Subscribe to message events
            await this.subscribeToMessageEvents();
            // Initialize chat after subscription is ready
            this.initializeChat();
        } catch (error) {
            console.error('Error in component initialization:', error);
            this.showToast('Error', 'Failed to initialize chat. Please refresh the page.', 'error');
        }
    }

    initializeEmpApi = async () => {
        try {
            // Make sure empApi is ready
            await new Promise((resolve, reject) => {
                const maxAttempts = 10;
                let attempts = 0;
                
                const checkEmpApi = () => {
                    if (subscribe && unsubscribe && onError) {
                        resolve();
                    } else if (attempts < maxAttempts) {
                        attempts++;
                        setTimeout(checkEmpApi, 500);
                    } else {
                        reject(new Error('empApi not available'));
                    }
                };
                
                checkEmpApi();
            });
            
            console.log('EmpApi initialized successfully');
        } catch (error) {
            console.error('Error initializing empApi:', error);
            throw error;
        }
    }

    // Handle recordId changes when switching between contacts
    @api
    set recordId(value) {
        console.log('recordId changed from', this._recordId, 'to', value);
        this._recordId = value;
        this.initializeChat();
    }
    
    get recordId() {
        return this._recordId;
    }

    initializeChat() {
        if (this.recordId) {
            // Reset messages when switching records
            if (this._recordId !== this.recordId) {
                console.log('Record changed, resetting chat state');
                this.messages = [];
                this.messageIds.clear();
                this._recordId = this.recordId;
            }
            
            // We removed fetchContactDetails since it's dynamic now. A generic label is fine for now, or you could query Name dynamically.
            this.recordName = 'WhatsApp Conversation';
            this.recordInitials = 'WA';

            this.loadInitialMessages();
        } else {
            console.warn('recordId is not available.');
            this.showNoMessages = true;
            this.showStartConversationButton = true;
            this.recordName = 'No Record Selected';
        }
    }

    async disconnectedCallback() {
        console.log('Chat widget disconnected, cleaning up...');
        await this.unsubscribeFromMessageEvents();
        this.messages = [];
        this.messageIds.clear();
        this.currentContactId = null;
    }

    async fetchContactDetails() {
        try {
            const contact = await getContactDetails({ contactId: this.recordId });
            if (contact && contact.name) {
                this.contactName = contact.name;
                this.contactInitials = this.getInitials(contact.name);
            } else {
                this.contactName = 'Unknown Contact';
                this.contactInitials = 'UC';
            }
        } catch (error) {
            console.error('Error fetching contact details:', JSON.stringify(error));
            this.showToast('Error', 'Error fetching contact details: ' + this.getErrorMessage(error), 'error');
            this.contactName = 'Error Loading Contact';
            this.contactInitials = 'EC';
        }
    }

    getInitials(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    async loadInitialMessages() {
        if (this.isLoading || !this.recordId) return;
        
        this.isLoading = true;
        console.log('Loading initial messages for record:', this.recordId);
        
        try {
            this.offset = 0;
            const result = await loadMessages({ recordId: this.recordId, objectApiName: this.objectApiName });
            
            if (result && Array.isArray(result)) {
                console.log('Received', result.length, 'messages');
                
                // Update message tracking
                this.messages = result;
                this.messageIds = new Set(result.map(msg => msg.Id));
                this.totalMessages = result.length;
                this.showLoadMoreButton = result.length >= MESSAGES_PER_LOAD;
                
                // Update UI
                this.updateUiBasedOnMessages();
                this.scrollToBottom();
                this.calculate24HourWindow();
            }
        } catch (error) {
            console.error('Error loading initial messages:', error);
            this.showToast('Error', 'Error loading messages: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async loadMoreMessages() {
        if (this.isLoading || !this.recordId) return;
        
        this.isLoading = true;
        const scrollPosition = this.template.querySelector('.chat-messages-container').scrollTop;
        
        try {
            const allMessages = await loadMessages({ recordId: this.recordId, objectApiName: this.objectApiName });
            const currentLength = this.messages.length;
            
            if (allMessages.length > currentLength) {
                // Add new messages to the beginning of the array
                this.messages = allMessages;
                
                // Maintain scroll position after loading more messages
                requestAnimationFrame(() => {
                    const container = this.template.querySelector('.chat-messages-container');
                    const newScrollPosition = container.scrollHeight - container.clientHeight;
                    if (newScrollPosition > 0) {
                        container.scrollTop = scrollPosition;
                    }
                });
            }
        } catch (error) {
            console.error('Error loading more messages:', JSON.stringify(error));
            this.showToast('Error', 'Error loading more messages: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    updateUiBasedOnMessages() {
        if (this.messages && this.messages.length > 0) {
            // Sort messages by timestamp to ensure correct order
            this.messages.sort((a, b) => 
                new Date(a.Timestamp__c) - new Date(b.Timestamp__c)
            );
            
            this.lastMessageTimestamp = this.messages[this.messages.length - 1].Timestamp__c;
            this.showNoMessages = false;
        } else {
            this.lastMessageTimestamp = null;
            this.showNoMessages = true;
        }
        
        this.showStartConversationButton = this.messages.length === 0 || this.isOutside24HourWindow();
        this.renderMessages();
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        
        if (this.isChatOpen) {
            // Reset unread indicators
            this.hasUnreadMessages = false;
            this.unreadCount = 0;
            
            // Load messages and ensure chat is scrolled to bottom
            this.loadInitialMessages().then(() => {
                requestAnimationFrame(() => this.scrollToBottom());
            });
        }
        
        console.log('Chat toggled. isOpen:', this.isChatOpen);
    }

    toggleMediaInput() {
        this.showMediaInput = !this.showMediaInput;
        if (this.showMediaInput) {
            setTimeout(() => {
                const mediaInput = this.template.querySelector('.media-input');
                if (mediaInput) {
                    mediaInput.focus();
                }
            }, 100);
        }
    }

    hideMediaInput() {
        this.showMediaInput = false;
        this.mediaUrl = '';
    }

    renderedCallback() {
        this.resizeTextarea();
    }

    handleMessageChange = (event) => {
        this.currentMessage = event.target.value;
        this.resizeTextarea();
    }

    handleMediaUrlChange = (event) => {
        this.mediaUrl = event.target.value;
    }

    calculate24HourWindow() {
        if (!this.lastMessageTimestamp) {
            this.is24HourWindowOpen = false;
            this.timeRemainingDisplay = 'No recent messages';
            return;
        }

        const lastInboundMsg = [...this.messages].reverse().find(m => m.Direction__c && m.Direction__c.toLowerCase() === 'inbound');
        
        if (!lastInboundMsg) {
            this.is24HourWindowOpen = false;
            this.timeRemainingDisplay = 'No inbound messages. Template required.';
            return;
        }

        const lastTime = new Date(lastInboundMsg.Timestamp__c).getTime();
        const now = Date.now();
        const diffMs = now - lastTime;
        const windowMs = 24 * 60 * 60 * 1000;

        if (diffMs > windowMs) {
            this.is24HourWindowOpen = false;
            this.timeRemainingDisplay = '24-hour window closed. Template required.';
        } else {
            this.is24HourWindowOpen = true;
            const remainingMs = windowMs - diffMs;
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            this.timeRemainingDisplay = `⏱️ ${hours}h ${minutes}m remaining`;
        }
    }

    get isSendButtonDisabledComputed() {
        return (!this.currentMessage.trim() && !this.mediaUrl.trim()) || this.isInputDisabledComputed;
    }
    get isInputDisabledComputed() {
        return this.isLoading || !this.is24HourWindowOpen;
    }

    get inputPlaceholderComputed() {
        if (!this.is24HourWindowOpen) {
            return "24-hour window closed. Use Template.";
        }
        return "Type a message...";
    }

    handleKeyUp = (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !this.isSendButtonDisabledComputed && !this.isLoading) {
            event.preventDefault();
            this.handleSendMessage();
        }
    }

    showToast = (title, message, variant) => {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }

    getErrorMessage = (error) => {
        if (error?.body?.message) {
            return error.body.message;
        }
        if (error?.body?.pageErrors?.[0]?.message) {
            return error.body.pageErrors[0].message;
        }
        return error?.message || 'Unknown error occurred';
    }

    handleSendMessage = async () => {
        if (this.isSendButtonDisabledComputed || !this.recordId) {
            console.log('Cannot send message - invalid state');
            return;
        }

        try {
            // Store current record ID and message content
            const currentRecordId = this.recordId;
            const currentMessage = this.currentMessage.trim();
            const mediaUrl = this.mediaUrl.trim();
            const timestamp = new Date().toISOString();

            // Clear input fields immediately for better UX
            this.currentMessage = '';
            this.mediaUrl = '';
            this.showMediaInput = false;

            // Reset input field height
            const messageInput = this.template.querySelector('.message-input');
            if (messageInput) {
                messageInput.value = '';
                this.resizeTextarea();
            }

        // Create and display temporary message immediately
        const tempMessage = {
            Id: 'temp-' + Date.now(),
            Message__c: currentMessage,
            Direction__c: 'Outbound',
            Parent_Record_Id__c: currentRecordId,
            Timestamp__c: timestamp,
            Status__c: 'sending',
            Sent_By__c: 'You',
            Media_URL__c: mediaUrl || null
        };
        
        // Update UI immediately with optimistic update
        this.messages = [...this.messages, tempMessage];
        this.messageIds.add(tempMessage.Id);
        this.updateUiBasedOnMessages();
        this.scrollToBottom();
        this.showStartConversationButton = false;
        this.showNoMessages = false;
            
            console.log('Sending message for record:', currentRecordId);
            
            try {
                // Send the message to the server
                const result = await sendWhatsAppMessage({
                    recordId: currentRecordId,
                    objectApiName: this.objectApiName,
                    message: currentMessage,
                    mediaUrl: mediaUrl
                });
                
                // Ensure we're still on the same record
                if (this.recordId !== currentRecordId) {
                    console.log('Record changed during message send, aborting update');
                    return;
                }
                
                // Update the temporary message with the real one
                const realMessage = {
                    ...tempMessage,
                    Id: result.id || result.Id, // Handle different response formats
                    Status__c: result.status || 'sent'
                };
                
                // Replace temp message with real one
                this.messages = this.messages.map(msg => 
                    msg.Id === tempMessage.Id ? realMessage : msg
                );
                this.messageIds.delete(tempMessage.Id);
                this.messageIds.add(realMessage.Id);
                
                this.showToast('Success', 'Message sent successfully', 'success');
            } catch (error) {
                // Update UI to show failed status
                this.messages = this.messages.map(msg => 
                    msg.Id === tempMessage.Id 
                        ? { ...msg, Status__c: 'failed' }
                        : msg
                );
                throw error; // Re-throw to be caught by outer catch block
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error', 'Error sending message: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    async handleStartConversation() {
        if (this.isLoading) {
            return;
        }

        this.isLoading = true;
        try {
            await sendTemplateMessage({
                contactId: this.recordId,
                templateName: 'hello_world',
                languageCode: 'en_US'
            });
            this.showToast('Success', 'Conversation started successfully', 'success');
            this.showStartConversationButton = false;
            this.showNoMessages = false;
            
            // Refresh messages
            await this.loadInitialMessages();
        } catch (error) {
            console.error('Error starting conversation:', JSON.stringify(error));
            this.showToast('Error', 'Error starting conversation: ' + this.getErrorMessage(error), 'error');
        } finally {
            this.isLoading = false;
        }
    }

    subscribeToMessageEvents = async () => {
        if (this._subscription) {
            console.log('Already subscribed to message events');
            return;
        }

        try {
            // Subscribe to the channel
            this._subscription = await subscribe(CHANNEL_NAME, -1, (message) => {
                console.log('Received platform event:', message);
                if (message && message.data && message.data.payload) {
                    this.handleNewMessage(message);
                }
            });

            // Register error handler
            onError((error) => {
                console.error('EmpApi error:', error);
                this.handleSubscriptionError();
            });

            console.log('Successfully subscribed to message events');
        } catch (error) {
            console.error('Failed to subscribe to message events:', error);
            this.showToast('Warning', 'Real-time updates may be delayed', 'warning');
        }
    }

    handleSubscriptionError = () => {
        if (this._subscription) {
            this.showToast('Warning', 'Reconnecting...', 'warning');
            this.unsubscribeFromMessageEvents()
                .then(() => this.subscribeToMessageEvents())
                .catch(error => {
                    console.error('Resubscription failed:', error);
                    this.showToast('Error', 'Please refresh the page', 'error');
                });
        }
    }

    // Clear existing error handlers
    clearErrorHandlers() {
        try {
            onError(() => {}); // Clear existing handlers
        } catch (error) {
            console.error('Error clearing error handlers:', error);
        }
    }

    // Register new error handler
    registerErrorHandler() {
        onError((error) => {
            console.error('Error received from empApi:', error);
            
            // Attempt to resubscribe only if we're still connected
            if (this.subscription) {
                this.showToast('Warning', 'Reconnecting to message service...', 'warning');
                
                // Unsubscribe first
                this.unsubscribeFromMessageEvents()
                    .then(() => {
                        // Wait a moment before resubscribing
                        setTimeout(() => {
                            this.subscribeToMessageEvents();
                        }, 2000);
                    })
                    .catch(error => {
                        console.error('Error during resubscription:', error);
                        this.showToast('Error', 'Failed to reconnect. Please refresh the page.', 'error');
                    });
            }
        });
    }

    // Unsubscribe from Platform Events
    async unsubscribeFromMessageEvents() {
        if (this.subscription) {
            try {
                await unsubscribe(this.subscription);
                this.subscription = null;
                console.log('Successfully unsubscribed from message events');
            } catch (error) {
                console.error('Error unsubscribing from message events:', error);
            }
        }
    }

    // Handle incoming Platform Event message
    handleNewMessage(messageEvent) {
        const eventData = messageEvent.data.payload;
        
        // Check if message is for current contact
        if (eventData.ContactId__c === this.recordId) {
            // Load the latest messages to ensure we have the most up-to-date data
            this.loadLatestMessages();
        }
    }

    // Load only the latest messages since last message
    async loadLatestMessages() {
        if (this.isLoading || !this.recordId) return;
        
        const currentContactId = this.recordId;
        this.isLoading = true;

        try {
            const result = await loadMessages({ contactId: currentContactId });

            // Ensure we're still on the same contact
            if (this.recordId !== currentContactId) return;

            if (result && Array.isArray(result)) {
                const newMessages = result.filter(msg => !this.messageIds.has(msg.Id));
                
                if (newMessages.length > 0) {
                    // Add new message IDs to tracking set
                    newMessages.forEach(msg => this.messageIds.add(msg.Id));
                    
                    // Update messages array
                    this.messages = [...this.messages, ...newMessages];
                    
                    // Update UI
                    this.updateUiBasedOnMessages();
                    
                    // Handle scrolling and unread count
                    const container = this.template.querySelector('.chat-messages-container');
                    const isNearBottom = container ? 
                        (container.scrollHeight - container.scrollTop - container.clientHeight < 100) : true;
                        
                    if (this.isChatOpen && isNearBottom) {
                        this.scrollToBottom();
                    } else if (this.isChatOpen) {
                        this.hasUnreadMessages = true;
                        this.unreadCount = (this.unreadCount || 0) + newMessages.length;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading latest messages:', error);
        } finally {
            this.isLoading = false;
        }
    }

    // 24-hour window check
    isOutside24HourWindow() {
        if (!this.lastMessageTimestamp) return true;
        const lastTime = new Date(this.lastMessageTimestamp).getTime();
        const now = Date.now();
        const hoursDiff = (now - lastTime) / (1000 * 60 * 60);
        return hoursDiff > 24;
    }

    renderMessages() {
        const chatMessagesContainer = this.template.querySelector('.chat-messages');
        if (!chatMessagesContainer) return;
        
        // Clear existing messages
        chatMessagesContainer.innerHTML = '';
        
        if (!this.messages || this.messages.length === 0) {
            this.showNoMessages = true;
            return;
        }
        
        this.showNoMessages = false;
        
        this.messages.forEach((message, index) => {
            // Check if we need to show a date separator
            if (this.shouldShowDateSeparator(message, this.messages[index - 1])) {
                const separator = document.createElement('div');
                separator.className = 'message-date-separator';
                separator.innerHTML = `<div class="message-date-separator-text">${this.formatDateForSeparator(message.Timestamp__c)}</div>`;
                chatMessagesContainer.appendChild(separator);
            }
            
            const messageElement = document.createElement('div');
            const isOutbound = message.Direction__c && message.Direction__c.toLowerCase() === 'outbound';
            messageElement.className = `message ${isOutbound ? 'message-outbound' : 'message-inbound'}`;
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            
            // Sender Name
            if (message.Sent_By__c) {
                const senderName = document.createElement('div');
                senderName.className = 'message-sender';
                senderName.textContent = message.Sent_By__c;
                messageContent.appendChild(senderName);
            }

            // Message text
            if (message.Message__c) {
                const messageText = document.createElement('div');
                messageText.className = 'message-text';
                messageText.textContent = message.Message__c;
                messageContent.appendChild(messageText);
            }
            
            // Media (if present)
            if (message.Media_URL__c) {
                const mediaDiv = document.createElement('div');
                mediaDiv.className = 'message-media';
                
                // Determine media type by extension
                const urlLower = message.Media_URL__c.toLowerCase();
                if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mov')) {
                    const video = document.createElement('video');
                    video.controls = true;
                    video.className = 'media-video';
                    const source = document.createElement('source');
                    source.src = message.Media_URL__c;
                    video.appendChild(source);
                    mediaDiv.appendChild(video);
                } else if (urlLower.endsWith('.mp3') || urlLower.endsWith('.ogg') || urlLower.endsWith('.wav')) {
                    const audio = document.createElement('audio');
                    audio.controls = true;
                    audio.className = 'media-audio';
                    const source = document.createElement('source');
                    source.src = message.Media_URL__c;
                    audio.appendChild(source);
                    mediaDiv.appendChild(audio);
                } else if (urlLower.endsWith('.pdf')) {
                    const embed = document.createElement('embed');
                    embed.src = message.Media_URL__c;
                    embed.type = 'application/pdf';
                    embed.className = 'media-pdf';
                    mediaDiv.appendChild(embed);
                } else {
                    // Default to image
                    const mediaImage = document.createElement('img');
                    mediaImage.className = 'media-image';
                    mediaImage.src = message.Media_URL__c;
                    mediaImage.alt = 'Media';
                    mediaDiv.appendChild(mediaImage);
                }
                
                messageContent.appendChild(mediaDiv);
            }
            
            // Message metadata
            const messageMeta = document.createElement('div');
            messageMeta.className = 'message-meta';
            const time = this.formatTimestamp(message.Timestamp__c);
            messageMeta.textContent = time;

            // Status icon for outbound messages
            if (isOutbound) {
                const statusIcon = this.getStatusIconForMessage(message);
                if (statusIcon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'status-icon';
                    iconSpan.innerHTML = statusIcon;
                    messageMeta.appendChild(iconSpan);
                }
            }

            messageContent.appendChild(messageMeta);
            messageElement.appendChild(messageContent);
            chatMessagesContainer.appendChild(messageElement);
        }); // <-- Properly close the forEach loop
        
        // Remove any stray or duplicate code after the loop
    } // <-- Properly close renderMessages method

    scrollToBottom() {
        setTimeout(() => {
            const messagesContainer = this.template.querySelector('.chat-messages-container');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }, 100);
    }

    handleScroll(event) {
        const container = event.target;
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Check if scrolled to top for loading more messages
        if (scrollTop === 0 && this.showLoadMoreButton) {
            this.loadMoreMessages();
        }
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }

    getErrorMessage(error) {
        if (error && error.body) {
            if (error.body.message) {
                return error.body.message;
            }
            if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                return error.body.pageErrors[0].message;
            }
        }
        return error.message || 'Unknown error occurred';
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await this.loadInitialMessages();
            this.showToast('Success', 'Chat history refreshed', 'success');
        } catch (error) {
            this.showToast('Error', 'Failed to refresh chat', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    resizeTextarea() {
        const textarea = this.template.querySelector('.message-input');
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
            const maxLines = 4;
            const maxHeight = lineHeight * maxLines + 16;
            if (scrollHeight > maxHeight) {
                textarea.style.height = `${maxHeight}px`;
                textarea.style.overflowY = 'auto';
            } else {
                textarea.style.height = `${scrollHeight}px`;
                textarea.style.overflowY = 'hidden';
            }
        }
    }
}