"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVerified = exports.auth = void 0;
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
const User_1 = __importDefault(require("../models/User"));
const jwt_1 = require("../utils/jwt");
const auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'Access denied. No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        // Check if the token exists in the blocklist
        const blockedToken = await TokenBlocklist_1.default.findOne({ token });
        if (blockedToken) {
            return res.status(401).json({ message: 'Token is invalid. Please login again.' });
        }
        // Verify the token
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        if (typeof decoded === 'string' || !decoded.id) {
            return res.status(401).json({ message: 'Invalid token' });
        }
        // Fetch the user details
        const user = await User_1.default.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please login again' });
        }
        else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: error.message });
    }
};
exports.auth = auth;
//confirms user has verified their email
const checkVerified = async (req, res, next) => {
    try {
        if (!req.user?.verified) {
            return res.status(403).json({
                success: false,
                message: 'Email not verified. Please verify your email to continue.',
                isVerified: false
            });
        }
        next();
    }
    catch (error) {
        console.error('Verification check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during verification check.'
        });
    }
};
exports.checkVerified = checkVerified;
//# sourceMappingURL=auth.js.map