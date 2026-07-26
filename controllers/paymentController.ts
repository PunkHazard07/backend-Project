import type { Request, Response } from 'express';
import Order from '../models/Order';
import Payment from '../models/Payment';
import { paystackClient, verifyPaystackSignature } from '../config/paystack';
import { validateStockOnly } from '../utils/stockUtils';
import { isValidIdempotencyKey } from '../utils/idempotency';
import { markPaymentSuccess, markPaymentFailed } from '../utils/payment/service';

interface PaystackInitBody {
    items: { productId: string; quantity: number; price: number; name: string }[];
    amount: number;
    address: string;
}

interface PaystackGatewayResponse {
    authorization_url?: string;
    access_code?: string;
}

export const paystackInit = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        const userEmail = req.user?.email;

        if (!userId || !userEmail) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const idempotencyKey = req.headers['idempotency-key'];
        
        if (!isValidIdempotencyKey(idempotencyKey)) {
            return res.status(400).json({
                success: false,
                message: 'A valid Idempotency-Key header is required',
            });
        } 
        
        //check for double checkout attempt 
        const existingPayment = await Payment.findOne({ idempotencyKey });
        if (existingPayment) {
            const order = await Order.findById(existingPayment.orderId);
            const gateway = existingPayment.gatewayResponse as PaystackGatewayResponse | undefined;
            return res.status(200).json({
                success: true,
                message: 'Payment already initialized',
                authorization_url: gateway?.authorization_url,
                reference: existingPayment.reference,
                order,
            });
        }  

        const { items, amount, address } = req.body as PaystackInitBody;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }

        if (!amount || !address) {
            return res.status(400).json({ success: false, message: 'Amount and address are required' });
        }
    
        const stockValidation = await validateStockOnly(items);
        if (!stockValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Stock validation failed',
                errors: stockValidation.stockErrors,
            });
        }

        const paystackResponse = await paystackClient.post('/transaction/initialize', {
            email: userEmail, // the authenticated account's email, not client-supplied
            amount: amount * 100, // Paystack expects kobo
            callback_url: `${process.env.FRONTEND_URL}/order-success`,
        });

        if (!paystackResponse.data.status) {
            return res.status(400).json({ success: false, message: 'Failed to initialize payment' });
        }

        const { reference, authorization_url, access_code } = paystackResponse.data.data;

        const order = await Order.create({
            userId,
            items,
            amount,
            address,
            status: 'Pending',
            isPaid: false,
        });

        try {
            const payment = await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference,
                idempotencyKey,
                amount,
                status: 'pending',
                gatewayResponse: { authorization_url, access_code },
            });

            return res.status(201).json({
                success: true,
                message: 'Payment initialized successfully',
                authorization_url,
                reference: payment.reference,
                order,
            });
        } catch (paymentError: any) {
            await Order.findByIdAndDelete(order._id);

            if (paymentError.code === 11000) {
                const concurrentPayment = await Payment.findOne({ idempotencyKey });
                if (concurrentPayment) {
                    const concurrentOrder = await Order.findById(concurrentPayment.orderId);
                    const gateway = concurrentPayment.gatewayResponse as PaystackGatewayResponse | undefined;
                    return res.status(200).json({
                        success: true,
                        message: 'Payment already initialized',
                        authorization_url: gateway?.authorization_url,
                        reference: concurrentPayment.reference,
                        order: concurrentOrder,
                    });
                }
            }

            throw paymentError;
        }

    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyPaystackTransaction = async (req: Request, res: Response) => {
    try {
        const { reference, orderId } = req.params;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        if (!reference || !orderId || typeof reference !== 'string' || typeof orderId !== 'string') {
            return res.status(400).json({ success: false, message: 'Reference and orderId are required' });
        }

        const order = await Order.findById(orderId);
        if (!order || String(order.userId) !== String(userId)) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const payment = await Payment.findOne({ reference, orderId });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.status === 'success') {
            return res.status(200).json({ success: true, message: 'Payment verified', order });
        }

        const verifyResponse = await paystackClient.get(`/transaction/verify/${reference}`);

        if (!verifyResponse.data.status || verifyResponse.data.data.status !== 'success') {
            return res.status(400).json({ success: false, message: 'Payment not successful' });
        }

        if (payment.amount * 100 !== verifyResponse.data.data.amount) {
            console.log(`Amount mismatch for ${reference}: expected ${payment.amount * 100}, got ${verifyResponse.data.data.amount}`);
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const result = await markPaymentSuccess(reference);

        if (!result.payment || result.payment.status !== 'success') {
            return res.status(400).json({ success: false, message: 'Unable to confirm payment' });
        }

        const updatedOrder = await Order.findById(orderId);
        return res.status(200).json({ success: true, message: 'Payment verified successfully', order: updatedOrder });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const paystackWebhook = async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-paystack-signature'] as string | undefined;

        if (!req.rawBody || !verifyPaystackSignature(req.rawBody, signature)) {
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }

        const event = req.body;

        if (event.event !== 'charge.success') {
            return res.status(200).json({ received: true });
        }

        const { reference, amount } = event.data;

        const payment = await import('../models/Payment').then((m) => m.default.findOne({ reference }));
        if (!payment) {
            console.log(`Webhook for unknown payment reference: ${reference}`);
            return res.status(200).json({ received: true });
        }

        if (payment.amount * 100 !== amount) {
            console.log(`Amount mismatch for ${reference}: expected ${payment.amount * 100}, got ${amount}`);
            return res.status(200).json({ received: true });
        }

        await markPaymentSuccess(reference);

        if (event.event === 'charge.success') {
            // ...existing amount check + markPaymentSuccess call...
        } else if (event.event === 'charge.failed') {
            const { reference } = event.data;
            const payment = await Payment.findOne({ reference });
            if (payment) {
                await markPaymentFailed(reference);
            }
        }

        return res.status(200).json({ received: true });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};