const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

//middleware to check if user is authenticated
exports.auth = async (req, res, next) => {
const authHeader = req.headers.authorization;

//chech if Authorization header is present
if (!authHeader || !authHeader.startsWith('Bearer')) {
    return res.status(401).json({ message: 'Access denied. No token provided' });
}

const token = authHeader.split(' ')[1];

try {
    //verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //fetch the user details
    const user = await User.findById(decoded.id);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    //attach the user to the request
    req.user = user
    next();
} catch (error) {
    if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please login again' });
    } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: error.message });
}

// if (!token) {
//     return res.status(401).json({ message: 'Access denied' });
// }

// try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = await User.findById(decoded.id);
//     next();
// } catch (error) {
//     res.status(500).json({ message: error.message }); 
// }
};