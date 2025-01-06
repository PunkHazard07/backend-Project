const jwt = require('jsonwebtoken');


//middleware to check if user is authenticated
exports.adminAuth = async (req, res, next) => {
    try {
        //extract token from authorization header (Bearer token)
        const token = req.header('Authorization') && req.header('Authorization').startsWith('Bearer ') 
        ? req.header('Authorization').split(' ')[1] 
        : null;

    //check if token is present
    if (!token) {
        return res.status(401).json({success: false, message: 'Not authorized Login Again' });
    }

    //verify the token
    const token_decode = jwt.verify(token, process.env.JWT_SECRET);

    //check if the user is admin
    if (token_decode.role !== 'admin') {
        return res.status(403).json({success: false, message: 'Forbidden' });
    }

    //attach the user to the request
    req.user = token_decode;
    next();
    } catch (error) {
        console.log(error);
        
         // Handle different types of errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
        }

        res.status(500).json({ success: false, message: error.message });
    }

};

