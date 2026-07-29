"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const corsOrigin_1 = require("./corsOrigin");
const Admin_1 = __importDefault(require("../models/Admin"));
//creates and configure the socket.io used to push live update
function initSocket(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: corsOrigin_1.allowedOrigins,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
            credentials: true,
        }
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Not authorized. No token provided.'));
            }
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return next(new Error('Server misconfiguration.'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            const admin = await Admin_1.default.findById(decoded.id);
            if (!admin) {
                return next(new Error('Forbidden: admin access required.'));
            }
            // Stash the admin id on the socket for later use (e.g. logging
            // who's connected, or per-admin logic down the line).
            socket.data.adminId = admin._id;
            next();
        }
        catch (error) {
            next(new Error('Invalid or expired token.'));
        }
    });
    io.on('connection', (socket) => {
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
//# sourceMappingURL=socket.js.map