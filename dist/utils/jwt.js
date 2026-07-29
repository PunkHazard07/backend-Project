"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.signRefreshToken = exports.signAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const getSecret = (secretEnvVar) => {
    const secret = process.env[secretEnvVar];
    if (!secret) {
        throw new Error(`${secretEnvVar} is missing from the .env file`);
    }
    return secret;
};
const signAccessToken = (payload, expiresIn = '15m') => {
    return jsonwebtoken_1.default.sign(payload, getSecret('JWT_SECRET'), { expiresIn });
};
exports.signAccessToken = signAccessToken;
const signRefreshToken = (payload, expiresIn = '7d') => {
    return jsonwebtoken_1.default.sign(payload, getSecret('JWT_REFRESH_SECRET'), { expiresIn });
};
exports.signRefreshToken = signRefreshToken;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, getSecret('JWT_SECRET'));
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, getSecret('JWT_REFRESH_SECRET'));
};
exports.verifyRefreshToken = verifyRefreshToken;
//# sourceMappingURL=jwt.js.map