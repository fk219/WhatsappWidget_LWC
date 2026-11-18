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

export default mongoose.model('Message', messageSchema); // Export Message model