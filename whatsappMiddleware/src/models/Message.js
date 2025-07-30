<<<<<<< HEAD
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    // Message Identification
    messageSid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Contact Information
    contactId: {
        type: String,
        required: true,
        index: true
    },
    contactName: {
        type: String,
        index: true
    },
    
    // Message Content
    message: {
        type: String,
        required: function() {
            return !this.contentSid; // Message is required if not a template message
        }
    },
    contentSid: {
        type: String, // For template messages
        index: true
    },
    contentVariables: {
        type: Object // For template variables
    },
    
    // Message Metadata
    fromName: {
        type: String,
        required: true
    },
    direction: {
        type: String,
        enum: ['inbound', 'outbound'],
        required: true
    },
    status: {
        type: String,
        enum: ['queued', 'sending', 'sent', 'delivered', 'read', 'received', 'failed', 'undelivered'],
        default: 'queued'
    },
    statusCallback: {
        type: String // URL to call when message status changes
    },
    
    // Read Receipts
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    
    // Media
    mediaUrl: [{
        type: String
    }],
    
    // Message Participants
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    
    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    deliveredAt: {
        type: Date
    },
    sentAt: {
        type: Date
    },
    failedAt: {
        type: Date
    },
    
    // Channel Metadata
    channelMetadata: {
        type: Object
    },
    
    // Error Handling
    errorCode: {
        type: String
    },
    errorMessage: {
        type: String
    },
    
    // Retry Information
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    nextRetryAt: {
        type: Date
    },
    
    // Message Type
    messageType: {
        type: String,
        enum: ['text', 'template', 'media', 'location', 'contact', 'interactive'],
        default: 'text'
    }
});

=======
import mongoose from 'mongoose' // Import Mongoose library

const messageSchema = new mongoose.Schema({ // Define Mongoose schema for Message model
    messageSid: { // Unique Twilio message identifier
        type: String,
        required: true,
        unique: true,
        index: true // Create index for faster queries
    },
    contactId: { // Salesforce contact ID to link messages
        type: String,
        required: true,
        index: true // Create index for faster queries
    },
    message: { // Message content
        type: String
    },
    direction: { // Message direction (inbound or outbound)
        type: String,
        enum: ['inbound', 'outbound']
    },
    status: { // Message status (e.g., pending, sent, delivered)
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read', 'received', 'failed'],
        default: 'pending'
    },
    isRead: { // Flag indicating if message is read
        type: Boolean,
        default: false
    },
    mediaUrl: { // URL for media attachments (if any)
        type: String,
        default: null
    },
    from: { // Sender's phone number or identifier
        type: String,
    },
    to: { // Recipient's phone number or identifier
        type: String,
    },
    timestamp: { // Message timestamp
        type: Date,
        default: Date.now,
        index: true // Create index for faster queries
    },
    contactName: { // Contact name (optional)
        type: String,
    },
    channelMetadata: { // Additional metadata from channel (e.g., WhatsApp)
        type: Object
    }
})
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f

export default mongoose.model('Message', messageSchema); // Export Message model