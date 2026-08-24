import http from 'http';
import mongoose from 'mongoose';
import 'dotenv/config';
import app from './app';
import { emailWorker } from './utils/notification/worker';
import { scheduleCleanupJobs } from './utils/cleanup';
import { initSocket } from './config/socket'; 
import { setupChangeStreams } from './config/changeStream'; 

scheduleCleanupJobs();
const dbUrl = process.env.MONGODB_URL;

//to connect it to my mongodb server
mongoose.connect(dbUrl as string).then(() => {
    console.log("Database connected");
    const server = http.createServer(app);
    const io = initSocket(server); 
    app.set('io', io); 
    const port = process.env.PORT; 

    setupChangeStreams(io);

    server.listen(process.env.PORT, () => {
        console.log(`Server running on port ${process.env.PORT}`);
    });
}).catch((error) => {
    console.log(`Failed to connect to MongoDB`, error);
    process.exit(1); 
});

// Handle process termination
const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    try {
        await emailWorker.close();
        console.log('Email worker closed');

        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));