const express = require('express'); //to require express
const mongoose = require('mongoose'); //to require mongoose
const cors = require('cors'); //to require cors
const cookieParser = require('cookie-parser'); //to require cookie-parser
// const connectCloudinary = require('./config/cloudinary'); //to require connectCloudinary
require("dotenv").config(); //to require dotenv
const TokenBlocklist = require('./models/TokenBlocklist'); // Import the cleanup function

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


//connection to my env file
const dbUrl = process.env.MONGODB_URL
// console.log(dbUrl) //to test if it exist/ working

//importing Routes
const userRoutes = require('./routes/userRoutes'); //to require userRoutes
const productRoutes = require('./routes/productRoutes'); //to require productRoutes
const cartRouter = require('./routes/cartRoutes'); //to require cartRoutes
const orderRoutes = require('./routes/orderRoutes'); //to require orderRoutes
const adminRoutes = require('./routes/adminRoutes'); //to require adminRoutes

//to connect it to my mongodb server
mongoose.connect(dbUrl).then(() => {
    console.log("Database connected");
    const app = express(); //to create an instance of express
    const port =  8080; //to set the port
    

    //Middleware
    app.use(express.json()); //to convert it to json format
    app.use(cors({
        origin: ['http://localhost:5173', 'http://localhost:5174',
            'http://localhost:5175', 'http://localhost:5176',
              'http://localhost:5177', 'http://localhost:5178', 'https://essence-of-style.onrender.com'],  // Allow both local ports
        methods: ['GET', 'POST', 'PUT', 'PASTE','DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Expires', 'Pragma'],
        credentials: true // Add this if you're dealing with cookies or sessions
    }));

    app.use(cookieParser()); //to use cookie-parser 

    //mount api routes
    app.use('/api', userRoutes); //to use the userRoutes
    app.use('/api', productRoutes); //to use the productRoutes
    app.use('/api', cartRouter); //to use the cartRoutes    .........WORKING........
    app.use('/api', orderRoutes); //to use the orderRoutes
    app.use('/api', adminRoutes); //to use the adminRoutes

    app.get('/', (req, res) => {
        res.send("API is working"); //to test if the api is running 
    });
    app.listen(port, () => {
        console.log(`😍😍 Server running on port ${port} 🎉🥳`);
    });
}).catch((Error) => {
    console.log(`Failed to connect to MongoDB`, Error);
})


