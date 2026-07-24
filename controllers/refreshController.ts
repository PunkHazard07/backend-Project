import type { Request, Response } from 'express';
import User from '../models/User';
import Admin from '../models/Admin';
import { verifyRefreshToken } from '../utils/jwt';
import { generateUserTokens, generateAdminTokens } from '../utils/generateToken';
import { hashValue, compareValue } from '../utils/hashing';
import { setRefreshTokenCookie, clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE_NAME } from '../utils/cookies';

//shared refresh endpoint for both user and admin
export const refreshToken = async (req: Request, res: Response) => {
    try {
    const incomingToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (!incomingToken) {
        return res.status(401).json({ success: false, message: "Refresh token required" });
    }
    //verify signature + expiry first
    let decoded 
    try {
        decoded = verifyRefreshToken(incomingToken);
    } catch (error) {
        clearRefreshTokenCookie(res);
            return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
    }
        if (
            typeof decoded === 'string' ||
            !decoded.id ||
            (decoded.role !== 'user' && decoded.role !== 'admin')
        ) {
            clearRefreshTokenCookie(res);
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }
        
        const { id, role } = decoded as { id: string; role: 'user' | 'admin' };
        const entity = role === 'admin' ? await Admin.findById(id) : await User.findById(id);

        const matchesStored =
            entity?.refreshToken && (await compareValue(incomingToken, entity.refreshToken));

        if (!entity || !matchesStored) {
            if (entity) {
                entity.refreshToken = null;
                await entity.save();
            }
            clearRefreshTokenCookie(res);
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }

    // Rotate: issue a new pair, hash + store the new refresh token, reset the cookie
    const generate = role === 'admin' ? generateAdminTokens : generateUserTokens;
    const { accessToken, refreshToken: newRefreshToken } = generate(entity);

    entity.refreshToken = await hashValue(newRefreshToken);
    await entity.save();

    setRefreshTokenCookie(res, newRefreshToken);

    res.status(200).json({ success: true, accessToken });
    } catch (error) {
        console.error("Refresh token error:", error);
        const message = error instanceof Error ? error.message : "Server error during token refresh";
        res.status(500).json({ success: false, message });
    }
};
