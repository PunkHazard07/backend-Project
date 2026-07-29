import Order from '../../models/Order';
import User from '../../models/User';
import Payment, { type IPayment } from '../../models/Payment';
import { validateAndUpdateStock } from '../stockUtils';
import { paystackClient } from '../../config/paystack';
import { sendNotification, NOTIFICATION_PURPOSE } from '../notification';
import { initiatePaystackRefund } from '../../config/paystack';

interface MarkPaymentSuccessResult {
    alreadyProcessed: boolean;
    payment: IPayment | null;
}

const refundOversoldPayment = async ( 
    payment: IPayment,
    order: InstanceType<typeof Order>
): Promise<void> => {
    const refundClaim = await Payment.findOneAndUpdate(
        { reference: payment.reference, refundStatus: 'none' },
        { $set: { refundStatus: 'pending' } },
        { new: true }
    );

    if(!refundClaim) {
        return;
    }

    try {
        const refundResponse = await initiatePaystackRefund(payment.reference, payment.amount * 100);

        if (!refundResponse.status) {
            throw new Error(refundResponse.message || 'Refund request was rejected by Paystack');
        }

        await Payment.findOneAndUpdate(
            { reference: payment.reference },
            {
                $set: {
                    refundStatus: 'processed',
                    refundReference: refundResponse.data?.id != null ? String(refundResponse.data.id) : null,
                    refundedAt: new Date(),
                },
            }
        );

        const user = await User.findById(order.userId);
        if (user) {
            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.REFUND_INITIATED,
                data: { email: user.email, fullName: user.username, reference: payment.reference, amount: payment.amount },
            }).catch((err) => console.log('Failed to send refund email:', err));
        }
    } catch (err: any) {
        await Payment.findOneAndUpdate(
            { reference: payment.reference },
            { $set: { refundStatus: 'failed', refundFailureReason: err.message } }
        );
        //In case the automation fails and requires a human to step in
        console.error(
            `MANUAL ACTION REQUIRED: automatic refund failed for payment ${payment.reference} (order ${order._id}). Reason: ${err.message}`
        );
    }
};

export const markPaymentSuccess = async (reference: string): Promise<MarkPaymentSuccessResult> => {
    const order = await Payment.findOne({ reference }).then((p) => p && Order.findById(p.orderId));
    if (!order) {
        return { alreadyProcessed: false, payment: null };
    }

    //flips pending -> success if it's not already success
    const claimedPayment = await Payment.findOneAndUpdate(
        { reference, status: { $ne: 'success' } },
        { $set: { status: 'success' } },
        { new: true }
    );

    if (!claimedPayment) {
        const current = await Payment.findOne({ reference });
        return { alreadyProcessed: true, payment: current };
    }

    const stockResult = await validateAndUpdateStock(
        order.items.map((item) => ({
            productId: String(item.productId),
            quantity: item.quantity,
        }))
    );

    if (!stockResult.isValid) {
        claimedPayment.status = 'failed';
        await claimedPayment.save();
        await refundOversoldPayment(claimedPayment, order);

        return { alreadyProcessed: false, payment: claimedPayment };
    }

    order.isPaid = true;
    await order.save();

    // TODO: revisit once the cart logic is reworked — this assumes
    // order.userId reliably identifies the same cart owner. If the cart
    // rework changes how carts are keyed/accessed, this line needs to be
    // checked against the new shape.
    await User.findByIdAndUpdate(order.userId, { cartData: []});

    const emailClaim = await Payment.findOneAndUpdate(
        { reference, confirmationEmailSentAt: null },
        { $set: { confirmationEmailSentAt: new Date() } },
        { new: true }
    );

    if (emailClaim) {
        const user = await User.findById(order.userId);
        if (user) {
            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS,
                data: { email: user.email, fullName: user.username, reference, amount: claimedPayment.amount },
            }).catch((err) => console.log('Failed to send payment success email:', err));
        }
    }

    return { alreadyProcessed: false, payment: claimedPayment };
};

export const markPaymentFailed = async (reference: string): Promise<MarkPaymentSuccessResult> => {
    const claimedPayment = await Payment.findOneAndUpdate(
        { reference, status: 'pending' },
        { $set: { status: 'failed' } },
        { new: true }
    );

    if (!claimedPayment) {
        const current = await Payment.findOne({ reference });
        return { alreadyProcessed: true, payment: current };
    }

    const emailClaim = await Payment.findOneAndUpdate(
        { reference, failureEmailSentAt: null },
        { $set: { failureEmailSentAt: new Date() } },
        { new: true }
    );

    if (emailClaim) {
        const order = await Order.findById(claimedPayment.orderId);
        const user = order && (await User.findById(order.userId));
        if (user) {
            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.PAYMENT_FAILED,
                data: { email: user.email, fullName: user.username, reference, amount: claimedPayment.amount },
            }).catch((err) => console.log('Failed to send payment failed email:', err));
        }
    }

    return { alreadyProcessed: false, payment: claimedPayment };
};

export const refundOversoldPayment = async (
    payment: IPayment,
    order: InstanceType<typeof Order>
): Promise<IPayment> => {
    try {
        await paystackClient.post('/refund', { transaction: payment.reference });
    } catch (err) {
        //if payment refund call failed - don't throw and payment get's marked refunded
        console.log(`Refund API call failed for ${payment.reference}:`, err);
    }

    const refundedPayment = await Payment.findOneAndUpdate(
        { reference: payment.reference },
        { $set: { status: 'refunded', refundedAt: new Date() } },
        { new: true }
    );

    const emailClaim = await Payment.findOneAndUpdate(
        { reference: payment.reference, refundEmailSentAt: null },
        { $set: { refundEmailSentAt: new Date() } },
        { new: true }
    );

    if (emailClaim) {
        const user = await User.findById(order.userId);
        if (user) {
            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.PAYMENT_REFUNDED,
                data: { email: user.email, fullName: user.username, reference: payment.reference, amount: payment.amount },
            }).catch((err) => console.log('Failed to send refund email:', err));
        }
    }

    return refundedPayment ?? payment;
};