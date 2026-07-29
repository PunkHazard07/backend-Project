"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.verifyResetToken = exports.forgotPassword = exports.getUserProfile = exports.logoutUser = exports.resendVerificationEmail = exports.verifyEmail = exports.registerUser = exports.loginUser = void 0;
const User_1 = __importDefault(require("../models/User"));
const Order_1 = __importDefault(require("../models/Order"));
const validator_1 = __importDefault(require("validator"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
const verification_1 = require("../utils/verification");
const index_1 = require("../utils/notification/index");
const generateToken_1 = require("../utils/generateToken");
const hashing_1 = require("../utils/hashing");
const cookies_1 = require("../utils/cookies");
//constants for security settings
const MAX_LOGIN_ATTEMPTS = 5; // Maximum login attempts before lockout
const LOCKOUT_DURATION = 15 * 60 * 1000; // Lockout duration in milliseconds (15 minutes)
// endpoint for user login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }
        // Check for account lockout due to too many failed attempts
        if (user.lastLoginAttempt && user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            const lockoutExpires = new Date(user.lastLoginAttempt.getTime() + LOCKOUT_DURATION);
            if (new Date() < lockoutExpires) {
                return res.status(429).json({
                    success: false,
                    message: "Account temporarily locked due to too many failed login attempts. Please try again later."
                });
            }
            else {
                // Reset counter if lockout period has passed
                user.failedLoginAttempts = 0;
            }
        }
        // Update last login attempt time
        user.lastLoginAttempt = new Date();
        // Check if the user is verified
        if (!user.verified) {
            await user.save();
            return res.status(401).json({
                success: false,
                message: "Please verify your email before logging in",
                isVerified: false
            });
        }
        const isMatch = await (0, hashing_1.compareValue)(password, user.password);
        if (isMatch) {
            // Reset failed attempts on successful login
            user.failedLoginAttempts = 0;
            const { accessToken, refreshToken } = (0, generateToken_1.generateUserTokens)(user);
            user.refreshToken = await (0, hashing_1.hashValue)(refreshToken);
            await user.save();
            (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
            res.status(200).json({ success: true, message: "User logged in successfully", accessToken });
        }
        else {
            // Increment failed login attempts
            user.failedLoginAttempts += 1;
            await user.save();
            res.status(400).json({ success: false, message: "Invalid credentials" });
        }
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "An error occurred during login" });
    }
};
exports.loginUser = loginUser;
//endpoint for user registration
const registerUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Input validation
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
        }
        //checking if the user already exist
        const exists = await User_1.default.findOne({ $or: [{ email }, { username }] });
        if (exists) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        //checking if the email is valid
        if (!validator_1.default.isEmail(email)) {
            return res.status(400).json({ success: false, message: "Invalid email" });
        }
        //hashing the password
        const hashedPassword = await (0, hashing_1.hashValue)(password);
        // Generate verification token
        const verificationToken = (0, verification_1.generateVerificationToken)();
        const now = new Date();
        //creating a new user
        const user = new User_1.default({
            username,
            email,
            password: hashedPassword,
            verified: false, //to set the verified to false
            verificationToken,
            verificationTokenCreatedAt: now
        });
        //saving the user
        await user.save();
        await (0, index_1.sendNotification)({
            purpose: index_1.NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
            data: { email, fullName: username, code: verificationToken },
        });
        await (0, index_1.sendNotification)({
            purpose: index_1.NOTIFICATION_PURPOSE.WELCOME_EMAIL,
            data: { email, fullName: username },
        });
        res.status(200).json({
            success: true,
            message: "User registered successfully. Please check your email to verify your account."
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Registration failed. Please try again." });
    }
};
exports.registerUser = registerUser;
// Endpoint for email verification
const verifyEmail = async (req, res) => {
    try {
        const { email, code } = req.query;
        if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Email and verification code are required",
            });
        }
        const user = await User_1.default.findOne({ email, verificationToken: code });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification token",
            });
        }
        if (user.verified) {
            const { accessToken, refreshToken } = (0, generateToken_1.generateUserTokens)(user);
            user.refreshToken = await (0, hashing_1.hashValue)(refreshToken);
            await user.save();
            (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
            return res.status(200).json({
                success: true,
                message: "Email is already verified",
                accessToken,
            });
        }
        // Check token expiry
        if (user.verificationTokenCreatedAt) {
            const tokenAge = new Date().getTime() - user.verificationTokenCreatedAt.getTime();
            if (tokenAge > 10 * 60 * 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Verification code has expired. Please request a new one.",
                });
            }
        }
        user.verified = true;
        user.verificationToken = null;
        user.verificationTokenCreatedAt = null;
        const { accessToken, refreshToken } = (0, generateToken_1.generateUserTokens)(user);
        user.refreshToken = await (0, hashing_1.hashValue)(refreshToken);
        await user.save();
        (0, cookies_1.setRefreshTokenCookie)(res, refreshToken);
        return res.status(200).json({
            success: true,
            message: "Email verified successfully",
            accessToken
        });
    }
    catch (error) {
        console.error("Email verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Verification failed. Please try again.",
        });
    }
};
exports.verifyEmail = verifyEmail;
// Endpoint to resend verification email
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If your email exists in our system, a verification email has been sent."
            });
        }
        if (user.verified) {
            return res.status(400).json({ success: false, message: "Email is already verified" });
        }
        // Check if a token was recently sent (prevent spam)
        if (user.verificationTokenCreatedAt) {
            const tokenAge = new Date().getTime() - user.verificationTokenCreatedAt.getTime();
            if (tokenAge < 5 * 60 * 1000) {
                return res.status(429).json({
                    success: false,
                    message: "Please wait at least 5 minutes before requesting another verification email"
                });
            }
        }
        // Generate a new verification token
        const verificationToken = (0, verification_1.generateVerificationToken)();
        user.verificationToken = verificationToken;
        user.verificationTokenCreatedAt = new Date();
        await user.save();
        await (0, index_1.sendNotification)({
            purpose: index_1.NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
            data: { email, fullName: user.username, code: verificationToken },
        });
        res.status(200).json({
            success: true,
            message: "Verification email sent successfully"
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
    }
};
exports.resendVerificationEmail = resendVerificationEmail;
//endpoint for user logout
const logoutUser = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(400).json({ success: false, message: "No token provided" });
        }
        const token = authHeader.split(" ")[1];
        // Decode the token to get the expiration time
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || typeof decoded === 'string' || !decoded.exp) {
            return res.status(400).json({ success: false, message: "Invalid token" });
        }
        // Add the token to the blocklist
        const expirationDate = new Date(decoded.exp * 1000);
        await TokenBlocklist_1.default.create({ token, expiresAt: expirationDate });
        if (decoded.id) {
            await User_1.default.findByIdAndUpdate(decoded.id, { refreshToken: null });
        }
        (0, cookies_1.clearRefreshTokenCookie)(res);
        return res.status(200).json({ success: true, message: "User logged out successfully" });
    }
    catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ success: false, message: "Server error during logout" });
    }
};
exports.logoutUser = logoutUser;
// fetch user profile with orders and cart
const getUserProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        const user = await User_1.default.findById(userId).select('-password');
        // Fetch the cart separately
        // const cart = await Cart.findOne({ user: userId }).populate('items.productID');
        // Order summaries
        const pendingOrders = await Order_1.default.countDocuments({ userId, status: "Pending" });
        const shippedOrders = await Order_1.default.countDocuments({ userId, status: "Shipped" });
        const deliveredOrders = await Order_1.default.countDocuments({ userId, status: "Delivered" });
        const cancelledOrders = await Order_1.default.countDocuments({ userId, status: "Cancelled" });
        const totalOrders = await Order_1.default.countDocuments({ userId });
        res.status(200).json({
            success: true,
            user,
            // cart: cart || { items: [], total: 0 },
            ordersSummary: {
                total: totalOrders,
                pending: pendingOrders,
                shipped: shippedOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders,
            },
        });
    }
    catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ success: false, message });
    }
};
exports.getUserProfile = getUserProfile;
// Endpoint to request password reset (forgot password)
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        const user = await User_1.default.findOne({ email });
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If your email exists in our system, you will receive a password reset link."
            });
        }
        // Check if a reset token was recently sent (prevent spam)
        if (user.resetPasswordCreatedAt) {
            const tokenAge = Date.now() - user.resetPasswordCreatedAt.getTime();
            if (tokenAge < 5 * 60 * 1000) {
                return res.status(429).json({
                    success: false,
                    message: "Please wait at least 5 minutes before requesting another password reset"
                });
            }
        }
        // Generate reset token
        const resetToken = (0, verification_1.generateResetToken)();
        // Set token expiration (10 min from now)
        const resetExpiration = Date.now() + 10 * 60 * 1000;
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetExpiration;
        user.resetPasswordCreatedAt = new Date();
        await user.save();
        // Send email
        await (0, index_1.sendNotification)({
            purpose: index_1.NOTIFICATION_PURPOSE.FORGOT_PASSWORD,
            data: { email, fullName: user.username, code: resetToken },
        });
        res.status(200).json({
            success: true,
            message: "If your email exists in our system, you will receive a password reset link."
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ success: false, message: "Failed to process password reset request" });
    }
};
exports.forgotPassword = forgotPassword;
//verify reset token 
const verifyResetToken = async (req, res) => {
    try {
        const { email, code } = req.query;
        if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
            return res.status(400).json({ success: false, message: "Email and reset code are required" });
        }
        const user = await User_1.default.findOne({
            email,
            resetPasswordToken: code,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
        }
        res.status(200).json({ success: true, message: "Token is valid" });
    }
    catch (error) {
        console.error("Verify reset token error:", error);
        res.status(500).json({ success: false, message: "Failed to verify reset token" });
    }
};
exports.verifyResetToken = verifyResetToken;
//reset password
const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword, confirmPassword } = req.body;
        // Validation
        if (!email || !code || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }
        // Password strength validation
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
        }
        // Find user with valid token
        const user = await User_1.default.findOne({
            email,
            resetPasswordToken: code,
            resetPasswordExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset code" });
        }
        // Hash the new password
        const hashedPassword = await (0, hashing_1.hashValue)(newPassword);
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        user.failedLoginAttempts = 0; // Reset failed login attempts
        await user.save();
        await (0, index_1.sendNotification)({
            purpose: index_1.NOTIFICATION_PURPOSE.PASSWORD_RESET_SUCCESS,
            data: { email: user.email, fullName: user.username },
        });
        res.status(200).json({ success: true, message: "Password reset successful" });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ success: false, message: "Failed to reset password" });
    }
};
exports.resetPassword = resetPassword;
//# sourceMappingURL=userController.js.map