import Order from '../models/Order';
import User from '../models/User';
import Payment from '../models/Payment';
import { validateAndUpdateStock } from '../utils/stockUtils';
import { sendNotification, NOTIFICATION_PURPOSE } from '../utils/notification';
import { initiatePaystackRefund } from '../config/paystack';
import { markPaymentSuccess, markPaymentFailed } from '../utils/payment/service';

jest.mock('../models/Order');
jest.mock('../models/User');
jest.mock('../models/Payment');
jest.mock('../utils/stockUtils');
jest.mock('../config/paystack', () => ({
    initiatePaystackRefund: jest.fn(),
}))

jest.mock('../utils/notification', () => ({
    sendNotification: jest.fn().mockResolvedValue(undefined),
    NOTIFICATION_PURPOSE: {
        PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
        PAYMENT_FAILED: 'PAYMENT_FAILED',
        REFUND_INITIATED: 'REFUND_INITIATED',
    },
}));

const buildOrder = (overrides = {}) => ({
    _id: 'order_1',
    userId: 'user_1',
    isPaid: false,
    items: [{ productId: 'prod_1', quantity: 2 }],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
});

const buildPayment = (overrides = {}) => ({
    reference: 'ref_1',
    orderId: 'order_1',
    amount: 200,
    status: 'pending',
    confirmationEmailSentAt: null,
    failureEmailSentAt: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
});

