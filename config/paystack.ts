import axios, { type AxiosInstance } from 'axios';
import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const secretKey = process.env.PAYSTACK_SECRET_KEY;
const publicKey = process.env.PAYSTACK_PUBLIC_KEY;

if (!secretKey || !publicKey) {
    throw new Error('Missing PAYSTACK_SECRET_KEY or PAYSTACK_PUBLIC_KEY in environment variables');
}

export const paystackPublicKey: string = publicKey;

export const paystackClient: AxiosInstance = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    },
});

export interface PaystackRefundResponse {
    status: boolean;
    message: string;
    data?: {
        id: number;
        status: string; // 'pending' | 'processing' | 'processed' | 'failed'
        amount: number;
        transaction_reference?: string;
    };
}

export const initiatePaystackRefund = async (
    transactionReference: string,
    amountInKobo: number
): Promise<PaystackRefundResponse> => {
    const response = await paystackClient.post('/refund', {
        transaction: transactionReference,
        amount: amountInKobo,
    });

    return response.data;
};

// Always run this before trusting a webhook payload.
export const verifyPaystackSignature = (rawBody: string, signature: string | undefined): boolean => {
    if (!signature) return false;

    const expectedHash = crypto.createHmac('sha512', secretKey).update(rawBody).digest('hex');

    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    const signatureBuffer = Buffer.from(signature, 'hex');

    if (expectedBuffer.length !== signatureBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
};