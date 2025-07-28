// Import necessary modules from Lightning Web Components (LWC) framework
// LightningElement: Base class for LWC components
// api: Decorator for exposing public properties/methods
// track: Decorator for reactive properties that trigger re-rendering
// wire: Decorator for data binding (though not used extensively here)
import { LightningElement, api, track, wire } from 'lwc';
// Import ShowToastEvent for displaying toast notifications
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
// Import loadScript to dynamically load external JavaScript libraries (e.g., Socket.IO)
import { loadScript } from 'lightning/platformResourceLoader';

// Define constants
// MESSAGES_PER_LOAD: Number of messages to load per batch (used for pagination)
const MESSAGES_PER_LOAD = 20;
// SOCKET_IO_URL: URL of the Twilio backend Socket.IO server for real-time communication
const SOCKET_IO_URL = 'http://localhost:3001';

// Define the main LWC class
export default class WhatsappChatWidget extends LightningElement {
    // Private fields
    // _subscription: Previously used for Salesforce Platform Events (now null with Socket.IO)
    _subscription = null;
    // _recordId: Private storage for the Salesforce record ID (e.g., Contact ID)
    _recordId;
    // socket: WebSocket connection to the Socket.IO server
    socket = null;

    // Tracked properties (reactive, trigger UI updates when changed)
    // isChatOpen: Tracks whether the chat window is open
    @track isChatOpen = false;
    // currentContactId: Tracks the current contact being chatted with
    @track currentContactId = null;
    // messages: Array of message objects displayed in the chat
    @track messages = [];
    // currentMessage: The text input by the user for sending a new message
    @track currentMessage = '';
    // mediaUrl: URL of media (if any) to be sent with the message
    @track mediaUrl = '';
    // contactName: Name of the current contact
    @track contactName = 'WhatsApp Chat';
    // contactInitials: Initials derived from the contact name for display
    @track contactInitials = 'WC';
    // isLoading: Indicates if an async operation (e.g., loading messages) is in progress
    @track isLoading = false;
    // showLoadMoreButton: Controls visibility of the "Load More" button for pagination
    @track showLoadMoreButton = false;
    // showNoMessages: Controls visibility of a "no messages" message
    @track showNoMessages = false;
    // showStartConversationButton: Controls visibility of the "Start Conversation" button
    @track showStartConversationButton = false;
    // showMediaInput: Controls visibility of the media URL input field
    @track showMediaInput = false;
    // hasUnreadMessages: Tracks if there are unread messages when chat is closed
    @track hasUnreadMessages = false;
    // unreadCount: Number of unread messages
    @track unreadCount = 0;
    // offset: Tracks the starting index for loading more messages
    @track offset = 0;
    // totalMessages: Total number of messages available (for pagination)
    @track totalMessages = 0;
    // messageIds: Set to track unique message IDs to avoid duplicates
    @track messageIds = new Set();
    // lastMessageTimestamp: Timestamp of the last message for 24-hour window logic
    @track lastMessageTimestamp = null;

    // Helper method to get status icon based on message status
    // Returns an SVG icon based on the message status
    getStatusIconForMessage(message) {
        // Check if message is null or undefined
        if (!message) return '';
        
        // Extract status from the message (uses 'status' from MongoDB schema)
        const status = message.status || '';
        // isRead: Placeholder for read status (adjust if backend provides this)
        const isRead = message.isRead; // Note: May need backend adjustment
        
        // Define SVG icons for different statuses
        const icons = {
            pending: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" fill="#8696A0"/></svg>',
            sent: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#8696A0"/></svg>',
            delivered: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 7l-8 8-4-4-1.41 1.41L10 17.17l9-9z" fill="#8696A0"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#8696A0"/></svg>',
            read: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 7l-8 8-4-4-1.41 1.41L10 17.17l9-9z" fill="#53BDEB"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#53BDEB"/></svg>',
            received: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-8l4 4 6-6-1.41-1.41L10 12.17l-1.41-1.41L10 10z" fill="#8696A0"/></svg>',
            failed: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-4h-2v-2h2v2zm0-4h-2V7h2v5z" fill="#FF3333"/></svg>'
        };
        
        // Return the appropriate icon based on status, default to pending if unknown
        return icons[status.toLowerCase()] || icons.pending;
    }

