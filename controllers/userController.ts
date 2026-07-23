import type { Request, Response } from 'express'
import User from '../models/User';
import Order from '../models/Order';
import validator from 'validator';
import jwt from 'jsonwebtoken';
import TokenBlocklist from '../models/TokenBlocklist';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail';
import { generateUserTokens } from '../utils/generateToken';
import { hashValue, compareValue } from '../utils/hashing';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/cookies';

//constants for security settings
const MAX_LOGIN_ATTEMPTS = 5; // Maximum login attempts before lockout
const LOCKOUT_DURATION = 15 * 60 * 1000; // Lockout duration in milliseconds (15 minutes)

// Generate verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate password reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// endpoint for user login
export const loginUser = async (req: Request, res: Response) => {
    //logic for user login
    try {
        const {email, password} = req.body; //to get the email and password from the request body

        const user = await User.findOne({email}); 
        if (!user) {
            return res.status(400).json({ success:false, message: "Invalid credentials" });
            // Using generic message for security
        }

        // Check for account lockout due to too many failed attempts
        if (user.lastLoginAttempt && user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            const lockoutExpires = new Date(user.lastLoginAttempt.getTime() + LOCKOUT_DURATION);
            if (new Date() < lockoutExpires) {
                return res.status(429).json({
                    success: false,
                    message: "Account temporarily locked due to too many failed login attempts. Please try again later."
                });
            } else {
                // Reset counter if lockout period has passed
                user.failedLoginAttempts = 0;
            }
        }

        // Update last login attempt time
        user.lastLoginAttempt = new Date();
        
        // Check if the user is verified
        if (!user.verified) {
            await user.save(); // Save the login attempt timestamp
            return res.status(401).json({ 
                success: false, 
                message: "Please verify your email before logging in",
                isVerified: false
            });
        }

        const isMatch = await compareValue(password, user.password);  
        
        if (isMatch){
            // Reset failed attempts on successful login
            user.failedLoginAttempts = 0;

            const { accessToken, refreshToken } = generateUserTokens(user);
            user.refreshToken = await hashValue(refreshToken);
            await user.save();

            setRefreshTokenCookie(res, refreshToken);
            res.status(200).json({ success:true, message: "User logged in successfully", accessToken });  
        } else{
            // Increment failed login attempts
            user.failedLoginAttempts += 1;
            await user.save();
            
            res.status(400).json({ success:false, message: "Invalid credentials" });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: "An error occurred during login" });
    }
};

//endpoint for user registration
export const registerUser = async (req: Request, res: Response) => {
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
        const exists = await User.findOne({ $or: [{ email }, { username }] }); 
        if (exists) {
            return res.status(400).json({ success:false, message: "User already exists" });
        } 
        
        //checking if the email is valid
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success:false, message: "Invalid email" });
        }
    
        //hashing the password
        const hashedPassword = await hashValue(password);

        // Generate verification token
        const verificationToken = generateVerificationToken();
        const now = new Date();

        //creating a new user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            verified: false, //to set the verified to false
            verificationToken,
            verificationTokenCreatedAt: now
        });

        //saving the user
        await user.save(); //to save the user

        // Send verification email
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        const emailHtml = `
            <h1>Email Verification</h1>
            <p>Hi ${username},</p>
            <p>Thank you for registering. Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not register for an account, please ignore this email.</p>
        `;

        await sendEmail(
            email,
            'Email Verification',
            emailHtml
        );
        
        //sending the response
        res.status(200).json({ 
            success: true, 
            message: "User registered successfully. Please check your email to verify your account." 
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: "Registration failed. Please try again." });
    }
};

// Endpoint for email verification
export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

            if (!token || typeof token !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Verification token is required",
            });
        }

    const user = await User.findOne({ verificationToken: token });
            if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification token",
            });
        }

        if (user.verified) {
            const { accessToken, refreshToken } = generateUserTokens(user);
            user.refreshToken = await hashValue(refreshToken);
            await user.save();
            setRefreshTokenCookie(res, refreshToken);

            return res.status(200).json({
                success: true,
                message: "Email is already verified",
                accessToken,
            });
        }

      // Check token expiry
        if (user.verificationTokenCreatedAt) {
            const tokenAge = new Date().getTime() - user.verificationTokenCreatedAt.getTime();
            if (tokenAge > 24 * 60 * 60 * 1000) {
                return res.status(400).json({
                    success: false,
                    message: "Verification token has expired. Please request a new one.",
                });
            }
        }

        user.verified = true;
        user.verificationToken = null;
        user.verificationTokenCreatedAt = null;

        const { accessToken, refreshToken } = generateUserTokens(user);
        user.refreshToken = await hashValue(refreshToken);

        await user.save();
        setRefreshTokenCookie(res, refreshToken);

        return res.status(200).json({
        success: true,
        message: "Email verified successfully",
        accessToken
    });

    } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
        success: false,
        message: "Verification failed. Please try again.",
      });
    }
};

