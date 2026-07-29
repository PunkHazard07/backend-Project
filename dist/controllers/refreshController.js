"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = void 0;
const User_1 = __importDefault(require("../models/User"));
const Admin_1 = __importDefault(require("../models/Admin"));
const jwt_1 = require("../utils/jwt");
const generateToken_1 = require("../utils/generateToken");
const hashing_1 = require("../utils/hashing");
const cookies_1 = require("../utils/cookies");
//shared refresh endpoint for both user and admin
const refreshToken = async (req, res) => {
    try {
        const incomingToken = req.cookies?.[cookies_1.REFRESH_TOKEN_COOKIE_NAME];
        if (!incomingToken) {
            return res.status(401).json({ success: false, message: "Refresh token required" });
        }
        //verify signature + expiry first
        let decoded;
        try {
            decoded = (0, jwt_1.verifyRefreshToken)(incomingToken);
        }
        catch (error) {
            (0, cookies_1.clearRefreshTokenCookie)(res);
            return res.status(403).json({ success: false, message: "Invalid or expired refresh token" });
        }
        if (typeof decoded === 'string' ||
            !decoded.id ||
            (decoded.role !== 'user' && decoded.role !== 'admin')) {
            (0, cookies_1.clearRefreshTokenCookie)(res);
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }
        const { id, role } = decoded;
        const entity = role === 'admin' ? await Admin_1.default.findById(id) : await User_1.default.findById(id);
        const matchesStored = entity?.refreshToken && (await (0, hashing_1.compareValue)(incomingToken, entity.refreshToken));
        if (!entity || !matchesStored) {
            if (entity) {
                entity.refreshToken = null;
                await entity.save();
            }
            (0, cookies_1.clearRefreshTokenCookie)(res);
            return res.status(403).json({ success: false, message: "Invalid refresh token" });
        }
        // Rotate: issue a new pair, hash + store the new refresh token, reset the cookie
        const generate = role === 'admin' ? generateToken_1.generateAdminTokens : generateToken_1.generateUserTokens;
        const { accessToken, refreshToken: newRefreshToken } = generate(entity);
        entity.refreshToken = await (0, hashing_1.hashValue)(newRefreshToken);
        await entity.save();
        (0, cookies_1.setRefreshTokenCookie)(res, newRefreshToken);
        res.status(200).json({ success: true, accessToken });
    }
    catch (error) {
        console.error("Refresh token error:", error);
        const message = error instanceof Error ? error.message : "Server error during token refresh";
        res.status(500).json({ success: false, message });
    }
};
exports.refreshToken = refreshToken;
//# sourceMappingURL=refreshController.js.map