    // Lifecycle hook called when the component is inserted into the DOM
    async connectedCallback() {
        console.log('WhatsappChatWidget connected. recordId:', this.recordId); // Log connection and recordId
        
        try {
            // Load the Socket.IO client library dynamically
            await loadScript(this, '/resource/socketIo/socket.io.js'); // Ensure static resource is uploaded
            this.initializeSocket(); // Set up WebSocket connection
            this.initializeChat(); // Initialize chat state and data
        } catch (error) {
            console.error('Error in component initialization:', error); // Log any errors
            this.showToast('Error', 'Failed to initialize chat. Please refresh the page.', 'error'); // Notify user
        }
    }

    // Initialize Socket.IO connection and event handlers
    initializeSocket() {
        // Establish WebSocket connection to the Twilio backend
        this.socket = io(SOCKET_IO_URL);
        // Log connection success
        this.socket.on('connect', () => {
            console.log('Connected to Socket.IO server');
            // Join the room for the current contact if recordId is available
            if (this.recordId) {
                this.socket.emit('join', this.recordId);
            }
        });

        // Handle new message events from the server
        this.socket.on('new-message', (message) => {
            // Only process messages for the current contact
            if (message.contactId === this.recordId) {
                this.messages = [...this.messages, message]; // Add new message to array
                this.messageIds.add(message.messageSid); // Track new message ID
                this.updateUiBasedOnMessages(); // Update UI
                // Scroll to bottom if chat is open, otherwise mark as unread
                if (this.isChatOpen) {
                    this.scrollToBottom();
                } else {
                    this.hasUnreadMessages = true;
                    this.unreadCount += 1;
                }
            }
        });

        // Handle message status updates from the server
        this.socket.on('message-status-update', (message) => {
            if (message.contactId === this.recordId) {
                // Update the message in the array with the new status
                this.messages = this.messages.map(msg =>
                    msg.messageSid === message.messageSid ? message : msg
                );
                this.renderMessages(); // Re-render to reflect status change
            }
        });

        // Handle disconnection from the server
        this.socket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO server');
        });
    }

    // Setter for recordId to handle changes (e.g., when switching contacts)
    @api
    set recordId(value) {
        console.log('recordId changed from', this._recordId, 'to', value); // Log change
        this._recordId = value; // Update private field
        this.initializeChat(); // Reinitialize chat with new recordId
    }
    
    // Getter for recordId
    get recordId() {
        return this._recordId;
    }

    // Initialize chat state and load initial data
    initializeChat() {
        if (this.recordId) {
            // Reset messages if switching to a new contact
            if (this.currentContactId !== this.recordId) {
                console.log('Contact changed, resetting chat state');
                this.messages = [];
                this.messageIds.clear();
                this.currentContactId = this.recordId;
            }
            this.fetchContactDetails(); // Load contact details
            this.loadInitialMessages(); // Load initial messages
        } else {
            console.warn('recordId is not available.'); // Log warning if no recordId
            this.showNoMessages = true; // Show no messages message
            this.showStartConversationButton = true; // Show start conversation option
            this.contactName = 'No Contact Selected'; // Update contact name
        }
    }

    // Lifecycle hook called when the component is removed from the DOM
    async disconnectedCallback() {
        console.log('Chat widget disconnected, cleaning up...'); // Log cleanup
        // Disconnect Socket.IO if active
        if (this.socket) {
            this.socket.disconnect();
        }
        this.messages = []; // Clear messages
        this.messageIds.clear(); // Clear message IDs
        this.currentContactId = null; // Reset current contact
    }

    // Fetch contact details from the backend
    async fetchContactDetails() {
        try {
            // Make GET request to the backend
            const response = await fetch(`http://localhost:3001/api/contact/${this.recordId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const contact = await response.json(); // Parse response
            // Update contact name and initials if data is valid
            if (contact && contact.name) {
                this.contactName = contact.name;
                this.contactInitials = this.getInitials(contact.name);
            } else {
                this.contactName = 'Unknown Contact';
                this.contactInitials = 'UC';
            }
        } catch (error) {
            console.error('Error fetching contact details:', error); // Log error
            this.showToast('Error', 'Error fetching contact details: ' + (error.message || 'Unknown error'), 'error'); // Notify user
            this.contactName = 'Error Loading Contact'; // Fallback name
            this.contactInitials = 'EC'; // Fallback initials
        }
    }

    // Derive initials from a name
    getInitials(name) {
        // Split name into words, take first letter of each, join, and limit to 2 chars
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    // Load initial set of messages
    async loadInitialMessages() {
        if (this.isLoading || !this.recordId) return; // Exit if loading or no recordId
        
        this.isLoading = true; // Set loading state
        console.log('Loading initial messages for contact:', this.recordId); // Log action
        
        try {
            // Fetch messages from the backend
            const response = await fetch(`http://localhost:3001/api/messages/${this.recordId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const messages = await response.json(); // Parse response
            if (Array.isArray(messages)) {
                this.messages = messages; // Update messages array
                this.messageIds = new Set(messages.map(msg => msg.messageSid)); // Track message IDs
                this.totalMessages = messages.length; // Update total count
                this.showLoadMoreButton = messages.length >= MESSAGES_PER_LOAD; // Show load more if needed
                this.updateUiBasedOnMessages(); // Update UI
                this.scrollToBottom(); // Scroll to latest message
            }
        } catch (error) {
            console.error('Error loading initial messages:', error); // Log error
            this.showToast('Error', 'Error loading messages: ' + (error.message || 'Unknown error'), 'error'); // Notify user
        } finally {
            this.isLoading = false; // Reset loading state
        }
    }

    // Load additional messages for pagination
    async loadMoreMessages() {
        if (this.isLoading || !this.recordId) return; // Exit if loading or no recordId
        
        this.isLoading = true; // Set loading state
        const scrollPosition = this.template.querySelector('.chat-messages-container').scrollTop; // Save scroll position
        
        try {
            // Fetch more messages with an offset
            const response = await fetch(`http://localhost:3001/api/messages/${this.recordId}?offset=${this.offset + MESSAGES_PER_LOAD}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const messages = await response.json(); // Parse response
            if (Array.isArray(messages) && messages.length > 0) {
                this.messages = [...messages, ...this.messages]; // Prepend new messages
                this.messageIds = new Set(messages.map(msg => msg.messageSid).concat([...this.messageIds])); // Update IDs
                this.offset += messages.length; // Increment offset
                this.showLoadMoreButton = messages.length >= MESSAGES_PER_LOAD; // Update load more visibility
                // Adjust scroll position to maintain context
                requestAnimationFrame(() => {
                    const container = this.template.querySelector('.chat-messages-container');
                    container.scrollTop = scrollPosition + (container.scrollHeight - (container.scrollHeight - scrollPosition));
                });
            }
        } catch (error) {
            console.error('Error loading more messages:', error); // Log error
            this.showToast('Error', 'Error loading more messages: ' + (error.message || 'Unknown error'), 'error'); // Notify user
        } finally {
            this.isLoading = false; // Reset loading state
        }
    }

    // Update UI based on the current message state
    updateUiBasedOnMessages() {
        if (this.messages && this.messages.length > 0) {
            this.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort by timestamp
            this.lastMessageTimestamp = this.messages[this.messages.length - 1].timestamp; // Update last timestamp
            this.showNoMessages = false; // Hide no messages message
        } else {
            this.lastMessageTimestamp = null; // Reset timestamp
            this.showNoMessages = true; // Show no messages message
        }
        // Show start conversation button if no messages or outside 24-hour window
        this.showStartConversationButton = this.messages.length === 0 || this.isOutside24HourWindow();
        this.renderMessages(); // Render updated message list
    }

    // Toggle chat window visibility
    toggleChat() {
        this.isChatOpen = !this.isChatOpen; // Toggle state
        
        if (this.isChatOpen) {
            this.hasUnreadMessages = false; // Reset unread indicators
            this.unreadCount = 0;
            // Load messages and scroll to bottom
            this.loadInitialMessages().then(() => this.scrollToBottom());
        }
        console.log('Chat toggled. isOpen:', this.isChatOpen); // Log state
    }

    // Toggle media input field visibility
    toggleMediaInput() {
        this.showMediaInput = !this.showMediaInput; // Toggle state
        
        if (this.showMediaInput) {
            // Focus media input after a delay
            setTimeout(() => {
                const mediaInput = this.template.querySelector('.media-input');
                if (mediaInput) mediaInput.focus();
            }, 100);
        }
    }

    // Hide media input field
    hideMediaInput() {
        this.showMediaInput = false; // Hide field
        this.mediaUrl = ''; // Clear media URL
    }

    // Called after every render to adjust UI elements
    renderedCallback() {
        this.resizeTextarea(); // Adjust textarea height
    }

    // Handle changes to the message input
    handleMessageChange(event) {
        this.currentMessage = event.target.value; // Update message text
        this.resizeTextarea(); // Adjust textarea height
    }

    // Handle changes to the media URL input
    handleMediaUrlChange(event) {
        this.mediaUrl = event.target.value; // Update media URL
    }

    // Computed property to disable send button if no content or loading
    get isSendButtonDisabledComputed() {
        return (!this.currentMessage.trim() && !this.mediaUrl.trim()) || this.isLoading;
    }

    // Handle keyup events for sending message with Enter key
    handleKeyUp(event) {
        // Send message on Enter (without Shift) if not disabled
        if (event.key === 'Enter' && !event.shiftKey && !this.isSendButtonDisabledComputed && !this.isLoading) {
            event.preventDefault(); // Prevent default behavior (e.g., newline)
            this.handleSendMessage(); // Trigger send
        }
    }

    // Display a toast notification
    showToast(title, message, variant) {
        const event = new ShowToastEvent({ title, message, variant }); // Create toast event
        this.dispatchEvent(event); // Dispatch to show toast
    }

    // Extract error message from an error object
    getErrorMessage(error) {
        return error.message || 'Unknown error occurred'; // Return message or fallback
    }

    // Handle sending a new message
    async handleSendMessage() {
        if (this.isSendButtonDisabledComputed || !this.recordId) return; // Exit if disabled or no recordId

        this.isLoading = true; // Set loading state
        const currentContactId = this.recordId; // Store current contact
        const to = `whatsapp:+${this.recordId.slice(-9)}`; // Derive WhatsApp number from recordId

        try {
            // Create a temporary message for optimistic UI update
            const tempMessage = {
                messageSid: `temp-${Date.now()}`,
                contactId: currentContactId,
                message: this.currentMessage.trim(),
                direction: 'outbound',
                status: 'sending',
                mediaUrl: this.mediaUrl.trim() || null,
                timestamp: new Date(),
                to,
                from: 'whatsapp:+14155238886'
            };
            this.messages = [...this.messages, tempMessage]; // Add temp message
            this.messageIds.add(tempMessage.messageSid); // Track temp ID
            this.updateUiBasedOnMessages(); // Update UI
            this.scrollToBottom(); // Scroll to new message

            // Send message to backend
            const response = await fetch('http://localhost:3001/api/messages/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId: currentContactId, to, body: this.currentMessage, mediaUrl: this.mediaUrl })
            });
            const realMessage = await response.json(); // Parse response
            // Update messages with real data
            this.messages = this.messages.map(msg =>
                msg.messageSid === tempMessage.messageSid ? realMessage : msg
            );
            this.messageIds.delete(tempMessage.messageSid); // Remove temp ID
            this.messageIds.add(realMessage.messageSid); // Add real ID
            this.currentMessage = ''; // Clear input
            this.mediaUrl = ''; // Clear media
            this.showMediaInput = false; // Hide media input
            this.resizeTextarea(); // Reset textarea
            this.showToast('Success', 'Message sent successfully', 'success'); // Notify success
        } catch (error) {
            console.error('Error sending message:', error); // Log error
            // Update temp message to failed status
            this.messages = this.messages.map(msg =>
                msg.messageSid === tempMessage.messageSid ? { ...msg, status: 'failed' } : msg
            );
            this.showToast('Error', 'Error sending message: ' + this.getErrorMessage(error), 'error'); // Notify failure
        } finally {
            this.isLoading = false; // Reset loading state
        }
    }

    // Handle starting a new conversation with a template
    async handleStartConversation() {
        if (this.isLoading) return; // Exit if loading

        this.isLoading = true; // Set loading state
        const to = `whatsapp:+${this.recordId.slice(-9)}`; // Derive WhatsApp number

        try {
            // Send template message to backend
            const response = await fetch('http://localhost:3001/api/messages/send-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactId: this.recordId,
                    to,
                    contentSid: 'HX229f5a04fd0510ce1b071852155d3e75',
                    contentVariables: '{"1":"409173"}'
                })
            });
            const message = await response.json(); // Parse response
            this.showToast('Success', 'Conversation started successfully', 'success'); // Notify success
            this.showStartConversationButton = false; // Hide start button
            this.showNoMessages = false; // Hide no messages message
            this.messages = [...this.messages, message]; // Add message
            this.updateUiBasedOnMessages(); // Update UI
        } catch (error) {
            console.error('Error starting conversation:', error); // Log error
            this.showToast('Error', 'Error starting conversation: ' + this.getErrorMessage(error), 'error'); // Notify failure
        } finally {
            this.isLoading = false; // Reset loading state
        }
    }

    // Format date for separators in the message list
    formatDateForSeparator(timestamp) {
        if (!timestamp) return ''; // Return empty if no timestamp
        const date = new Date(timestamp); // Convert to Date object
        const now = new Date(); // Current date
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
        const yesterday = new Date(today); // Start of yesterday
        yesterday.setDate(yesterday.getDate() - 1); // Subtract one day
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()); // Message date
        
        // Return appropriate date string based on recency
        if (messageDate.getTime() === today.getTime()) return 'TODAY';
        if (messageDate.getTime() === yesterday.getTime()) return 'YESTERDAY';
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
        }
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    }

    // Format timestamp for display
    formatTimestamp(timestamp) {
        if (!timestamp) return ''; // Return empty if no timestamp
        // Format time as HH:MM AM/PM
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Determine if a date separator is needed between messages
    shouldShowDateSeparator(currentMsg, previousMsg) {
        if (!previousMsg) return true; // Show separator for first message
        // Show separator if dates differ
        return new Date(currentMsg.timestamp).toDateString() !== new Date(previousMsg.timestamp).toDateString();
    }

    // Render messages into the DOM
    renderMessages() {
        const chatMessagesContainer = this.template.querySelector('.chat-messages'); // Get container
        if (!chatMessagesContainer) return; // Exit if container not found
        
        chatMessagesContainer.innerHTML = ''; // Clear existing content
        if (!this.messages || this.messages.length === 0) {
            this.showNoMessages = true; // Show no messages if empty
            return;
        }
        
        this.showNoMessages = false; // Hide no messages if messages exist
        // Iterate over messages to build DOM elements
        this.messages.forEach((message, index) => {
            if (this.shouldShowDateSeparator(message, this.messages[index - 1])) {
                const separator = document.createElement('div'); // Create date separator
                separator.className = 'message-date-separator';
                separator.innerHTML = `<div class="message-date-separator-text">${this.formatDateForSeparator(message.timestamp)}</div>`;
                chatMessagesContainer.appendChild(separator);
            }
            
            const messageElement = document.createElement('div'); // Create message element
            const isOutbound = message.direction && message.direction.toLowerCase() === 'outbound'; // Determine direction
            messageElement.className = `message ${isOutbound ? 'message-outbound' : 'message-inbound'}`;
            const messageContent = document.createElement('div'); // Create content container
            messageContent.className = 'message-content';
            
            if (message.message) {
                const messageText = document.createElement('div'); // Create text element
                messageText.className = 'message-text';
                messageText.textContent = message.message; // Set text content
                messageContent.appendChild(messageText);
            }
            
            if (message.mediaUrl) {
                const mediaDiv = document.createElement('div'); // Create media container
                mediaDiv.className = 'message-media';
                const mediaImage = document.createElement('img'); // Create image element
                mediaImage.className = 'media-image';
                mediaImage.src = message.mediaUrl; // Set media URL
                mediaImage.alt = 'Media'; // Set alt text
                mediaDiv.appendChild(mediaImage);
                messageContent.appendChild(mediaDiv);
            }
            
            const messageMeta = document.createElement('div'); // Create meta container
            messageMeta.className = 'message-meta';
            const time = this.formatTimestamp(message.timestamp); // Format time
            messageMeta.textContent = time; // Set time text

            if (isOutbound) {
                const statusIcon = this.getStatusIconForMessage(message); // Get status icon
                if (statusIcon) {
                    const iconSpan = document.createElement('span'); // Create icon container
                    iconSpan.className = 'status-icon';
                    iconSpan.innerHTML = statusIcon; // Set SVG
                    messageMeta.appendChild(iconSpan);
                }
            }

            messageContent.appendChild(messageMeta); // Add meta to content
            messageElement.appendChild(messageContent); // Add content to message
            chatMessagesContainer.appendChild(messageElement); // Add message to container
        });
    }

    // Scroll to the bottom of the chat container
    scrollToBottom() {
        setTimeout(() => {
            const messagesContainer = this.template.querySelector('.chat-messages-container'); // Get container
            if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
        }, 100); // Delay to ensure DOM is ready
    }

    // Handle scroll events to load more messages
    handleScroll(event) {
        const container = event.target; // Get the scrolled element
        if (container.scrollTop === 0 && this.showLoadMoreButton) {
            this.loadMoreMessages(); // Load more if at top and button visible
        }
    }

    // Refresh the chat history
    async handleRefresh() {
        this.isLoading = true; // Set loading state
        try {
            await this.loadInitialMessages(); // Reload messages
            this.showToast('Success', 'Chat history refreshed', 'success'); // Notify success
        } catch (error) {
            this.showToast('Error', 'Failed to refresh chat', 'error'); // Notify failure
        } finally {
            this.isLoading = false; // Reset loading state
        }
    }

    // Adjust textarea height dynamically
    resizeTextarea() {
        const textarea = this.template.querySelector('.message-input'); // Get textarea
        if (textarea) {
            textarea.style.height = 'auto'; // Reset height
            const scrollHeight = textarea.scrollHeight; // Get content height
            const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight); // Get line height
            const maxLines = 4; // Maximum lines allowed
            const maxHeight = lineHeight * maxLines + 16; // Calculate max height with padding
            if (scrollHeight > maxHeight) {
                textarea.style.height = `${maxHeight}px`; // Cap height
                textarea.style.overflowY = 'auto'; // Enable scrolling
            } else {
                textarea.style.height = `${scrollHeight}px`; // Set to content height
                textarea.style.overflowY = 'hidden'; // Hide scrollbar
            }
        }
    }

    // Check if the last message is outside a 24-hour window
    isOutside24HourWindow() {
        if (!this.lastMessageTimestamp) return true; // Return true if no last message
        const lastTime = new Date(this.lastMessageTimestamp).getTime(); // Convert to timestamp
        const now = Date.now(); // Current timestamp
        return (now - lastTime) / (1000 * 60 * 60) > 24; // Check if more than 24 hours
    }
}