import type { Server as HttpServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken'
import { allowedOrigins } from './corsOrigin';
import Admin from '../models/Admin';

interface AdminTokenPayload {
    id: string
}

//creates and configure the socket.io used to push live update
export function initSocket(server: HttpServer): SocketIOServer {
    const io = new SocketIOServer(server, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            credentials: true, 
        }
    });
    
    io.use(async (socket, next) => {
            try {
            const token: string | undefined =
                socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Not authorized. No token provided.'));
            }

            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return next(new Error('Server misconfiguration.'));
            }

            const decoded = jwt.verify(token, secret) as AdminTokenPayload;
            const admin = await Admin.findById(decoded.id);

            if (!admin) {
                return next(new Error('Forbidden: admin access required.'));
            }

            // Stash the admin id on the socket for later use (e.g. logging
            // who's connected, or per-admin logic down the line).
            socket.data.adminId = admin._id;
            next();
        } catch (error) {
            next(new Error('Invalid or expired token.'));
        }
    });
    
    io.on('connection', (socket: Socket) => {
        console.log(' New authenticated admin socket connection:', socket.id);

        socket.on('join-dashboard', () => {
            socket.join('dashboard-updates');
        });

        socket.on('disconnect', () => {
            console.log(' Socket disconnected:', socket.id);
        });
    });

    return io;
}