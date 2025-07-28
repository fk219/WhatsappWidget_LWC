import express from 'express'; // Import Express framework
import dotenv from 'dotenv'; // Import dotenv for environment variables
import cors from 'cors'; // Import CORS middleware
import bodyParser from 'body-parser'; // Import body-parser for parsing requests

import connectDB from './src/config/db.js'; // Import MongoDB connection function
import messageRoutes from './src/routes/messageRoutes.js'; // Import message routes
import webhookRoutes from './src/routes/webhookRoutes.js'; // Import webhook routes
dotenv.config(); // Load environment variables from .env file

// Socket IO dependencies and Function
import http from 'http'; // Import HTTP module
import { Server } from 'socket.io'; // Import Socket.IO Server class
import socketHandler from './src/utils/socket.js'; // Import Socket.IO handler

const app = express(); // Create Express app instance
const server = http.createServer(app); // Create HTTP server with Express app

const io = new Server(server, { // Initialize Socket.IO with server
    cors: { // Configure CORS for Socket.IO
        origin: 'http://localhost:5500', // Allow connections from frontend
        methods: ['GET', 'POST']
    }
});



connectDB(); // Connect to MongoDB
socketHandler(io); // Initialize Socket.IO handler


// Middlewares
app.use(cors()); // Enable CORS for Express routes
app.use(bodyParser.json()); // Parse JSON request bodies
app.use(bodyParser.urlencoded({ extended: false })); // Parse URL-encoded bodies


// Routes
app.use('/api/messages', messageRoutes); // Mount message routes
app.use('/webhook', webhookRoutes); // Mount webhook routes


const PORT = process.env.PORT || 3002; // Set port from env or default to 3001
server.listen(PORT, () => { 
    console.log(`Twilio Backend running on http://localhost:${PORT}`); // Log server start
});