"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paystackWebhook = exports.verifyPaystackTransaction = exports.paystackInit = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Payment_1 = __importDefault(require("../models/Payment"));
const paystack_1 = require("../config/paystack");
const stockUtils_1 = require("../utils/stockUtils");
const idempotency_1 = require("../utils/idempotency");
const service_1 = require("../utils/payment/service");
const paystackInit = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userEmail = req.user?.email;
        if (!userId || !userEmail) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        const idempotencyKey = req.headers['idempotency-key'];
        if (!(0, idempotency_1.isValidIdempotencyKey)(idempotencyKey)) {
            return res.status(400).json({
                success: false,
                message: 'A valid Idempotency-Key header is required',
            });
        }
        //check for double checkout attempt 
        const existingPayment = await Payment_1.default.findOne({ idempotencyKey });
        if (existingPayment) {
            const order = await Order_1.default.findById(existingPayment.orderId);
            const gateway = existingPayment.gatewayResponse;
            return res.status(200).json({
                success: true,
                message: 'Payment already initialized',
                authorization_url: gateway?.authorization_url,
                reference: existingPayment.reference,
                order,
            });
        }
        const { items, amount, address } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Items are required' });
        }
        if (!amount || !address) {
            return res.status(400).json({ success: false, message: 'Amount and address are required' });
        }
        const stockValidation = await (0, stockUtils_1.validateStockOnly)(items);
        if (!stockValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Stock validation failed',
                errors: stockValidation.stockErrors,
            });
        }
        const paystackResponse = await paystack_1.paystackClient.post('/transaction/initialize', {
            email: userEmail, // the authenticated account's email, not client-supplied
            amount: amount * 100, // Paystack expects kobo
            callback_url: `${process.env.FRONTEND_URL}/order-success`,
        });
        if (!paystackResponse.data.status) {
            return res.status(400).json({ success: false, message: 'Failed to initialize payment' });
        }
        const { reference, authorization_url, access_code } = paystackResponse.data.data;
        const order = await Order_1.default.create({
            userId,
            items,
            amount,
            address,
            status: 'Pending',
            isPaid: false,
        });
        try {
            const payment = await Payment_1.default.create({
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
        }
        catch (paymentError) {
            await Order_1.default.findByIdAndDelete(order._id);
            if (paymentError.code === 11000) {
                const concurrentPayment = await Payment_1.default.findOne({ idempotencyKey });
                if (concurrentPayment) {
                    const concurrentOrder = await Order_1.default.findById(concurrentPayment.orderId);
                    const gateway = concurrentPayment.gatewayResponse;
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
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.paystackInit = paystackInit;
const verifyPaystackTransaction = async (req, res) => {
    try {
        const { reference, orderId } = req.params;
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        if (!reference || !orderId || typeof reference !== 'string' || typeof orderId !== 'string') {
            return res.status(400).json({ success: false, message: 'Reference and orderId are required' });
        }
        const order = await Order_1.default.findById(orderId);
        if (!order || String(order.userId) !== String(userId)) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const payment = await Payment_1.default.findOne({ reference, orderId });
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }
        if (payment.status === 'success') {
            return res.status(200).json({ success: true, message: 'Payment verified', order });
        }
        const verifyResponse = await paystack_1.paystackClient.get(`/transaction/verify/${reference}`);
        if (!verifyResponse.data.status || verifyResponse.data.data.status !== 'success') {
            return res.status(400).json({ success: false, message: 'Payment not successful' });
        }
        if (payment.amount * 100 !== verifyResponse.data.data.amount) {
            console.log(`Amount mismatch for ${reference}: expected ${payment.amount * 100}, got ${verifyResponse.data.data.amount}`);
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
        const result = await (0, service_1.markPaymentSuccess)(reference);
        if (!result.payment || result.payment.status !== 'success') {
            return res.status(400).json({ success: false, message: 'Unable to confirm payment' });
        }
        const updatedOrder = await Order_1.default.findById(orderId);
        return res.status(200).json({ success: true, message: 'Payment verified successfully', order: updatedOrder });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.verifyPaystackTransaction = verifyPaystackTransaction;
const paystackWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-paystack-signature'];
        if (!req.rawBody || !(0, paystack_1.verifyPaystackSignature)(req.rawBody, signature)) {
            return res.status(401).json({ success: false, message: 'Invalid signature' });
        }
        const event = req.body;
        if (event.event === 'charge.success') {
            const { reference, amount } = event.data;
            const payment = await Payment_1.default.findOne({ reference });
            if (!payment) {
                console.log(`Webhook for unknown payment reference: ${reference}`);
                return res.status(200).json({ received: true });
            }
            if (payment.amount * 100 !== amount) {
                console.log(`Amount mismatch for ${reference}: expected ${payment.amount * 100}, got ${amount}`);
                return res.status(200).json({ received: true });
            }
            await (0, service_1.markPaymentSuccess)(reference);
        }
        else if (event.event === 'charge.failed') {
            const { reference } = event.data;
            const payment = await Payment_1.default.findOne({ reference });
            if (payment) {
                await (0, service_1.markPaymentFailed)(reference);
            }
        }
        return res.status(200).json({ received: true });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.paystackWebhook = paystackWebhook;
//# sourceMappingURL=paymentController.js.map