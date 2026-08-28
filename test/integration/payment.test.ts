jest.mock('../../config/paystack', () => {
    const actual = jest.requireActual('../../config/paystack');
    return {
        ...actual,
        paystackClient: {
            post: jest.fn(),
            get: jest.fn(),
        },
        initiatePaystackRefund: jest.fn(),
    };
});

// Mock email sending so no real mail goes out and no Redis queue is needed.
// NOTIFICATION_PURPOSE is pulled from the side-effect-free constant file directly
// (not the notification/index barrel) so this mock never touches config/redis.ts.
jest.mock('../../utils/notification', () => {
    const { NOTIFICATION_PURPOSE } = jest.requireActual('../../utils/notification/constant');
    return {
        __esModule: true,
        NOTIFICATION_PURPOSE,
        sendNotification: jest.fn().mockResolvedValue(undefined),
    };
});

import request from 'supertest';
import crypto from 'crypto';
import app from '../../app';
import User from '../../models/User';
import Product from '../../models/Product';
import Order from '../../models/Order';
import Payment from '../../models/Payment';
import { paystackClient } from '../../config/paystack';
import { sendNotification, NOTIFICATION_PURPOSE } from '../../utils/notification';
import { signAccessToken } from '../../utils/jwt';
import { connectTestDB, clearTestDB, closeTestDB, closeQueueConnections } from '../setup';

const postMock = (paystackClient as any).post as jest.Mock;
const getMock = (paystackClient as any).get as jest.Mock;
const sendNotificationMock = sendNotification as jest.Mock;

const validShipping = {
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '08000000000',
    email: 'buyer1@test.com',
    address: '1 Test Street',
};

const seedVerifiedUser = async () => {
    const user = await User.create({
        username: `buyer_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: 'buyer1@test.com',
        password: 'hashed-not-checked',
        verified: true,
    });
    const token = signAccessToken({ id: user._id.toString(), role: 'user' });
    return { user, token };
};

const seedUnverifiedUser = async () => {
    const user = await User.create({
        username: `unverified_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: 'buyer2@test.com',
        password: 'hashed-not-checked',
        verified: false,
    });
    const token = signAccessToken({ id: user._id.toString(), role: 'user' });
    return { user, token };
};

const seedProduct = async (overrides: Partial<{ price: number; quantity: number }> = {}) =>
    Product.create({
        name: 'Chair',
        description: 'A chair',
        images: [],
        price: 100,
        category: 'Dining Room',
        quantity: 10,
        isOutOfStock: false,
        ...overrides,
    });

const cookieFor = (token: string) => [`accessToken=${token}`];

const signWebhookBody = (body: unknown): string => {
    const secret = process.env.PAYSTACK_SECRET_KEY as string;
    const raw = JSON.stringify(body);
    return crypto.createHmac('sha512', secret).update(raw).digest('hex');
};

