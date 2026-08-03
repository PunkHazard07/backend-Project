import type { Request, Response, NextFunction } from 'express';
import Admin from '../models/Admin';
import TokenBlocklist from '../models/TokenBlocklist';
import { verifyAccessToken } from '../utils/jwt';

//middleware to check if user is authenticated
export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.split(' ')[1];

        // Check if token is present
        if (!token) {
            return res.status(401).json({ success: false, message: 'Not authorized. Please log in again.' });
        }

        const blockedToken = await TokenBlocklist.findOne({ token });
        if (blockedToken) {
            return res.status(401).json({ success: false, message: 'Token is invalid. Please login again.' });
        }

        // Verify token
        const decodedToken = verifyAccessToken(token);
        if (typeof decodedToken === 'string' || !decodedToken.id || decodedToken.role !== 'admin') {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        }

        // Check if the user exists in the Admin collection
        const admin = await Admin.findById(decodedToken.id);

        if (!admin) {
            return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
        }

        req.admin = admin; 
        next();
    } catch (error: any) {
        console.error(error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({ success: false, message: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
        }

        res.status(500).json({ success: false, message: error.message });
    }
};


