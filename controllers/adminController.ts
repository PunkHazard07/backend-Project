import { Request, Response } from 'express'
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin';
import { hashValue, compareValue } from '../utils/hashing';
import { generateAdminTokens } from '../utils/generateToken'; 
import TokenBlocklist from '../models/TokenBlocklist';
import { verifyRefreshToken, verifyAccessToken } from '../utils/jwt';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/cookies';

//route for admin registration
export const registerAdmin = async (req: Request, res: Response) => {
    try {
        const { email, password, adminSecret } = req.body;

        if (adminSecret !== process.env.ADMIN_REGISTRATION_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'Invalid registration secret key',
            });
        }

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required',
            });
        }

        //check if the admin already exists
        const exists = await Admin.findOne({email}); 
        if (exists) {
            return res.status(400).json({ success:false, message: "Admin already exists" });
        }
        
        const hashedPassword = await hashValue(password);

        //create a new admin
        const newAdmin = await Admin.create({
            email,
            password: hashedPassword,
        });

        //send success response with token
        res.status(201).json({ success: true, message: "Admin registered successfully", adminId: newAdmin._id });

    } catch (error: any) {
    console.error('Registration Error:', error);
    return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error',
    });
    }
};

//route for admin login
export const adminLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required',
        });
    }
        // Find admin in database
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ success: false, message: "Invalid credential" });
        }

        // Compare hashed password
        const isMatch = await compareValue(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        // Generate tokens (access & refresh)
        const { accessToken, refreshToken } = generateAdminTokens(admin);

        //save the token in the database
        admin.refreshToken = await hashValue(refreshToken);
        await admin.save();

        setRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            success: true,
            message: "Admin logged in successfully",
            accessToken
        });

    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

//endpoint for admin logout
export const logoutadmin = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const accessToken = authHeader.split(' ')[1];
            const decoded = jwt.decode(accessToken);
            if (decoded && typeof decoded !== 'string' && decoded.exp) {
                await TokenBlocklist.create({
                    token: accessToken,
                    expiresAt: new Date(decoded.exp * 1000),
                });
            }
        }

        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
            try {
                const decodedRefresh = verifyRefreshToken(refreshToken);
                if (typeof decodedRefresh !== 'string' && decodedRefresh.id) {
                    await Admin.findByIdAndUpdate(decodedRefresh.id, { refreshToken: null });
                }
            } catch {
                // Refresh token invalid/expired — nothing to revoke,
                // still fall through to clear the cookie below.
            }
        }

        clearRefreshTokenCookie(res);

        res.status(200).json({ success:true, message: "Admin logged out successfully" });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }
};

export const verifyToken = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ valid: false, message: "Access denied. No token provided." });
        }
        
        const token = authHeader.split(" ")[1];

        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (error) {
            return res.status(403).json({ valid: false, message: "Invalid or expired token" });
        }

        if (typeof decoded === 'string' || !decoded.id || decoded.role !== 'admin') {
            return res.status(403).json({ valid: false, message: "Invalid token" });
        }

        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(403).json({ valid: false, message: "Forbidden: Admin access required" });
        }

        return res.json({ valid: true, user: { id: admin._id, email: admin.email } });
    } catch (error: any) {
        console.error("Verify token error:", error);
        res.status(500).json({ valid: false, message: "Internal server error" });
    }
};
