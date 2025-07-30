<<<<<<< HEAD
import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import messageRoutes from './src/routes/messageRoutes.js';
import webhookRoutes from './src/routes/webhookRoutes.js';
import initializeSocket from './src/utils/socket.js';
import { logInfo, logError } from './src/utils/logger.js';

const app = express();
const server = http.createServer(app);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://resilient-bear-otclnn-dev-ed.lightning.force.com',
      'https://resilient-bear-otclnn-dev-ed.my.salesforce.com',
      'https://whatsappwidget-be.onrender.com',
      'http://localhost:3000',
      'http://localhost:3002'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [
      'https://resilient-bear-otclnn-dev-ed.lightning.force.com',
      'https://resilient-bear-otclnn-dev-ed.my.salesforce.com',
      'https://whatsappwidget-be.onrender.com',
      'http://localhost:3000',
      'http://localhost:3002'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  cookie: false
});

// Make io accessible to routes
app.set('socketio', io);

// Routes
app.use('/api/messages', messageRoutes);

// Webhook Routes (must be before body parser for raw body access)
app.use('/webhook', webhookRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  try {
    // Basic health check - server is responding
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Test database connection
app.get('/api/health/db', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ 
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Function to start the server
const startServer = (port, host) => {
  return new Promise((resolve, reject) => {
    const serverInstance = server.listen(port, host)
      .on('listening', () => {
        logInfo(`Server running on http://${host}:${port}`);
        logInfo(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logInfo(`Health check: http://${host}:${port}/api/health`);
        logInfo(`Database health: http://${host}:${port}/api/health/db`);
        resolve(serverInstance);
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logError(`Port ${port} is already in use. Trying next port...`);
          // Try next port if current one is in use
          startServer(port + 1, host).then(resolve).catch(reject);
        } else {
          logError('Server error:', err);
          reject(err);
        }
      });
  });
};

// Connect to MongoDB and start server
const connectDB = async () => {
  try {
    logInfo('Attempting to connect to MongoDB...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    
    const dbOptions = {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    };
    
    await mongoose.connect(process.env.MONGO_URI, dbOptions);
    
    // Connection events for better debugging
    mongoose.connection.on('connected', () => {
      logInfo('MongoDB connected successfully');
    });
    
    mongoose.connection.on('error', (err) => {
      logError('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logInfo('MongoDB disconnected');
    });
    
    // Initialize Socket.IO after DB connection
    initializeSocket(io);
    
    // Start server
    const PORT = parseInt(process.env.PORT || '3002', 10);
    const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
    
    await startServer(PORT, HOST);
    
  } catch (error) {
    logError('Failed to start server:', error.message);
    
    if (error.message.includes('MongoDB')) {
      logError('Connection string:', process.env.MONGO_URI ? '*** (hidden for security) ***' : 'undefined');
    }
    
    // Graceful shutdown
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logError('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logError('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// Connect to the database
connectDB();

// Export the Express API for Vercel
export default app;
=======
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
>>>>>>> 96f2356b80696e5eb0fe620a63bf2eb7906d304f
