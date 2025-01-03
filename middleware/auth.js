const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

//middleware to check if user is authenticated
exports.auth = async (req, res, next) => {
const token = req.headers.authorization?.split(' ')[1];

if (!token) {
    return res.status(401).json({ message: 'Access denied' });
}

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    next();
} catch (error) {
    res.status(500).json({ message: error.message }); 
}
};