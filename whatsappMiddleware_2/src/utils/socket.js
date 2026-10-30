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
};