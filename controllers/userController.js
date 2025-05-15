const User = require('../models/User.js'); //importing user model
const Order = require('../models/Order.js');
const validator = require('validator'); //to require validator
const bcrypt = require('bcrypt'); //to require bcrypt
const jwt = require('jsonwebtoken'); //to require jsonwebtoken
const TokenBlocklist = require('../models/TokenBlocklist'); // Import the blocklist model
const crypto = require('crypto'); //to require crypto
const sendEmail = require('../utils/sendEmail'); //to require sendEmail
// console.log("your JWT Secret is: ", process.env.JWT_SECRET); //to test if it is working
// const Cart = require('../models/Cart'); // adjust the path if needed

//creating endpoint for users

//constants for security settings
const MAX_LOGIN_ATTEMPTS = 5; // Maximum login attempts before lockout
const LOCKOUT_DURATION = 15 * 60 * 1000; // Lockout duration in milliseconds (15 minutes)

//generating token
const createToken =(id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: '2h'}); //to create a token
}

// Generate verification token
const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate password reset token
const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// endpoint for user login
exports.loginUser = async (req, res) => {
    //logic for user login
    try {
        const {email, password} = req.body; //to get the email and password from the request body

        const user = await User.findOne({email}); //to find the user by email
        if (!user) {
            return res.status(400).json({ success:false, message: "Invalid credentials" });
            // Using generic message for security
        }

        // Check for account lockout due to too many failed attempts
        if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
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

        const isMatch = await bcrypt.compare(password, user.password); //to compare the password
        
        if (isMatch){
            // Reset failed attempts on successful login
            user.failedLoginAttempts = 0;
            await user.save();
            
            const token = createToken(user._id); //to create a token
            res.status(200).json({ success:true, message: "User logged in successfully", token });  
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
exports.registerUser = async (req, res) => {
    //logic for user registration
    try {
        const { username, email, password } = req.body; //to get the username, email and password from the request body
        
        // Input validation
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        
        // Password strength validation
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters long" });
        }
        
        //checking if the user already exist
        const exists = await User.findOne({ $or: [{ email }, { username }] }); //to find the user by email or username
        if (exists) {
            return res.status(400).json({ success:false, message: "User already exists" });
        } 
        
        //checking if the email is valid
        if (!validator.isEmail(email)) {
            return res.status(400).json({ success:false, message: "Invalid email" });
        }
    
        //hashing the password
        const salt = await bcrypt.genSalt(10); //to generate a salt
        const hashedPassword = await bcrypt.hash(password, salt); //to hash the password

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
exports.verifyEmail = async (req, res) => {
    try {
      const { token } = req.query;
  
      if (!token) {
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
  
      // If already verified
      if (user.verified) {
        return res.status(200).json({
          success: true,
          message: "Email is already verified",
          token: createToken(user._id),
        });
      }
  
      // Check token expiry
      if (user.verificationTokenCreatedAt) {
        const tokenAge = new Date() - user.verificationTokenCreatedAt;
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
  
      await user.save();
  
      const authToken = createToken(user._id);
  
      return res.status(200).json({
        success: true,
        message: "Email verified successfully",
        token: authToken,
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
exports.resendVerificationEmail = async (req, res) => {
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
            const tokenAge = new Date() - user.verificationTokenCreatedAt;
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
exports.logoutUser = async (req, res) => {
    try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer")) {
        return res.status(400).json({ success: false, message: "No token provided" });
    }
        // Extract the token from the header
    const token = authHeader.split(" ")[1];
      // Decode the token to get the expiration time
    const decoded = jwt.decode(token);
    if (!decoded) {
        return res.status(400).json({ success: false, message: "Invalid token" });
    }

      // Add the token to the blocklist
      const expirationDate = new Date(decoded.exp * 1000); // Token expiration time
    await TokenBlocklist.create({ token, expiresAt: expirationDate });
    

    return res.status(200).json({ success: true, message: "User logged out successfully" });
    } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ success: false, message: "Server error during logout" });
    }
};

// fetch user profile with orders and cart

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user._id;

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
        res.status(500).json({ success: false, message: error.message });
    }
};


// Endpoint to request password reset (forgot password)
exports.forgotPassword = async (req, res) => {
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
        if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now()) {
            const timeElapsed = new Date() - new Date(user.resetPasswordExpires - 3600000); // Assuming 1-hour expiry
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
        const resetExpiration = Date.now() + 3600000; // 1 hour in milliseconds
        
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
exports.verifyResetToken = async (req, res) => {
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
exports.resetPassword = async (req, res) => {
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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
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