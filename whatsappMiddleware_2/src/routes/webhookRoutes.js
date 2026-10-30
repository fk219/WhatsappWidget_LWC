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
        }
        res.sendStatus(200); // Send 200 OK response to Twilio
    } catch (err) {
        console.error('Webhook error:', err); // Log error
        res.sendStatus(500); // Send 500 error response
    }
});

router.post('/status', async (req, res) => {
    try {
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