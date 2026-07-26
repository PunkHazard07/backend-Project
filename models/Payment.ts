import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPayment extends Document {
    orderId: Types.ObjectId;
    provider: 'paystack';
    reference: string;
    idempotencyKey: string;
    amount: number;
    currency: string;
    status: 'pending' | 'success' | 'failed';
    confirmationEmailSentAt: Date | null;
    failureEmailSentAt: Date | null;
    gatewayResponse?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>({
    orderId: {
        type: Schema.Types.ObjectId,
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
        enum: ['pending', 'success', 'failed'],
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
    gatewayResponse: {
        type: Schema.Types.Mixed, // raw Paystack payload, for debugging/audits
    },
}, { timestamps: true });

paymentSchema.index({ orderId: 1 });

export default mongoose.model<IPayment>('Payment', paymentSchema);