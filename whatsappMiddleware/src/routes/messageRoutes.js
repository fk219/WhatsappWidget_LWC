<<<<<<< HEAD
import express from 'express';
import twilio from 'twilio';
import Message from '../models/Message.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Helper function to handle message sending with retry logic
const sendWithRetry = async (messageOptions, retryCount = 0, maxRetries = 3) => {
    try {
        const message = await twilioClient.messages.create(messageOptions);
        return { success: true, message };
    } catch (error) {
        if (retryCount < maxRetries) {
            // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s, etc.)
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendWithRetry(messageOptions, retryCount + 1, maxRetries);
        }
        return { success: false, error };
    }
};

// Get contact details by contactId
router.get('/contact/:contactId', async (req, res) => {
    try {
        const { contactId } = req.params;
        
        // Find the most recent message for this contact to get their name
        const contactMessage = await Message.findOne({ contactId })
            .sort({ timestamp: -1 });

        if (contactMessage) {
            return res.json({
                success: true,
                name: contactMessage.contactName || contactMessage.fromName || 'Unknown Contact',
                phone: contactMessage.from || contactMessage.to
            });
        }

        res.status(404).json({
            success: false,
            error: 'Contact not found'
        });
    } catch (error) {
        console.error('Error fetching contact details:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contact details',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get messages with pagination and filtering
router.get('/messages', async (req, res) => {
    try {
        const { 
            contactId, 
            contactName, 
            status, 
            direction, 
            startDate, 
            endDate, 
            page = 1, 
            limit = 20 
        } = req.query;

        const query = {};
        
        // Build query based on parameters
        if (contactId) query.contactId = contactId;
        if (contactName) query.contactName = { $regex: contactName, $options: 'i' };
        if (status) query.status = status;
        if (direction) query.direction = direction;
        
        // Date range filter
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        
        // Get total count for pagination
        const total = await Message.countDocuments(query);
        
        // Get paginated messages
        const messages = await Message.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get contact name from the first message if available
        const contactNameFromMessages = messages[0]?.contactName || messages[0]?.fromName || 'Unknown Contact';

        res.json({
            success: true,
            data: messages,
            contactName: contactNameFromMessages,
            pagination: {
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch messages',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Send a WhatsApp template message
router.post('/send-template', async (req, res) => {
    try {
        const { 
            contactId, 
            to, 
            contentSid, 
            contentVariables,
            contactName,
            fromName = 'System' // Default sender name if not provided
        } = req.body;

        if (!contactId || !to || !contentSid) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: contactId, to, contentSid' 
            });
        }

        // Generate a unique reference ID for this message
        const referenceId = `tw_${uuidv4()}`;
        
        // Create message in database first with pending status
        const newMessage = new Message({
            messageSid: referenceId, // Will be updated with real SID from Twilio
            contactId,
            contactName: contactName || 'Unknown',
            contentSid,
            contentVariables,
            direction: 'outbound',
            status: 'queued',
            from: process.env.TWILIO_FROM_NUMBER,
            fromName, // Add the fromName field
            to,
            messageType: 'template',
            timestamp: new Date()
        });

        await newMessage.save();

        // Send message to Twilio in the background
        (async () => {
            try {
                const messageOptions = {
                    from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
                    to: `whatsapp:${to}`,
                    contentSid,
                    contentVariables: JSON.stringify(contentVariables || {}),
                    statusCallback: `${process.env.API_BASE_URL}/webhook/status`,
                    statusCallbackEvent: ['sent', 'delivered', 'failed', 'undelivered']
                };

                const { success, message, error } = await sendWithRetry(messageOptions);
                
                if (success) {
                    // Update message with Twilio SID and sent status
                    await Message.updateOne(
                        { _id: newMessage._id },
                        { 
                            $set: { 
                                messageSid: message.sid,
                                status: 'sent',
                                sentAt: new Date()
                            }
                        }
                    );
                } else {
                    // Update message with error status
                    await Message.updateOne(
                        { _id: newMessage._id },
                        { 
                            $set: { 
                                status: 'failed',
                                errorCode: error.code,
                                errorMessage: error.message,
                                failedAt: new Date()
                            }
                        }
                    );
                }
            } catch (error) {
                console.error('Error sending template message:', error);
                await Message.updateOne(
                    { _id: newMessage._id },
                    { 
                        $set: { 
                            status: 'failed',
                            errorCode: 'SEND_ERROR',
                            errorMessage: error.message,
                            failedAt: new Date()
                        }
                    }
                );
            }
        })();

        // Respond immediately with the pending message
        res.status(202).json({
            success: true,
            message: 'Message is being processed',
            data: newMessage
        });

    } catch (error) {
        console.error('Error in send-template:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send template message',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Mark messages as read
router.patch('/messages/read', async (req, res) => {
    try {
        const { messageIds, contactId } = req.body;
        
        if ((!messageIds || !messageIds.length) && !contactId) {
            return res.status(400).json({
                success: false,
                error: 'Either messageIds array or contactId is required'
            });
        }

        const updateQuery = { 
            $set: { 
                isRead: true, 
                readAt: new Date(),
                status: 'read' 
            } 
        };

        const query = {};
        
        if (messageIds && messageIds.length) {
            query._id = { $in: messageIds };
        }
        
        if (contactId) {
            query.contactId = contactId;
            query.direction = 'inbound';
            query.isRead = { $ne: true };
        }

        const result = await Message.updateMany(query, updateQuery);

        res.json({
            success: true,
            data: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount
            }
        });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark messages as read',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get message status
router.get('/messages/:messageId/status', async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const message = await Message.findOne({ 
            $or: [
                { _id: messageId },
                { messageSid: messageId }
            ]
        });

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Message not found'
            });
        }

        res.json({
            success: true,
            data: {
                status: message.status,
                messageSid: message.messageSid,
                timestamp: message.timestamp,
                updatedAt: message.updatedAt,
                error: message.errorMessage ? {
                    code: message.errorCode,
                    message: message.errorMessage
                } : undefined
            }
        });
    } catch (error) {
        console.error('Error getting message status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get message status',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Webhook for Twilio status updates
router.post('/webhook/status', async (req, res) => {
    try {
        const { 
            MessageSid, 
            MessageStatus, 
            ErrorCode, 
            ErrorMessage,
            To,
            From
        } = req.body;

        if (!MessageSid) {
            console.warn('Received status update without MessageSid');
            return res.sendStatus(400);
        }

        const updateData = {
            status: MessageStatus,
            updatedAt: new Date()
        };

        // Set appropriate timestamp based on status
        switch (MessageStatus) {
            case 'sent':
                updateData.sentAt = new Date();
                break;
            case 'delivered':
                updateData.deliveredAt = new Date();
                break;
            case 'failed':
            case 'undelivered':
                updateData.failedAt = new Date();
                updateData.errorCode = ErrorCode || 'DELIVERY_FAILED';
                updateData.errorMessage = ErrorMessage || 'Message delivery failed';
                break;
            case 'read':
                updateData.readAt = new Date();
                break;
        }

        // Update the message in the database
        await Message.updateOne(
            { messageSid: MessageSid },
            { $set: updateData },
            { upsert: false }
        );

        // Emit socket event for real-time updates
        const io = req.app.get('socketio');
        if (io) {
            const message = await Message.findOne({ messageSid: MessageSid });
            if (message) {
                io.to(`contact:${message.contactId}`).emit('message:status', {
                    messageId: message._id,
                    messageSid: message.messageSid,
                    status: message.status,
                    timestamp: new Date()
                });
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error processing status webhook:', error);
        res.sendStatus(500);
    }
});

// Send a direct WhatsApp message
router.post('/send-message', async (req, res) => {
    try {
        const { 
            contactId, 
            to, 
            body, 
            mediaUrl,
            contactName,
            fromName = 'Salesforce User' // Default name if not provided
        } = req.body;

        if (!contactId || !to || (!body && !mediaUrl)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: contactId, to, and either body or mediaUrl is required' 
            });
        }

        // Generate a unique reference ID for this message
        const referenceId = `tw_${uuidv4()}`;
        
        // Create message in database first with pending status
        const newMessage = new Message({
            messageSid: referenceId, // Will be updated with real SID from Twilio
            contactId,
            contactName: contactName || 'Unknown',
            fromName: fromName, // Store the Salesforce user's name
            message: body,
            mediaUrl: mediaUrl ? [].concat(mediaUrl) : [],
            direction: 'outbound',
            status: 'queued',
            from: process.env.TWILIO_FROM_NUMBER, // Still store the Twilio number for reference
            to,
            messageType: mediaUrl ? 'media' : 'text',
            timestamp: new Date()
        });

        await newMessage.save();

        // Send message to Twilio in the background
        (async () => {
            try {
                const messageOptions = {
                    from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
                    to: `whatsapp:${to}`,
                    body,
                    mediaUrl: mediaUrl ? [].concat(mediaUrl) : undefined,
                    statusCallback: `${process.env.API_BASE_URL}/webhook/status`,
                    statusCallbackEvent: ['sent', 'delivered', 'failed', 'undelivered']
                };

                const { success, message, error } = await sendWithRetry(messageOptions);
                
                if (success) {
                    // Update message with Twilio SID and sent status
                    await Message.updateOne(
                        { _id: newMessage._id },
                        { 
                            $set: { 
                                messageSid: message.sid,
                                status: 'sent',
                                sentAt: new Date()
                            }
                        }
                    );
                } else {
                    // Update message with error status
                    await Message.updateOne(
                        { _id: newMessage._id },
                        { 
                            $set: { 
                                status: 'failed',
                                errorCode: error.code,
                                errorMessage: error.message,
                                failedAt: new Date()
                            }
                        }
                    );
                }
            } catch (error) {
                console.error('Error sending message:', error);
                await Message.updateOne(
                    { _id: newMessage._id },
                    { 
                        $set: { 
                            status: 'failed',
                            errorCode: 'SEND_ERROR',
                            errorMessage: error.message,
                            failedAt: new Date()
                        }
                    }
                );
            }
        })();

        // Respond immediately with the pending message
        res.status(202).json({
            success: true,
            message: 'Message is being processed',
            data: newMessage
        });

    } catch (error) {
        console.error('Error in send-message:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
=======
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
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f
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