<<<<<<< HEAD
// src/utils/socket.js
import { logError, logInfo, logWarning } from './logger.js';

// Track connected clients and their rooms
const connectedClients = new Map();

export default (io) => {
    // Socket.IO error handling
    io.on('error', (error) => {
        logError('Socket.IO server error:', error);
    });

    // Configure Socket.IO server
    io.engine.on('connection_error', (err) => {
        logError('Socket.IO connection error:', {
            code: err.code,
            message: err.message,
            context: err.context
        });
    });

    // Listen for new client connections
    io.on('connection', (socket) => {
        const clientInfo = {
            id: socket.id,
            connectedAt: new Date(),
            lastActivity: new Date(),
            rooms: new Set()
        };
        
        connectedClients.set(socket.id, clientInfo);
        logInfo(`Client connected: ${socket.id}`, { totalClients: connectedClients.size });

        // Heartbeat mechanism
        const heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                socket.emit('ping');
            }
        }, 25000);

        // Handle client joining a room
        socket.on('join', (contactId, ack) => {
            try {
                if (!contactId) {
                    throw new Error('contactId is required');
                }

                // Leave any existing rooms
                clientInfo.rooms.forEach(room => {
                    socket.leave(room);
                    logInfo(`Client ${socket.id} left room ${room}`);
                });
                clientInfo.rooms.clear();

                // Join the new room
                socket.join(contactId);
                clientInfo.rooms.add(contactId);
                clientInfo.lastActivity = new Date();
                
                logInfo(`Client ${socket.id} joined room ${contactId}`, {
                    rooms: [...clientInfo.rooms]
                });

                // Acknowledge successful join
                if (typeof ack === 'function') {
                    ack({ success: true, room: contactId });
                }
            } catch (error) {
                logError('Error joining room:', {
                    socketId: socket.id,
                    contactId,
                    error: error.message
                });
                
                if (typeof ack === 'function') {
                    ack({ 
                        success: false, 
                        error: error.message 
                    });
                }
            }
        });

        // Handle pong from client
        socket.on('pong', () => {
            clientInfo.lastActivity = new Date();
        });

        // Handle message acknowledgment
        socket.on('message:ack', (ackData, ackCallback) => {
            try {
                const { messageId, status } = ackData;
                if (!messageId || !status) {
                    throw new Error('messageId and status are required');
                }
                
                logInfo(`Message ${messageId} acknowledged with status: ${status}`, {
                    socketId: socket.id,
                    ackData
                });
                
                // Update message status in database
                // This would be implemented with your database logic
                // await updateMessageStatus(messageId, status);
                
                if (typeof ackCallback === 'function') {
                    ackCallback({ success: true });
                }
            } catch (error) {
                logError('Error processing message acknowledgment:', {
                    socketId: socket.id,
                    error: error.message
                });
                
                if (typeof ackCallback === 'function') {
                    ackCallback({ 
                        success: false, 
                        error: error.message 
                    });
                }
            }
        });

        // Handle client disconnection
        socket.on('disconnect', (reason) => {
            clearInterval(heartbeatInterval);
            connectedClients.delete(socket.id);
            
            logInfo(`Client disconnected: ${socket.id}`, {
                reason,
                totalClients: connectedClients.size,
                duration: Math.round((new Date() - clientInfo.connectedAt) / 1000) + 's'
            });
        });
    });

    // Clean up inactive clients
    setInterval(() => {
        const now = new Date();
        const timeout = 300000; // 5 minutes
        
        connectedClients.forEach((client, clientId) => {
            if (now - client.lastActivity > timeout) {
                const socket = io.sockets.sockets.get(clientId);
                if (socket) {
                    socket.disconnect(true);
                    logWarning(`Disconnected inactive client: ${clientId}`, {
                        lastActivity: client.lastActivity,
                        inactiveFor: Math.round((now - client.lastActivity) / 1000) + 's'
                    });
                }
            }
        });
    }, 60000); // Check every minute

    // Helper function to broadcast to a room
    const broadcastToRoom = (room, event, data) => {
        try {
            io.to(room).emit(event, data);
            return true;
        } catch (error) {
            logError(`Error broadcasting to room ${room}:`, error);
            return false;
        }
    };

    // Helper function to get client info
    const getClientInfo = (clientId) => {
        return connectedClients.get(clientId);
    };

    return {
        broadcastToRoom,
        getClientInfo,
        getConnectedClients: () => connectedClients.size
    };
=======
//  src/utils/socket.js

// Export a function that takes a Socket.IO server instance as a parameter
export default (io) => {
    // Listen for new client connections to the Socket.IO server
    io.on('connection', (socket) => {
        // Log when a client connects, including their unique socket ID
        console.log('Client connected:', socket.id);

        // Listen for the 'join' event emitted by a client
        socket.on('join', (contactId) => {
            // Add the client to a room identified by contactId
            socket.join(contactId);
            // Log that the client has joined the specified room
            console.log(`Client ${socket.id} joined room ${contactId}`);
        });

        // Listen for the 'disconnect' event when a client disconnects
        socket.on('disconnect', () => {
            // Log when a client disconnects, including their socket ID
            console.log('Client disconnected:', socket.id);
        });
    });
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f
};