import express from 'express'; // Import Express framework
const router = express.Router(); // Create Express router instance
import twilio from 'twilio'; // Import Twilio library
import Message from '../models/Message.js'; // Import Message model

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); // Initialize Twilio client

router.post('/send-template', async (req, res) => { // Route for sending template messages
    try {
        const { contactId, to, contentSid, contentVariables } = req.body; // Destructure request body
        const message = await twilioClient.messages.create({ // Create Twilio message
            from: process.env.TWILIO_FROM_NUMBER, // Sender number
            contentSid, // Twilio content SID for template
            contentVariables, // Variables for template
            to // Recipient number
        });
        const newMessage = new Message({ // Create new Message document
            messageSid: message.sid, // Twilio message SID
            contactId, // Salesforce contact ID
            message: `Template: ${contentSid} (${contentVariables})`, // Message content
            direction: 'outbound', // Message direction
            status: 'pending', // Initial status
            to, // Recipient number
            from: process.env.TWILIO_FROM_NUMBER // Sender number (typo: TWILIO)
        });
        await newMessage.save(); // Save message to MongoDB
        res.status(201).json(newMessage); // Respond with saved message
    } catch (err) {
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

router.post('/send-message', async (req, res) => { // Route for sending text messages
    try {
        const { contactId, to, body, mediaUrl } = req.body; // Destructure request body
        const message = await twilioClient.messages.create({ // Create Twilio message
            body, // Message content
            from: process.env.TWILIO_FROM_NUMBER, // Sender number
            to, // Recipient number
            mediaUrl // Optional media URL
        });
        const newMessage = new Message({ // Create new Message document
            messageSid: message.sid, // Twilio message SID
            contactId, // Salesforce contact ID
            message: body, // Message content
            direction: 'outbound', // Message direction
            status: 'pending', // Initial status
            mediaUrl, // Media URL
            to, // Recipient number
            from: process.env.TWILIO_FROM_NUMBER // Sender number
        });
        await newMessage.save(); // Save message to MongoDB
        res.status(201).json(newMessage); // Respond with saved message
    } catch (err) {
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

router.post('/upload-media', async (req, res) => { // Route for uploading media
    try {
        const { contactId, to } = req.body; // Destructure request body
        const file = req.files.media; // Access uploaded file (requires multer middleware)
        const mediaUrl = await uploadToTwilio(file); // Upload file to Twilio (custom function)
        const message = new Message({ // Create new Message document
            messageSid: `media-${Date.now()}`, // Generate unique message SID
            contactId, // Salesforce contact ID
            direction: 'outbound', // Message direction
            status: 'pending', // Initial status
            mediaUrl, // Media URL
            to, // Recipient number
            from: process.env.TWILIO_FROM_NUMBER, // Sender number
            timestamp: new Date() // Current timestamp
        });
        await message.save(); // Save message to MongoDB
        res.status(201).json({ mediaUrl }); // Respond with media URL
    } catch (err) {
        res.status(500).json({ error: err.message }); // Handle errors
    }
});

export default router; // Export router