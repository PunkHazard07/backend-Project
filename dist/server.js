"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
require("dotenv/config");
const cleanup_1 = require("./utils/cleanup");
const rateLimiter_1 = require("./middleware/rateLimiter");
const corsOrigin_1 = require("./config/corsOrigin"); // Shared CORS origins for REST + sockets
const socket_1 = require("./config/socket");
const changeStream_1 = require("./config/changeStream");
//importing Routes
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const cartRoutes_1 = __importDefault(require("./routes/cartRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const refreshRoute_1 = __importDefault(require("./routes/refreshRoute"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const dashboardRoute_1 = __importDefault(require("./routes/dashboardRoute"));
(0, cleanup_1.scheduleCleanupJobs)();
const dbUrl = process.env.MONGODB_URL;
//to connect it to my mongodb server
mongoose_1.default.connect(dbUrl).then(() => {
    console.log("Database connected");
    const app = (0, express_1.default)();
    const server = http_1.default.createServer(app);
    const io = (0, socket_1.initSocket)(server);
    app.set('io', io);
    const port = process.env.PORT;
    //Middleware
    app.use((0, cors_1.default)({
        origin: corsOrigin_1.allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Expires', 'Pragma'],
        credentials: true
    }));
    app.use(express_1.default.json({
        verify: (req, _res, buf) => {
            req.rawBody = buf.toString('utf8');
        }
    }));
    //parses the httpOnly refreshToken cookie set on login into req.cookies
    app.use((0, cookie_parser_1.default)());
    //security middleware
    app.use((0, helmet_1.default)());
    //logging middleware
    app.use((0, morgan_1.default)('dev'));
    //rate limiting middleware
    app.use(rateLimiter_1.generalLimiter);
    //mount api routes
    app.use('/api', userRoutes_1.default);
    app.use('/api', productRoutes_1.default);
    app.use('/api', cartRoutes_1.default);
    app.use('/api', orderRoutes_1.default);
    app.use('/api', adminRoutes_1.default);
    app.use('/api', refreshRoute_1.default);
    app.use('/api', paymentRoutes_1.default);
    app.use('/api', dashboardRoute_1.default);
    (0, changeStream_1.setupChangeStreams)(io);
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
        await mongoose_1.default.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    }
    catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
});
//# sourceMappingURL=server.js.map