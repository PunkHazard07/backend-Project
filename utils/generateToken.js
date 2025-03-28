const jwt = require('jsonwebtoken');

exports.generateToken = (admin) => {
    if(!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT_SECRET is missing from the .env file');
    }

    const accessToken = jwt.sign(
        { id: admin._id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
        { id: admin._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' } // Long-lived refresh token
    );

    return { accessToken, refreshToken };
};
