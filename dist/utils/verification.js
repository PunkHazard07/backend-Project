"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateResetToken = exports.generateVerificationToken = void 0;
const crypto_1 = __importDefault(require("crypto"));
const generateOTP = () => crypto_1.default.randomInt(0, 1000000).toString().padStart(6, '0');
const generateVerificationToken = () => generateOTP();
exports.generateVerificationToken = generateVerificationToken;
const generateResetToken = () => generateOTP();
exports.generateResetToken = generateResetToken;
//# sourceMappingURL=verification.js.map