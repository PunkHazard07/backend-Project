const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin')


//middleware to check if user is authenticated
exports.adminAuth = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const token = req.header('Authorization')?.split(' ')[1];

        // Check if token is present
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized. Please log in again.' });
        }

        // Verify token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        // Check if the user exists in the Admin collection
        const admin = await Admin.findById(decodedToken.id);

        if (!admin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        req.user = admin; // Attach admin data to the request
        next();
    } catch (error) {
        console.error(error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
        }

        res.status(500).json({ success: false, message: error.message });
    }
};