describe('markPaymentSuccess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return alreadyProcessed:false with a null payment if no payment exists for the reference', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(null);

        const result = await markPaymentSuccess('missing_ref');

        expect(result).toEqual({ alreadyProcessed: false, payment: null });
        expect(Order.findById).not.toHaveBeenCalled();
    });

    it('should return alreadyProcessed:false with a null payment if the order no longer exists', async () => {
        (Payment.findOne as jest.Mock).mockResolvedValue(buildPayment());
        (Order.findById as jest.Mock).mockResolvedValue(null);

        const result = await markPaymentSuccess('ref_1');

        expect(result).toEqual({ alreadyProcessed: false, payment: null });
        expect(Payment.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should report alreadyProcessed:true without touching stock if the atomic claim finds it already processed', async () => {
        const order = buildOrder();
        (Payment.findOne as jest.Mock)
            .mockResolvedValueOnce(buildPayment()) // initial lookup to find the order
            .mockResolvedValueOnce(buildPayment({ status: 'success' })); // re-fetch after losing the claim
        (Order.findById as jest.Mock).mockResolvedValue(order);
        (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(null); // someone else already claimed it

        const result = await markPaymentSuccess('ref_1');

        expect(result.alreadyProcessed).toBe(true);
        expect(result.payment?.status).toBe('success');
        expect(validateAndUpdateStock).not.toHaveBeenCalled();
        expect(order.save).not.toHaveBeenCalled();
    });

    it('should deduct stock, mark the order paid, clear the cart, and send the success email exactly once', async () => {
        const order = buildOrder();
        const claimedPayment = buildPayment({ status: 'success' });

        (Payment.findOne as jest.Mock).mockResolvedValue(buildPayment());
        (Order.findById as jest.Mock).mockResolvedValue(order);
        (Payment.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(claimedPayment) // the status claim (pending -> success)
            .mockResolvedValueOnce({ ...claimedPayment, confirmationEmailSentAt: new Date() }); // the email claim
        (validateAndUpdateStock as jest.Mock).mockResolvedValue({ isValid: true });
        (User.findById as jest.Mock).mockResolvedValue({ email: 'user@test.com', username: 'testuser' });

        const result = await markPaymentSuccess('ref_1');

        expect(validateAndUpdateStock).toHaveBeenCalledWith([{ productId: 'prod_1', quantity: 2 }]);
        expect(order.isPaid).toBe(true);
        expect(order.save).toHaveBeenCalledTimes(1);
        expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user_1', { cartData: [] });
        expect(sendNotification).toHaveBeenCalledWith({
            purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS,
            data: { email: 'user@test.com', fullName: 'testuser', reference: 'ref_1', amount: 200 },
        });
        expect(result.alreadyProcessed).toBe(false);
        expect(result.payment?.status).toBe('success');
    });

    it('should not send the success email a second time if it was already sent', async () => {
        const order = buildOrder();
        const claimedPayment = buildPayment({ status: 'success' });

        (Payment.findOne as jest.Mock).mockResolvedValue(buildPayment());
        (Order.findById as jest.Mock).mockResolvedValue(order);
        (Payment.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(claimedPayment) // status claim succeeds
            .mockResolvedValueOnce(null); // email claim loses - already sent
        (validateAndUpdateStock as jest.Mock).mockResolvedValue({ isValid: true });

        await markPaymentSuccess('ref_1');

        expect(sendNotification).not.toHaveBeenCalled();
        expect(User.findById).not.toHaveBeenCalled();
    });

    it('should mark the payment failed and skip the cart/email steps if stock validation fails after the claim', async () => {
        const order = buildOrder();
        const claimedPayment = buildPayment({ status: 'success' });

        (Payment.findOne as jest.Mock).mockResolvedValue(buildPayment());
        (Order.findById as jest.Mock).mockResolvedValue(order);
        (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(claimedPayment);
        (validateAndUpdateStock as jest.Mock).mockResolvedValue({ isValid: false, stockErrors: ['out of stock'] });
        (initiatePaystackRefund as jest.Mock).mockResolvedValue({ status: true, data: { id: 999 } });
        (User.findById as jest.Mock).mockResolvedValue({ email: 'user@test.com', username: 'testuser' });

        const result = await markPaymentSuccess('ref_1');

        expect(claimedPayment.status).toBe('failed');
        expect(claimedPayment.save).toHaveBeenCalledTimes(1);
        expect(order.isPaid).toBe(false);
        expect(order.save).not.toHaveBeenCalled();
        expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalledWith(
+           expect.objectContaining({ purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS })
        );
        expect(initiatePaystackRefund).toHaveBeenCalledWith('ref_1', 20000);
        expect(result).toEqual({ alreadyProcessed: false, payment: claimedPayment });
    });
});

describe('markPaymentFailed', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should report alreadyProcessed:true if the payment was not in a pending state to claim', async () => {
        (Payment.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
        (Payment.findOne as jest.Mock).mockResolvedValue(buildPayment({ status: 'success' }));

        const result = await markPaymentFailed('ref_1');

        expect(result.alreadyProcessed).toBe(true);
        expect(Order.findById).not.toHaveBeenCalled();
    });

    it('should claim the payment as failed and send the failure email exactly once', async () => {
        const claimedPayment = buildPayment({ status: 'failed' });
        const order = buildOrder();

        (Payment.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(claimedPayment) // status claim (pending -> failed)
            .mockResolvedValueOnce({ ...claimedPayment, failureEmailSentAt: new Date() }); // email claim
        (Order.findById as jest.Mock).mockResolvedValue(order);
        (User.findById as jest.Mock).mockResolvedValue({ email: 'user@test.com', username: 'testuser' });

        const result = await markPaymentFailed('ref_1');

        expect(sendNotification).toHaveBeenCalledWith({
            purpose: NOTIFICATION_PURPOSE.PAYMENT_FAILED,
            data: { email: 'user@test.com', fullName: 'testuser', reference: 'ref_1', amount: 200 },
        });
        expect(result).toEqual({ alreadyProcessed: false, payment: claimedPayment });
    });

    it('should not send the failure email a second time if it was already sent', async () => {
        const claimedPayment = buildPayment({ status: 'failed' });

        (Payment.findOneAndUpdate as jest.Mock)
            .mockResolvedValueOnce(claimedPayment)
            .mockResolvedValueOnce(null); // email already sent

        await markPaymentFailed('ref_1');

        expect(sendNotification).not.toHaveBeenCalled();
        expect(Order.findById).not.toHaveBeenCalled();
    });
});