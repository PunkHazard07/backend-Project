"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaystackSignature = exports.paystackClient = exports.paystackPublicKey = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const secretKey = process.env.PAYSTACK_SECRET_KEY;
const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
if (!secretKey || !publicKey) {
    throw new Error('Missing PAYSTACK_SECRET_KEY or PAYSTACK_PUBLIC_KEY in environment variables');
}
exports.paystackPublicKey = publicKey;
exports.paystackClient = axios_1.default.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    },
});
// Always run this before trusting a webhook payload.
const verifyPaystackSignature = (rawBody, signature) => {
    if (!signature)
        return false;
    const expectedHash = crypto_1.default.createHmac('sha512', secretKey).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== signatureBuffer.length)
        return false;
    return crypto_1.default.timingSafeEqual(expectedBuffer, signatureBuffer);
};
exports.verifyPaystackSignature = verifyPaystackSignature;
//# sourceMappingURL=paystack.js.map