"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidIdempotencyKey = exports.generateIdempotencyKey = void 0;
const crypto_1 = __importDefault(require("crypto"));
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-_]{8,128}$/;
const generateIdempotencyKey = () => crypto_1.default.randomUUID();
exports.generateIdempotencyKey = generateIdempotencyKey;
const isValidIdempotencyKey = (key) => {
    return typeof key === 'string' && IDEMPOTENCY_KEY_PATTERN.test(key);
};
exports.isValidIdempotencyKey = isValidIdempotencyKey;
//# sourceMappingURL=idempotency.js.map