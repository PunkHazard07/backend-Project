"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareValue = exports.hashValue = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 10;
const hashValue = async (plainValue) => {
    const salt = await bcrypt_1.default.genSalt(SALT_ROUNDS);
    return bcrypt_1.default.hash(plainValue, salt);
};
exports.hashValue = hashValue;
const compareValue = async (plainValue, hashedValue) => {
    return bcrypt_1.default.compare(plainValue, hashedValue);
};
exports.compareValue = compareValue;
//# sourceMappingURL=hashing.js.map