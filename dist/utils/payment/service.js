"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundOversoldPayment = exports.markPaymentFailed = exports.markPaymentSuccess = void 0;
const Order_1 = __importDefault(require("../../models/Order"));
const User_1 = __importDefault(require("../../models/User"));
const Payment_1 = __importDefault(require("../../models/Payment"));
const stockUtils_1 = require("../stockUtils");
const paystack_1 = require("../../config/paystack");
const notification_1 = require("../notification");
const markPaymentSuccess = async (reference) => {
    const order = await Payment_1.default.findOne({ reference }).then((p) => p && Order_1.default.findById(p.orderId));
    if (!order) {
        return { alreadyProcessed: false, payment: null };
    }
    //flips pending -> success if it's not already success
    const claimedPayment = await Payment_1.default.findOneAndUpdate({ reference, status: { $ne: 'success' } }, { $set: { status: 'success' } }, { new: true });
    if (!claimedPayment) {
        const current = await Payment_1.default.findOne({ reference });
        return { alreadyProcessed: true, payment: current };
    }
    const stockResult = await (0, stockUtils_1.validateAndUpdateStock)(order.items.map((item) => ({
        productId: String(item.productId),
        quantity: item.quantity,
    })));
    if (!stockResult.isValid) {
        const refundedPayment = await (0, exports.refundOversoldPayment)(claimedPayment, order);
        return { alreadyProcessed: false, payment: refundedPayment };
    }
    order.isPaid = true;
    await order.save();
    // TODO: revisit once the cart logic is reworked — this assumes
    // order.userId reliably identifies the same cart owner. If the cart
    // rework changes how carts are keyed/accessed, this line needs to be
    // checked against the new shape.
    await User_1.default.findByIdAndUpdate(order.userId, { cartData: [] });
    const emailClaim = await Payment_1.default.findOneAndUpdate({ reference, confirmationEmailSentAt: null }, { $set: { confirmationEmailSentAt: new Date() } }, { new: true });
    if (emailClaim) {
        const user = await User_1.default.findById(order.userId);
        if (user) {
            await (0, notification_1.sendNotification)({
                purpose: notification_1.NOTIFICATION_PURPOSE.PAYMENT_SUCCESS,
                data: { email: user.email, fullName: user.username, reference, amount: claimedPayment.amount },
            }).catch((err) => console.log('Failed to send payment success email:', err));
        }
    }
    return { alreadyProcessed: false, payment: claimedPayment };
};
exports.markPaymentSuccess = markPaymentSuccess;
const markPaymentFailed = async (reference) => {
    const claimedPayment = await Payment_1.default.findOneAndUpdate({ reference, status: 'pending' }, { $set: { status: 'failed' } }, { new: true });
    if (!claimedPayment) {
        const current = await Payment_1.default.findOne({ reference });
        return { alreadyProcessed: true, payment: current };
    }
    const emailClaim = await Payment_1.default.findOneAndUpdate({ reference, failureEmailSentAt: null }, { $set: { failureEmailSentAt: new Date() } }, { new: true });
    if (emailClaim) {
        const order = await Order_1.default.findById(claimedPayment.orderId);
        const user = order && (await User_1.default.findById(order.userId));
        if (user) {
            await (0, notification_1.sendNotification)({
                purpose: notification_1.NOTIFICATION_PURPOSE.PAYMENT_FAILED,
                data: { email: user.email, fullName: user.username, reference, amount: claimedPayment.amount },
            }).catch((err) => console.log('Failed to send payment failed email:', err));
        }
    }
    return { alreadyProcessed: false, payment: claimedPayment };
};
exports.markPaymentFailed = markPaymentFailed;
const refundOversoldPayment = async (payment, order) => {
    try {
        await paystack_1.paystackClient.post('/refund', { transaction: payment.reference });
    }
    catch (err) {
        //if payment refund call failed - don't throw and payment get's marked refunded
        console.log(`Refund API call failed for ${payment.reference}:`, err);
    }
    const refundedPayment = await Payment_1.default.findOneAndUpdate({ reference: payment.reference }, { $set: { status: 'refunded', refundedAt: new Date() } }, { new: true });
    const emailClaim = await Payment_1.default.findOneAndUpdate({ reference: payment.reference, refundEmailSentAt: null }, { $set: { refundEmailSentAt: new Date() } }, { new: true });
    if (emailClaim) {
        const user = await User_1.default.findById(order.userId);
        if (user) {
            await (0, notification_1.sendNotification)({
                purpose: notification_1.NOTIFICATION_PURPOSE.PAYMENT_REFUNDED,
                data: { email: user.email, fullName: user.username, reference: payment.reference, amount: payment.amount },
            }).catch((err) => console.log('Failed to send refund email:', err));
        }
    }
    return refundedPayment ?? payment;
};
exports.refundOversoldPayment = refundOversoldPayment;
//# sourceMappingURL=service.js.map