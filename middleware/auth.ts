import type { Request, Response, NextFunction } from 'express';
import TokenBlocklist from '../models/TokenBlocklist';
import User from '../models/User';
import { verifyAccessToken } from '../utils/jwt';

export const auth = async (req: Request, res: Response, next: NextFunction) => {
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
        const decoded = verifyAccessToken(token);
        if (typeof decoded === 'string' || !decoded.id) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        // Fetch the user details
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired. Please login again' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        res.status(500).json({ message: error.message });
    }
};

//confirms user has verified their email
export const checkVerified = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.verified) {
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
