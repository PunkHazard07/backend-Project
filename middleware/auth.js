const jwt = require('jsonwebtoken');
const TokenBlocklist = require('../models/TokenBlocklist'); // Import the blocklist model
const User = require('../models/User.js');

exports.auth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: 'Access denied. No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Check if the token exists in the blocklist
        const blockedToken = await TokenBlocklist.findOne({ token });
        if (blockedToken) {
            return res.status(401).json({ message: 'Token is invalid. Please login again.' });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch the user details
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please login again' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: error.message });
    }
};

//email verification check middleware - confirms user has verified their email
exports.checkVerified = async (req, res, next) => {
    try {
        // User is already loaded in req.user from the auth middleware
        if (!req.user.verified) {
            return res.status(403).json({ 
                success: false, 
                message: 'Email not verified. Please verify your email to continue.', 
                isVerified: false 
            });
        }
        next();
    } catch (error) {
        console.error('Verification check error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error during verification check.' 
        });
    }
};
