"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuth = void 0;
const Admin_1 = __importDefault(require("../models/Admin"));
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
const jwt_1 = require("../utils/jwt");
//middleware to check if user is authenticated
const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.split(' ')[1];
        // Check if token is present
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized. Please log in again.' });
        }
        const blockedToken = await TokenBlocklist_1.default.findOne({ token });
        if (blockedToken) {
            return res.status(401).json({ success: false, message: 'Token is invalid. Please login again.' });
        }
        // Verify token
        const decodedToken = (0, jwt_1.verifyAccessToken)(token);
        if (typeof decodedToken === 'string' || !decodedToken.id) {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }
        // Check if the user exists in the Admin collection
        const admin = await Admin_1.default.findById(decodedToken.id);
        if (!admin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }
        req.admin = admin;
        next();
    }
    catch (error) {
        console.error(error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }
        else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminAuth = adminAuth;
//# sourceMappingURL=adminAuth.js.map