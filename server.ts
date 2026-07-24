import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import 'dotenv/config';

import { scheduleCleanupJobs } from './utils/cleanup';
import { generalLimiter } from './middleware/rateLimiter';
import { allowedOrigins } from './config/corsOrigin'; // Shared CORS origins for REST + sockets
import { initSocket } from './config/socket'; 
import { setupChangeStreams } from './config/changeStream'; 

//importing Routes
import userRoutes from './routes/userRoutes';
import productRoutes from './routes/productRoutes';
import cartRouter from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import refreshRoutes from './routes/refreshRoute';
import paymentRoutes from './routes/paymentRoutes';
import dashboardRoutes from './routes/dashboardRoute';

scheduleCleanupJobs();
const dbUrl = process.env.MONGODB_URL;

//to connect it to my mongodb server
mongoose.connect(dbUrl as string).then(() => {
    console.log("Database connected");
    const app = express(); 
    const server = http.createServer(app);
    const io = initSocket(server); 
    app.set('io', io); 
    const port = process.env.PORT; 

    //Middleware
    app.use(cors({
        origin: allowedOrigins,  
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Expires', 'Pragma'],
        credentials: true 
    }));

    app.use(express.json()); 
    //parses the httpOnly refreshToken cookie set on login into req.cookies
    app.use(cookieParser());
    //security middleware
    app.use(helmet()); 
    //logging middleware
    app.use(morgan('dev')); 
    //rate limiting middleware
    app.use(generalLimiter);

    //mount api routes
    app.use('/api', userRoutes); 
    app.use('/api', productRoutes); 
    app.use('/api', cartRouter); 
    app.use('/api', orderRoutes);
    app.use('/api', adminRoutes); 
    app.use('/api', refreshRoutes); 
    app.use('/api', paymentRoutes); 
    app.use('/api', dashboardRoutes); 

    setupChangeStreams(io);

    app.get('/', (req, res) => {
        res.send("API is working");
    });
    server.listen(port, () => {
        console.log(`😍😍 Server running on port ${port} 🎉🥳`);
    });
}).catch((error) => {
    console.log(`Failed to connect to MongoDB`, error);
    process.exit(1); 
});

// Handle process termination
process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
});