describe('Payment controller (integration)', () => {
    beforeAll(async () => {
        await connectTestDB();
    });

    afterEach(async () => {
        await clearTestDB();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await closeTestDB();
        await closeQueueConnections();
    });

    // ------------------------------------------------------------------
    // POST /api/paystack/init
    // ------------------------------------------------------------------
    describe('POST /api/paystack/init', () => {
        it('initializes payment, creates an order + payment, returns the authorization url', async () => {
            const { token } = await seedVerifiedUser();
            const product = await seedProduct({ price: 100, quantity: 10 });

            postMock.mockResolvedValueOnce({
                data: {
                    status: true,
                    data: {
                        reference: 'ref_123',
                        authorization_url: 'https://paystack.com/pay/ref_123',
                        access_code: 'code_123',
                    },
                },
            });

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', crypto.randomUUID())
                .send({
                    items: [{ productId: product._id.toString(), quantity: 2 }],
                    shippingDetails: validShipping,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.authorization_url).toBe('https://paystack.com/pay/ref_123');
            expect(res.body.reference).toBe('ref_123');
            expect(res.body.order.amount).toBe(200);
            expect(res.body.order.status).toBe('Pending');

            const payment = await Payment.findOne({ reference: 'ref_123' });
            expect(payment).not.toBeNull();
            expect(payment!.status).toBe('pending');

            expect(postMock).toHaveBeenCalledTimes(1);
            const [, body] = postMock.mock.calls[0];
            expect(body.amount).toBe(20000); // amount in kobo
        });

        it('rejects a missing Idempotency-Key header', async () => {
            const { token } = await seedVerifiedUser();
            const product = await seedProduct();

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .send({
                    items: [{ productId: product._id.toString(), quantity: 1 }],
                    shippingDetails: validShipping,
                });

            expect(res.status).toBe(400);
            expect(postMock).not.toHaveBeenCalled();
        });

        it('rejects a request with no items', async () => {
            const { token } = await seedVerifiedUser();

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', crypto.randomUUID())
                .send({ items: [], shippingDetails: validShipping });

            expect(res.status).toBe(400);
        });

        it('rejects incomplete shipping details', async () => {
            const { token } = await seedVerifiedUser();
            const product = await seedProduct();
            const { address, ...incompleteShipping } = validShipping;

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', crypto.randomUUID())
                .send({
                    items: [{ productId: product._id.toString(), quantity: 1 }],
                    shippingDetails: incompleteShipping,
                });

            expect(res.status).toBe(400);
        });

        it('rejects when requested quantity exceeds stock', async () => {
            const { token } = await seedVerifiedUser();
            const product = await seedProduct({ quantity: 1 });

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', crypto.randomUUID())
                .send({
                    items: [{ productId: product._id.toString(), quantity: 5 }],
                    shippingDetails: validShipping,
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/stock validation failed/i);
            expect(postMock).not.toHaveBeenCalled();
        });

        it('returns the existing payment for a reused Idempotency-Key without calling Paystack again', async () => {
            const { user, token } = await seedVerifiedUser();
            const product = await seedProduct();
            const idempotencyKey = crypto.randomUUID();

            const order = await Order.create({
                userId: user._id,
                items: [{ productId: product._id, quantity: 1, price: 100, name: 'Chair' }],
                amount: 100,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });
            await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference: 'ref_existing',
                idempotencyKey,
                amount: 100,
                status: 'pending',
                gatewayResponse: { authorization_url: 'https://paystack.com/pay/ref_existing' },
            });

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', idempotencyKey)
                .send({
                    items: [{ productId: product._id.toString(), quantity: 1 }],
                    shippingDetails: validShipping,
                });

            expect(res.status).toBe(200);
            expect(res.body.reference).toBe('ref_existing');
            expect(postMock).not.toHaveBeenCalled();
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app)
                .post('/api/paystack/init')
                .set('Idempotency-Key', crypto.randomUUID())
                .send({ items: [], shippingDetails: validShipping });

            expect(res.status).toBe(401);
        });

        it('rejects an unverified user', async () => {
            const { token } = await seedUnverifiedUser();
            const product = await seedProduct();

            const res = await request(app)
                .post('/api/paystack/init')
                .set('Cookie', cookieFor(token))
                .set('Idempotency-Key', crypto.randomUUID())
                .send({
                    items: [{ productId: product._id.toString(), quantity: 1 }],
                    shippingDetails: validShipping,
                });

            expect(res.status).toBe(403);
            expect(postMock).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // GET /api/paystack/verify/:reference/:orderId
    // ------------------------------------------------------------------
    describe('GET /api/paystack/verify/:reference/:orderId', () => {
        const seedPendingOrderAndPayment = async (userId: any, productId: any, amount = 200) => {
            const order = await Order.create({
                userId,
                items: [{ productId, quantity: 2, price: 100, name: 'Chair' }],
                amount,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });
            const payment = await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference: 'ref_verify_1',
                idempotencyKey: crypto.randomUUID(),
                amount,
                status: 'pending',
            });
            return { order, payment };
        };

        it('verifies a successful payment, marks the order paid, and sends a success email', async () => {
            const { user, token } = await seedVerifiedUser();
            const product = await seedProduct({ quantity: 10 });
            const { order, payment } = await seedPendingOrderAndPayment(user._id, product._id, 200);

            getMock.mockResolvedValueOnce({
                data: { status: true, data: { status: 'success', amount: payment.amount * 100 } },
            });

            const res = await request(app)
                .get(`/api/paystack/verify/${payment.reference}/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.order.isPaid).toBe(true);

            const updatedPayment = await Payment.findOne({ reference: payment.reference });
            expect(updatedPayment!.status).toBe('success');

            expect(sendNotificationMock).toHaveBeenCalledWith(
                expect.objectContaining({ purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS })
            );
        });

        it('short-circuits without calling Paystack again if already verified', async () => {
            const { user, token } = await seedVerifiedUser();
            const product = await seedProduct();
            const { order, payment } = await seedPendingOrderAndPayment(user._id, product._id, 200);
            payment.status = 'success';
            await payment.save();

            const res = await request(app)
                .get(`/api/paystack/verify/${payment.reference}/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(200);
            expect(getMock).not.toHaveBeenCalled();
        });

        it('returns 400 when Paystack reports the transaction as not successful', async () => {
            const { user, token } = await seedVerifiedUser();
            const product = await seedProduct();
            const { order, payment } = await seedPendingOrderAndPayment(user._id, product._id, 200);

            getMock.mockResolvedValueOnce({
                data: { status: true, data: { status: 'abandoned', amount: payment.amount * 100 } },
            });

            const res = await request(app)
                .get(`/api/paystack/verify/${payment.reference}/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(400);
            expect((await Payment.findOne({ reference: payment.reference }))!.status).toBe('pending');
        });

        it('returns 400 on an amount mismatch and does not mark the payment successful', async () => {
            const { user, token } = await seedVerifiedUser();
            const product = await seedProduct();
            const { order, payment } = await seedPendingOrderAndPayment(user._id, product._id, 200);

            getMock.mockResolvedValueOnce({
                data: { status: true, data: { status: 'success', amount: 999900 } }, // wrong amount
            });

            const res = await request(app)
                .get(`/api/paystack/verify/${payment.reference}/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(400);
            expect((await Payment.findOne({ reference: payment.reference }))!.status).toBe('pending');
        });

        it('returns 404 for an order that does not belong to the requesting user', async () => {
            const { token } = await seedVerifiedUser();
            const otherUser = await User.create({
                username: `other_${Date.now()}`,
                email: 'other@test.com',
                password: 'x',
                verified: true,
            });
            const product = await seedProduct();
            const { order, payment } = await seedPendingOrderAndPayment(otherUser._id, product._id, 200);

            const res = await request(app)
                .get(`/api/paystack/verify/${payment.reference}/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(404);
        });

        it('returns 404 when no payment matches the reference/orderId pair', async () => {
            const { user, token } = await seedVerifiedUser();
            const order = await Order.create({
                userId: user._id,
                items: [],
                amount: 200,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });

            const res = await request(app)
                .get(`/api/paystack/verify/no-such-ref/${order._id}`)
                .set('Cookie', cookieFor(token));

            expect(res.status).toBe(404);
        });

        it('rejects an unauthenticated request', async () => {
            const res = await request(app).get('/api/paystack/verify/ref_1/507f1f77bcf86cd799439011');
            expect(res.status).toBe(401);
        });
    });

    // ------------------------------------------------------------------
    // POST /api/paystack/webhook
    // ------------------------------------------------------------------
    describe('POST /api/paystack/webhook', () => {
        it('rejects a request with an invalid signature', async () => {
            const body = { event: 'charge.success', data: { reference: 'ref_1', amount: 10000 } };

            const res = await request(app)
                .post('/api/paystack/webhook')
                .set('x-paystack-signature', 'not-a-real-signature')
                .send(body);

            expect(res.status).toBe(401);
        });

        it('marks the payment successful on a valid charge.success event and emails the buyer', async () => {
            const { user } = await seedVerifiedUser();
            const product = await seedProduct({ quantity: 10 });
            const order = await Order.create({
                userId: user._id,
                items: [{ productId: product._id, quantity: 1, price: 150, name: 'Chair' }],
                amount: 150,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });
            const payment = await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference: 'ref_webhook_1',
                idempotencyKey: crypto.randomUUID(),
                amount: 150,
                status: 'pending',
            });

            const body = { event: 'charge.success', data: { reference: payment.reference, amount: 15000 } };
            const signature = signWebhookBody(body);

            const res = await request(app)
                .post('/api/paystack/webhook')
                .set('x-paystack-signature', signature)
                .send(body);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ received: true });

            expect((await Payment.findOne({ reference: payment.reference }))!.status).toBe('success');
            expect((await Order.findById(order._id))!.isPaid).toBe(true);
            expect(sendNotificationMock).toHaveBeenCalledWith(
                expect.objectContaining({ purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS })
            );
        });

        it('acknowledges (200) an unknown reference without erroring', async () => {
            const body = { event: 'charge.success', data: { reference: 'no-such-reference', amount: 10000 } };
            const signature = signWebhookBody(body);

            const res = await request(app)
                .post('/api/paystack/webhook')
                .set('x-paystack-signature', signature)
                .send(body);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ received: true });
        });

        it('does not mark the payment successful on an amount mismatch', async () => {
            const { user } = await seedVerifiedUser();
            const product = await seedProduct();
            const order = await Order.create({
                userId: user._id,
                items: [{ productId: product._id, quantity: 1, price: 150, name: 'Chair' }],
                amount: 150,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });
            const payment = await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference: 'ref_webhook_2',
                idempotencyKey: crypto.randomUUID(),
                amount: 150,
                status: 'pending',
            });

            const body = { event: 'charge.success', data: { reference: payment.reference, amount: 99900 } };
            const signature = signWebhookBody(body);

            const res = await request(app)
                .post('/api/paystack/webhook')
                .set('x-paystack-signature', signature)
                .send(body);

            expect(res.status).toBe(200);
            expect((await Payment.findOne({ reference: payment.reference }))!.status).toBe('pending');
        });

        it('marks the payment failed on a charge.failed event and emails the buyer', async () => {
            const { user } = await seedVerifiedUser();
            const product = await seedProduct();
            const order = await Order.create({
                userId: user._id,
                items: [{ productId: product._id, quantity: 1, price: 150, name: 'Chair' }],
                amount: 150,
                shippingDetails: validShipping,
                status: 'Pending',
                isPaid: false,
            });
            const payment = await Payment.create({
                orderId: order._id,
                provider: 'paystack',
                reference: 'ref_webhook_3',
                idempotencyKey: crypto.randomUUID(),
                amount: 150,
                status: 'pending',
            });

            const body = { event: 'charge.failed', data: { reference: payment.reference, amount: 15000 } };
            const signature = signWebhookBody(body);

            const res = await request(app)
                .post('/api/paystack/webhook')
                .set('x-paystack-signature', signature)
                .send(body);

            expect(res.status).toBe(200);
            expect((await Payment.findOne({ reference: payment.reference }))!.status).toBe('failed');
            expect(sendNotificationMock).toHaveBeenCalledWith(
                expect.objectContaining({ purpose: NOTIFICATION_PURPOSE.PAYMENT_FAILED })
            );
        });
    });
});