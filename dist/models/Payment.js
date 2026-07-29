"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const paymentSchema = new mongoose_1.Schema({
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    provider: {
        type: String,
        enum: ['paystack'],
        required: true,
    },
    reference: {
        type: String,
        required: true,
        unique: true, // Paystack's transaction reference
    },
    idempotencyKey: {
        type: String,
        required: true,
        unique: true, // client-generated, dedupes duplicate /init calls
    },
    amount: {
        type: Number,
        required: true,
        min: 1,
    },
    currency: {
        type: String,
        default: 'NGN',
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending',
    },
    confirmationEmailSentAt: {
        type: Date,
        default: null, // set atomically once the confirmation mail is sent
    },
    failureEmailSentAt: {
        type: Date,
        default: null,
    },
    refundedAt: {
        type: Date,
        default: null,
    },
    refundEmailSentAt: {
        type: Date,
        default: null,
    },
    gatewayResponse: {
        type: mongoose_1.Schema.Types.Mixed, // raw Paystack payload, for debugging/audits
    },
}, { timestamps: true });
paymentSchema.index({ orderId: 1 });
exports.default = mongoose_1.default.model('Payment', paymentSchema);
//# sourceMappingURL=Payment.js.map