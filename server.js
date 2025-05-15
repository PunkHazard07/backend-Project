const express = require('express'); //to require express
const http = require('http'); //to require http
const socketIo = require('socket.io'); //to require socket.io
const mongoose = require('mongoose'); //to require mongoose
const cors = require('cors'); //to require cors
const helmet = require('helmet'); //to require helmet //security middleware
const morgan = require('morgan'); //to require morgan //logging middleware
require("dotenv").config(); //to require dotenv


const TokenBlocklist = require('./models/TokenBlocklist'); // Import the cleanup function
const { scheduleCleanupJobs } = require('./utils/cleanup'); // Import the cleanup scehedule function
const { generalLimiter } = require('./middleware/rateLimiter.js'); //to require rate limiter middleware

// Cleanup Function: Removes expired tokens from the blocklist
const cleanupBlocklist = async () => {
    try {
        const now = new Date();
        const result = await TokenBlocklist.deleteMany({ expiresAt: { $lt: now } });
        console.log(`🧹 Cleanup: Removed ${result.deletedCount} expired tokens.`);
    } catch (error) {
        console.error("❌ Error during blocklist cleanup:", error);
    }
};

// Schedule cleanup to run periodically (e.g., every hour)
setInterval(cleanupBlocklist, 60 * 60 * 1000); // Runs every hour

//schedule more comprehensive cleanup jobs
scheduleCleanupJobs(); // Call the function to schedule the cleanup jobs


//connection to my env file
const dbUrl = process.env.MONGODB_URL

//importing Routes
const userRoutes = require('./routes/userRoutes'); //to require userRoutes
const productRoutes = require('./routes/productRoutes'); //to require productRoutes
const cartRouter = require('./routes/cartRoutes'); //to require cartRoutes
const orderRoutes = require('./routes/orderRoutes'); //to require orderRoutes
const adminRoutes = require('./routes/adminRoutes'); //to require adminRoutes
const refreshRoutes = require('./routes/refreshRoute'); //to refresh routes
const paymentRoutes = require('./routes/paymentRoutes'); //to require paymentRoutes
const dashboardRoutes = require('./routes/dashboardRoute'); //to require dashboardRoutes


//to connect it to my mongodb server
mongoose.connect(dbUrl).then(() => {
    console.log("Database connected");
    const app = express(); //to create an instance of express
    const server = http.createServer(app); //to create an instance of http server
    const io = socketIo(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:5174',
                'http://localhost:5175', 'http://localhost:5176',
                'http://localhost:5177', 'http://localhost:5178', 'https://creativefurniture.onrender.com'], // Allow both local ports
            methods: ['GET', 'POST', 'PUT', 'PATCH','DELETE'],
            credentials: true // Add this if you're dealing with cookies or sessions
        }
    });
    app.set('io', io); // Set the io instance in the app for later use
    const port = process.env.PORT; //to set the port
    
    
    //Middleware
    app.use(cors({
        origin: ['http://localhost:5173', 'http://localhost:5174',
            'http://localhost:5175', 'http://localhost:5176',
              'http://localhost:5177', 'http://localhost:5178', 'https://creativefurniture.onrender.com'],  // Allow both local ports
        methods: ['GET', 'POST', 'PUT', 'PATCH','DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Expires', 'Pragma'],
        credentials: true // Add this if you're dealing with cookies or sessions
    }));

    app.use(express.json()); //to convert it to json format
    //security middleware
    app.use(helmet()); //to use helmet
    //logging middleware
    app.use(morgan('dev')); //to use morgan //Notes: 'dev' format is good for development, use 'combined' for production
    //rate limiting middleware - apply general rate limiting to all routes
    app.use(generalLimiter); //to use rate limiter middleware


    //mount api routes
    app.use('/api', userRoutes); //to use the userRoutes
    app.use('/api', productRoutes); //to use the productRoutes
    app.use('/api', cartRouter); //to use the cartRoutes    .........WORKING........
    app.use('/api', orderRoutes); //to use the orderRoutes
    app.use('/api', adminRoutes); //to use the adminRoutes
    app.use('/api', refreshRoutes); //to use the refreshRoutes
    app.use('/api', paymentRoutes); //to use the paymentRoutes
    app.use('/api', dashboardRoutes); //to use the dashboardRoutes
    
    //setup Websocket connection
    io.on('connection', (socket) => {
        console.log(' New socket connection:', socket.id);

        socket.on('join-dashboard', () => {
            socket.join('dashboard-updates');
        });

        socket.on('disconnect', () => {
            console.log(' Socket disconnected:', socket.id);
        });
    });

    //MongoDB change stream 
    const setupChangeStreams = () => {
        const Order = mongoose.model('Order');
        const Product = mongoose.model('Product');

        const orderChangeStream = Order.watch([], { fullDocument: 'updateLookup' });
        const productChangeStream = Product.watch([], { fullDocument: 'updateLookup' });

        // Order Change Stream
        orderChangeStream.on('change', (change) => {
            try {
                if (change.operationType === 'insert') {
                    io.to('dashboard-updates').emit('new-order', {
                        type: 'new-order',
                        data: change.fullDocument
                    });
                } else if (change.operationType === 'update') {
                    io.to('dashboard-updates').emit('order-updated', {
                        type: 'order-updated',
                        documentId: change.documentKey._id,
                        updatedFields: change.updateDescription?.updatedFields || {}
                    });
                } else if (change.operationType === 'delete') {
                    io.to('dashboard-updates').emit('order-deleted', {
                        type: 'order-deleted',
                        documentId: change.documentKey._id
                    });
                }
            } catch (error) {
                console.error('Error processing order change stream:', error);
            }
        }).on('error', (error) => {
            console.error('Order change stream error:', error);
            // Reconnect after delay
            setTimeout(setupChangeStreams, 5000);
        });

        // Product Change Stream
        productChangeStream.on('change', (change) => {
            try {
                if (change.operationType === 'insert') {
                    io.to('dashboard-updates').emit('new-product', {
                        type: 'new-product',
                        data: change.fullDocument
                    });
                } else if (change.operationType === 'update') {
                    io.to('dashboard-updates').emit('product-updated', {
                        type: 'product-updated',
                        documentId: change.documentKey._id,
                        updatedFields: change.updateDescription?.updatedFields || {}
                    });

                    if (change.updateDescription?.updatedFields?.isOutOfStock !== undefined) {
                        io.to('dashboard-updates').emit('inventory-changed', {
                            productId: change.documentKey._id,
                            isOutOfStock: change.updateDescription.updatedFields.isOutOfStock
                        });
                    }
                } else if (change.operationType === 'delete') {
                    io.to('dashboard-updates').emit('product-deleted', {
                        type: 'product-deleted',
                        documentId: change.documentKey._id
                    });
                }
            } catch (error) {
                console.error('Error processing product change stream:', error);
            }
        }).on('error', (error) => {
            console.error('Product change stream error:', error);
            // Reconnect after delay
            setTimeout(setupChangeStreams, 5000);
        });

        console.log('Change streams initialized');
    };

    // Initialize change streams
    setupChangeStreams(); // Call the function to set up change streams

    app.get('/', (req, res) => {
        res.send("API is working"); //to test if the api is running 
    });
    server.listen(port, () => {
        console.log(`😍😍 Server running on port ${port} 🎉🥳`);
    });
}).catch((Error) => {
    console.log(`Failed to connect to MongoDB`, Error);
    process.exit(1); // Exit the process if connection fails
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


