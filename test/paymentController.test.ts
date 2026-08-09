import type { Request, Response } from 'express';
import Order from '../models/Order';
import Payment from '../models/Payment';
import { paystackClient } from '../config/paystack';
import { validateAndPriceItems } from '../utils/stockUtils';
import { paystackInit } from '../controllers/paymentController';

jest.mock('../models/Order');
jest.mock('../models/Payment');
jest.mock('../utils/stockUtils');

jest.mock('../config/paystack', () => ({
    paystackClient: { post: jest.fn(), get: jest.fn() },
    verifyPaystackSignature: jest.fn(),
}));

jest.mock('../utils/payment/service', () => ({
    markPaymentSuccess: jest.fn(),
    markPaymentFailed: jest.fn(),
}));

const buildRes = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const validBody = {
    items: [{ productId: 'prod_1', quantity: 2 }],
    shippingDetails: {
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '08012345678',
        email: 'jane@test.com',
        address: '123 Test Street',
    },
};

describe('paystackInit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if there is no authenticated user', async () => {
        const req = { headers: {}, body: {} } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Not authenticated' });
    });

    it('should return 400 if the Idempotency-Key header is missing or invalid', async () => {
        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: {},
            body: validBody,
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: expect.stringContaining('Idempotency-Key') })
        );
        expect(Payment.findOne).not.toHaveBeenCalled();
    });

    it('should replay the existing result if the idempotency key was already used, without calling Paystack again', async () => {
        const existingPayment = {
            reference: 'ref_123',
            orderId: 'order_1',
            gatewayResponse: { authorization_url: 'https://checkout.paystack.com/abc' },
        };

        (Payment.findOne as jest.Mock).mockResolvedValue(existingPayment);
        (Order.findById as jest.Mock).mockResolvedValue({ _id: 'order_1' });

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: validBody,
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(paystackClient.post).not.toHaveBeenCalled();
        expect(Order.create).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                reference: 'ref_123',
                authorization_url: 'https://checkout.paystack.com/abc',
            })
        );
    });

    it('should return 400 if items are missing', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: { ...validBody, items: [] },
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: 'Items are required' })
        );
    });

    it('should return 400 if shippingDetails is missing entirely', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: { items: validBody.items },
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: 'Shipping details are required' })
        );
    });

    it('should return 400 if a required shippingDetails field is missing', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: {
                ...validBody,
                shippingDetails: { ...validBody.shippingDetails, email: '' },
            },
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'First name, last name, phone, email, and address are all required',
            })
        );
    });

    it('should return 400 if stock validation fails', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);
        (validateAndPriceItems as jest.Mock).mockResolvedValue({
            isValid: false,
            stockErrors: ['Insufficient stock for product: Test Item'],
            pricedItems: [],
            amount: 0,
        });

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: validBody,
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: false, message: 'Stock validation failed' })
        );
        expect(paystackClient.post).not.toHaveBeenCalled();
    });

    it('should create an Order and Payment and return the authorization_url on success', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);
        (validateAndPriceItems as jest.Mock).mockResolvedValue({
            isValid: true,
            stockErrors: [],
            pricedItems: [{ productId: 'prod_1', quantity: 2, price: 100, name: 'Test Item' }],
            amount: 200
        });

        (paystackClient.post as jest.Mock).mockResolvedValue({
            data: {
                status: true,
                data: {
                    reference: 'ref_new_1',
                    authorization_url: 'https://checkout.paystack.com/new',
                    access_code: 'code_1',
                },
            },
        });

        const createdOrder = { _id: 'order_new_1' };
        (Order.create as jest.Mock).mockResolvedValue(createdOrder);
        (Payment.create as jest.Mock).mockResolvedValue({ reference: 'ref_new_1' });

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: validBody,
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(paystackClient.post).toHaveBeenCalledWith(
            '/transaction/initialize',
            expect.objectContaining({ email: 'user@test.com', amount: 20000 })
        );
        expect(Order.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user_1',
                amount: 200,
                isPaid: false,
                items: [{ productId: 'prod_1', quantity: 2, price: 100, name: 'Test Item' }],
                shippingDetails: validBody.shippingDetails,
            })
        );
        expect(Payment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: 'order_new_1',
                reference: 'ref_new_1',
                idempotencyKey: 'a-valid-key-123',
                status: 'pending',
            })
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                authorization_url: 'https://checkout.paystack.com/new',
                reference: 'ref_new_1',
            })
        );
    });

    it('should return the winning payment (and delete its own orphaned order) if a concurrent request wins the idempotency-key race', async () => {
        (Payment.findOne as jest.Mock)
            .mockResolvedValueOnce(null) // initial replay check: no existing payment yet
            .mockResolvedValueOnce({
                reference: 'ref_winner',
                orderId: 'order_winner',
                gatewayResponse: { authorization_url: 'https://checkout.paystack.com/winner' },
            }); // re-check after the duplicate key error

        (validateAndPriceItems as jest.Mock).mockResolvedValue({
            isValid: true,
            stockErrors: [],
            pricedItems: [{ productId: 'prod_1', quantity: 2, price: 100, name: 'Test Item' }],
            amount: 200,
        });

        (paystackClient.post as jest.Mock).mockResolvedValue({
            data: {
                status: true,
                data: { reference: 'ref_new_1', authorization_url: 'https://checkout.paystack.com/new', access_code: 'code_1' },
            },
        });

        const createdOrder = { _id: 'order_new_1' };
        (Order.create as jest.Mock).mockResolvedValue(createdOrder);

        const duplicateKeyError: any = new Error('duplicate key');
        duplicateKeyError.code = 11000;
        (Payment.create as jest.Mock).mockRejectedValue(duplicateKeyError);
        (Order.findByIdAndDelete as jest.Mock).mockResolvedValue(undefined);
        (Order.findById as jest.Mock).mockResolvedValue({ _id: 'order_winner' });

        const req = {
            user: { _id: 'user_1', email: 'user@test.com' },
            headers: { 'idempotency-key': 'a-valid-key-123' },
            body: validBody,
        } as unknown as Request;
        const res = buildRes();

        await paystackInit(req, res);

        expect(Order.findByIdAndDelete).toHaveBeenCalledWith('order_new_1');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true, reference: 'ref_winner' })
        );
    });
});