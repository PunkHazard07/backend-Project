const User = require('../models/User.js'); //importing user model
const validator = require('validator'); //to require validator
const bcrypt = require('bcrypt'); //to require bcrypt
const jwt = require('jsonwebtoken'); //to require jsonwebtoken
const TokenBlocklist = require('../models/TokenBlocklist'); // Import the blocklist model
const crypto = require('crypto'); //to require crypto
const sendEmail = require('../utils/sendEmail'); //to require sendEmail
// console.log("your JWT Secret is: ", process.env.JWT_SECRET); //to test if it is working

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
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${verificationToken}`;
        
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
            return res.status(400).json({ success: false, message: "Verification token is required" });
        }

        // Find the user with the verification token
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid or expired verification token" });
        }

        // Check if token is expired (24 hours)
        if (user.verificationTokenCreatedAt) {
            const tokenAge = new Date() - user.verificationTokenCreatedAt;
            if (tokenAge > 24 * 60 * 60 * 1000) { // 24 hours in milliseconds
                return res.status(400).json({ success: false, message: "Verification token has expired. Please request a new one." });
            }
        }

        // Update user as verified and remove the token
        user.verified = true;
        user.verificationToken = null;
        user.verificationTokenCreatedAt = null;
        await user.save();

        // Generate a token for automatic login after verification (optional)
        const authToken = createToken(user._id);

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            token: authToken
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Verification failed. Please try again." });
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
            if (tokenAge < 5 * 60 * 1000) { 
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
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/verify-email?token=${verificationToken}`;
        
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