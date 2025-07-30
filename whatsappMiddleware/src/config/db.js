import mongoose from 'mongoose'; // Import Mongoose library for MongoDB interaction

const connectDB = async () => {
    try {
        // Validate MongoDB URI
        if (!process.env.MONGO_URI) { // Check if MONGO_URI environment variable is set
            console.error('No MongoDB URI provided'); // Log error if URI is missing
            process.exit(1); // Exit process with failure code
        }

        // Set up connection event listeners
        mongoose.connection.on('connected', () => { // Event listener for successful connection
            console.log(`MongoDB Connected Successfully!: ${mongoose.connection.host}`); // Log connection success
        });
        mongoose.connection.on('disconnected', () => { // Event listener for disconnection
            console.error('MongoDB Disconnected'); // Log disconnection
        });
        mongoose.connection.on('error', (err) => { // Event listener for connection errors
            console.error(`MongoDB Connection Error: ${err.message}`); // Log error message
        });

        // Handle purposeful shutdown
        const shutdown = async () => { // Define shutdown function for graceful termination
            await mongoose.connection.close(); // Close MongoDB connection
            console.log('MongoDB Connection Closed'); // Log closure
            process.exit(0); // Exit process successfully
        };

        // Connect to MongoDB
        console.log('Connecting to MongoDB...'); // Log connection attempt
        await mongoose.connect(process.env.MONGO_URI); // Connect to MongoDB using URI

        // Handle process termination
        process.on('SIGINT', shutdown); // Listen for SIGINT (Ctrl+C) to trigger shutdown
        process.on('SIGTERM', shutdown); // Listen for SIGTERM to trigger shutdown

    } catch (err) {
        console.error(`Failed to connect to MongoDB: ${err.message}`); // Log connection failure
        process.exit(1); // Exit process with failure code
    }
};

export default connectDB; // Export connectDB function for use in other modules