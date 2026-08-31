import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { generalLimiter } from './middleware/rateLimiter';
import { allowedOrigins } from './config/corsOrigin';

import userRoutes from "./routes/userRoutes";
import productRoutes from './routes/productRoutes';
import cartRouter from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';
import adminRoutes from './routes/adminRoutes';
import refreshRoutes from './routes/refreshRoute';
import paymentRoutes from './routes/paymentRoutes';
import dashboardRoutes from './routes/dashboardRoute';

const app = express();
app.set('trust proxy', 1);

//middleware
    app.use(cors({
        origin: allowedOrigins,  
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Expires', 'Pragma', 'Idempotency-Key'],
        credentials: true 
    }));

    app.use(express.json({
        verify: (req, _res, buf) => {
            (req as any).rawBody = buf.toString('utf8');
        }
    }));

    app.use(cookieParser());
    app.use(helmet()); 
    app.use(morgan('dev'));
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
    
    app.get('/', (req, res) => {
        res.send("API is working");
    });

    export default app;