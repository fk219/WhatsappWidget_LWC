<<<<<<< HEAD
import express from 'express';
import bodyParser from 'body-parser';
import Message from '../models/Message.js';
import { logInfo, logError } from '../utils/logger.js';

const router = express.Router();

// Middleware to log all webhook requests
router.use((req, res, next) => {
  logInfo(`Webhook ${req.method} ${req.path} received`, {
    headers: req.headers,
    body: req.body,
    query: req.query
  });
  next();
});

// Parse URL-encoded bodies for webhook requests
router.use(bodyParser.urlencoded({ extended: false }));

router.post('/incoming', async (req, res) => {
    try {
        logInfo('Processing incoming message webhook', { body: req.body });
        
        if (!req.body.MessageSid) {
            logError('Missing required field: MessageSid', { body: req.body });
            return res.status(400).send('Bad Request: Missing MessageSid');
        }
        
        const {
            MessageSid,    // Twilio message SID
            From,          // Sender's phone number (e.g., 'whatsapp:+1234567890')
            To,            // Recipient's phone number (your Twilio number)
            Body,          // Message content
            NumMedia,      // Number of media attachments
            ProfileName,   // Sender's WhatsApp profile name
            SmsStatus,     // Message status
            WaId,          // WhatsApp ID of the sender
            SmsMessageSid, // Alternative message SID
            SmsSid,        // Another alternative message SID
            MessageStatus  // Alternative status field
        } = req.body;

        // Clean the contact ID by removing 'whatsapp:' prefix if present
        const cleanFrom = From.replace('whatsapp:', '');
        const cleanTo = To.replace('whatsapp:', '');
        
        // Determine the best available contact name
        const contactName = ProfileName || cleanFrom;
        
        // Check if we already have this message
        let message = await Message.findOne({ 
            $or: [
                { messageSid: MessageSid },
                { messageSid: SmsMessageSid },
                { messageSid: SmsSid },
                { 
                    contactId: cleanFrom,
                    message: Body,
                    timestamp: { $gt: new Date(Date.now() - 60000) } // Within the last minute
                }
            ]
        });

        if (!message) {
            // Create a new message document
            message = new Message({
                messageSid: MessageSid || SmsMessageSid || SmsSid || `local_${Date.now()}`,
                contactId: cleanFrom,
                waId: WaId,
                message: Body,
                direction: 'inbound',
                status: SmsStatus || MessageStatus || 'received',
                from: cleanFrom,
                fromName: contactName,
                to: cleanTo,
                contactName: contactName,
                profileName: ProfileName,
                timestamp: new Date(),
                mediaUrl: NumMedia > 0 
                    ? `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages/${MessageSid || SmsMessageSid || SmsSid}/Media` 
                    : null
            });
            
            await message.save();
            
            // Update all previous messages from this contact to ensure consistent contactName
            await Message.updateMany(
                { 
                    contactId: cleanFrom,
                    $or: [
                        { contactName: { $exists: false } },
                        { contactName: 'Unknown' },
                        { contactName: '' }
                    ]
                },
                { $set: { contactName: contactName } }
            );
        } else {
            // Update existing message
            const updates = {
                status: SmsStatus || MessageStatus || message.status,
                updatedAt: new Date()
            };
            
            // Only update these fields if they're not already set
            if (ProfileName && !message.profileName) {
                updates.profileName = ProfileName;
                updates.contactName = ProfileName;
                updates.fromName = ProfileName;
            }
            
            await Message.updateOne({ _id: message._id }, { $set: updates });
=======
import express from 'express'; // Import Express framework
import bodyParser from 'body-parser'; // Import body-parser for parsing webhook data
import Message from '../models/Message.js'; // Import Message model


const router = express.Router(); // Create Express router instance

router.use(bodyParser.urlencoded({ extended: false })); // Parse URL-encoded bodies for webhook requests

router.post('/incoming', async (req, res) => { // Route for handling incoming WhatsApp messages
    try {
        const {
            MessageSid, // Twilio message SID
            From, // Sender's phone number or identifier
            To, // Recipient's phone number
            Body, // Message content
            NumMedia, // Number of media attachments
            ProfileName, // Sender's profile name (e.g., WhatsApp name)
            ChannelMetadata, // Additional channel metadata
            SmsStatus // Message status
        } = req.body; // Destructure request body

        let message = await Message.findOne({ messageSid: MessageSid }); // Check if message exists in MongoDB
        if (!message) { // If message doesn't exist, create new document
            message = new Message({
                messageSid: MessageSid, // Twilio message SID
                contactId: From.replace('whatsapp:', ''), // Extract contactId from WhatsApp number
                message: Body, // Message content
                direction: 'inbound', // Message direction
                status: SmsStatus || 'received', // Set status (default to 'received')
                from: From, // Sender number
                to: To, // Recipient number
                profileName: ProfileName, // Sender's profile name
                channelMetadata: JSON.parse(ChannelMetadata || '{}'), // Parse channel metadata
                mediaUrl: NumMedia > 0 ? `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages/${MessageSid}/Media` : null // Generate media URL if media exists
            });
            await message.save(); // Save new message to MongoDB
        } else { // If message exists, update status
            message.status = SmsStatus || message.status; // Update status
            await message.save(); // Save updated message
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f
        }
        res.sendStatus(200); // Send 200 OK response to Twilio
    } catch (err) {
        console.error('Webhook error:', err); // Log error
        res.sendStatus(500); // Send 500 error response
    }
});

router.post('/status', async (req, res) => {
    try {
<<<<<<< HEAD
        logInfo('Processing status webhook', { body: req.body });
        
        if (!req.body.MessageSid) {
            logError('Missing required field: MessageSid', { body: req.body });
            return res.status(400).send('Bad Request: Missing MessageSid');
        }
=======
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f
        const { MessageSid, MessageStatus, From, To } = req.body; // Destructure request body
        const message = await Message.findOneAndUpdate(
            { messageSid: MessageSid }, // Find message by SID
            { status: MessageStatus, from: From, to: To }, // Update status and contact details
            { new: true } // Return updated document
        );
        if (message) { // If message found
            res.sendStatus(200); // Send 200 OK response to Twilio
        } else {
            res.sendStatus(404); // Send 404 if message not found
        }
    } catch (err) {
        console.error('Status update error:', err); // Log error
        res.sendStatus(500); // Send 500 error response
    }
});

export default router; // Export router