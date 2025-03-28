const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { generateTokens } = require('../utils/generateToken');

exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        //verify old token exist in database
        const admin = await Admin.findOne({ refreshToken });
        if (!admin) {
            return res.status(400).json({ success: false, message: "invalid refresh token" });
        }

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: "Refresh token required" });
        }

        // Verify refresh token
        jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
            }

            // Generate new tokens (access & refresh)
            const { accessToken, refreshToken: newRefreshToken } = generateTokens({ _id: decoded.id });

            res.status(200).json({
                success: true,
                accessToken,
                refreshToken: newRefreshToken,
            });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
