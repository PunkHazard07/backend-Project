"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.logoutadmin = exports.adminLogin = exports.registerAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Admin_1 = __importDefault(require("../models/Admin"));
const hashing_1 = require("../utils/hashing");
const generateToken_1 = require("../utils/generateToken");
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
const jwt_1 = require("../utils/jwt");
const cookies_1 = require("../utils/cookies");
//route for admin registration
const registerAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }
        //check if the admin already exists
        const exists = await Admin_1.default.findOne({ email });
        if (exists) {
            return res.status(400).json({ success: false, message: "Admin already exists" });
        }
        const hashedPassword = await (0, hashing_1.hashValue)(password);
        //create a new admin
        const newAdmin = await Admin_1.default.create({
            email,
            password: hashedPassword,
        });
        //send success response with token
        res.status(201).json({ success: true, message: "Admin registered successfully", adminId: newAdmin._id });
    }
    catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
        });
    }
};
exports.registerAdmin = registerAdmin;
//route for admin login
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }
        // Find admin in database
        const admin = await Admin_1.default.findOne({ email });
        if (!admin) {
            return res.status(400).json({ success: false, message: "Invalid credential" });
        }
        // Compare hashed password
        const isMatch = await (0, hashing_1.compareValue)(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }
        // Generate tokens (access & refresh)
        const { accessToken, refreshToken } = (0, generateToken_1.generateAdminTokens)(admin);
        //save the token in the database
        admin.refreshToken = await (0, hashing_1.hashValue)(refreshToken);
        await admin.save();
        (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
        res.status(200).json({
            success: true,
            message: "Admin logged in successfully",
            accessToken
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.adminLogin = adminLogin;
//endpoint for admin logout
const logoutadmin = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const accessToken = authHeader.split(' ')[1];
            const decoded = jsonwebtoken_1.default.decode(accessToken);
            if (decoded && typeof decoded !== 'string' && decoded.exp) {
                await TokenBlocklist_1.default.create({
                    token: accessToken,
                    expiresAt: new Date(decoded.exp * 1000),
                });
            }
        }
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            try {
                const decodedRefresh = (0, jwt_1.verifyRefreshToken)(refreshToken);
                if (typeof decodedRefresh !== 'string' && decodedRefresh.id) {
                    await Admin_1.default.findByIdAndUpdate(decodedRefresh.id, { refreshToken: null });
                }
            }
            catch {
                // Refresh token invalid/expired — nothing to revoke,
                // still fall through to clear the cookie below.
            }
        }
        (0, cookies_1.clearRefreshTokenCookie)(res);
        res.status(200).json({ success: true, message: "Admin logged out successfully" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.logoutadmin = logoutadmin;
const verifyToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ valid: false, message: "Access denied. No token provided." });
        }
        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = (0, jwt_1.verifyAccessToken)(token);
        }
        catch (error) {
            return res.status(403).json({ valid: false, message: "Invalid or expired token" });
        }
        if (typeof decoded === 'string' || !decoded.id) {
            return res.status(403).json({ valid: false, message: "Invalid token" });
        }
        const admin = await Admin_1.default.findById(decoded.id);
        if (!admin) {
            return res.status(403).json({ valid: false, message: "Forbidden: Admin access required" });
        }
        return res.json({ valid: true, user: { id: admin._id, email: admin.email } });
    }
    catch (error) {
        console.error("Verify token error:", error);
        res.status(500).json({ valid: false, message: "Internal server error" });
    }
};
exports.verifyToken = verifyToken;
//# sourceMappingURL=adminController.js.map