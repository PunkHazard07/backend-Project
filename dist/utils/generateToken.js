"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUserTokens = exports.generateAdminTokens = void 0;
const jwt_1 = require("./jwt");
const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY || '15m');
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY || '7d');
const generateTokenPair = (entity, role) => {
    const accessToken = (0, jwt_1.signAccessToken)({ id: entity._id, role }, ACCESS_TOKEN_EXPIRY);
    const refreshToken = (0, jwt_1.signRefreshToken)({ id: entity._id, role }, REFRESH_TOKEN_EXPIRY);
    return { accessToken, refreshToken };
};
const generateAdminTokens = (admin) => generateTokenPair(admin, 'admin');
exports.generateAdminTokens = generateAdminTokens;
const generateUserTokens = (user) => generateTokenPair(user, 'user');
exports.generateUserTokens = generateUserTokens;
//# sourceMappingURL=generateToken.js.map