// Endpoint to resend verification email
export const resendVerificationEmail = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // For security reasons, we'll still return success even if the email doesn't exist
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
            // If token was created less than 5 minutes ago
            if (tokenAge <  10 * 1000) { 
                return res.status(429).json({ 
                    success: false, 
                    message: "Please wait at least 5 minutes before requesting another verification email" 
                });
            }
        }

        // Generate a new verification token
        const verificationToken = generateVerificationToken();
        user.verificationToken = verificationToken;
        user.verificationTokenCreatedAt = new Date();
        await user.save();

        // Send verification email
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        
        const emailHtml = `
            <h1>Email Verification</h1>
            <p>Hi ${user.username},</p>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify Email</a>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not register for an account, please ignore this email.</p>
        `;

        await sendEmail(
            email,
            'Email Verification',
            emailHtml
        );

        res.status(200).json({
            success: true,
            message: "Verification email sent successfully"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Failed to send verification email. Please try again." });
    }
};

//endpoint for user logout
export const logoutUser = async (req: Request, res: Response) => {
    try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
        return res.status(400).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
      // Decode the token to get the expiration time
    const decoded = jwt.decode(token);
        if (!decoded || typeof decoded === 'string' || !decoded.exp) {
            return res.status(400).json({ success: false, message: "Invalid token" });
        }

      // Add the token to the blocklist
    const expirationDate = new Date(decoded.exp * 1000); 
    await TokenBlocklist.create({ token, expiresAt: expirationDate });

    if (decoded.id) {
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null });
    }
    clearRefreshTokenCookie(res);
    
    return res.status(200).json({ success: true, message: "User logged out successfully" });
    } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ success: false, message: "Server error during logout" });
    }
};

// fetch user profile with orders and cart
export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;

        // Fetch user basic data (excluding cartData since it's separate)
        const user = await User.findById(userId).select('-password'); // Exclude password for safety

        // Fetch the cart separately
        // const cart = await Cart.findOne({ user: userId }).populate('items.productID');

        // Order summaries
        const pendingOrders = await Order.countDocuments({ userId, status: "Pending" });
        const shippedOrders = await Order.countDocuments({ userId, status: "Shipped" });
        const deliveredOrders = await Order.countDocuments({ userId, status: "Delivered" });
        const cancelledOrders = await Order.countDocuments({ userId, status: "Cancelled" });
        const totalOrders = await Order.countDocuments({ userId });

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
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        res.status(500).json({ success: false, message });
    }
};

// Endpoint to request password reset (forgot password)
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        
        const user = await User.findOne({ email });
        
        // For security reasons, don't reveal if email exists or not
        if (!user) {
            return res.status(200).json({ 
                success: true, 
                message: "If your email exists in our system, you will receive a password reset link." 
            });
        }
        
        // Check if a reset token was recently sent (prevent spam)
        if (user.resetPasswordExpires && Number(user.resetPasswordExpires) > Date.now()) {
            const resetExpiresMs = Number(user.resetPasswordExpires);
            const timeElapsed = Date.now() - (resetExpiresMs - 3600000); // Assuming 1-hour expiry
            if (timeElapsed < 5 * 60 * 1000) { // If less than 5 minutes ago
                return res.status(429).json({
                    success: false,
                    message: "Please wait at least 5 minutes before requesting another password reset"
                });
            }
        }
        
        // Generate reset token
        const resetToken = generateResetToken();
        
        // Set token expiration (1 hour from now)
        const resetExpiration = Date.now() + 3600000; 
        
        // Save token to user
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = resetExpiration;
        await user.save();
        
        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        // Email template
        const emailHtml = `
            <h1>Password Reset</h1>
            <p>Hi ${user.username},</p>
            <p>You requested a password reset. Please click the link below to reset your password:</p>
            <a href="${resetUrl}">Reset Password</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
        `;
        
        // Send email
        await sendEmail(
            email,
            'Password Reset Request',
            emailHtml
        );
        
        res.status(200).json({
            success: true,
            message: "If your email exists in our system, you will receive a password reset link."
        });
        
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ success: false, message: "Failed to process password reset request" });
    }
};

//verify reset token 
export const verifyResetToken = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).json({ success: false, message: "Reset token is required" });
        }
        
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
        }
        
        res.status(200).json({ success: true, message: "Token is valid" });
        
    } catch (error) {
        console.error("Verify reset token error:", error);
        res.status(500).json({ success: false, message: "Failed to verify reset token" });
    }
};

//reset password
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;
        
        // Validation
        if (!token || !newPassword || !confirmPassword) {
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
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
        }
        
        // Hash the new password
        const hashedPassword = await hashValue(newPassword);
        
        // Update user password and clear reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        user.failedLoginAttempts = 0; // Reset failed login attempts
        
        await user.save();
        
        // Send confirmation email
        const emailHtml = `
            <h1>Password Reset Successful</h1>
            <p>Hi ${user.username},</p>
            <p>Your password has been successfully reset.</p>
            <p>If you didn't perform this action, please contact our support team immediately.</p>
        `;
        
        await sendEmail(
            user.email,
            'Password Reset Successful',
            emailHtml
        );
        
        res.status(200).json({ success: true, message: "Password reset successful" });
        
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ success: false, message: "Failed to reset password" });
    }
};