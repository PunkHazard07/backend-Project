"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const emailTemp_1 = require("./emailTemp");
const constant_1 = require("./constant");
const ProviderConfig_1 = require("./ProviderConfig");
const sendEmail = async ({ purpose, data, }) => {
    let emailContent;
    switch (purpose) {
        case constant_1.NOTIFICATION_PURPOSE.WELCOME_EMAIL: {
            const { email, fullName } = data;
            const { subject, html } = (0, emailTemp_1.welcomeEmailTemplate)(fullName);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.EMAIL_VERIFICATION: {
            const { email, fullName, code } = data;
            const { subject, html } = (0, emailTemp_1.verificationEmailTemplate)(fullName, code);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.FORGOT_PASSWORD: {
            const { email, fullName, code } = data;
            const { subject, html } = (0, emailTemp_1.forgotPasswordEmailTemplate)(fullName, code);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.PASSWORD_RESET_SUCCESS: {
            const { email, fullName } = data;
            const { subject, html } = (0, emailTemp_1.passwordResetSuccessEmailTemplate)(fullName);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.PAYMENT_SUCCESS: {
            const { email, fullName, reference, amount } = data;
            const { subject, html } = (0, emailTemp_1.paymentSuccessEmailTemplate)(fullName, reference, amount);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.PAYMENT_FAILED: {
            const { email, fullName, reference, amount } = data;
            const { subject, html } = (0, emailTemp_1.paymentFailedEmailTemplate)(fullName, reference, amount);
            emailContent = { to: email, subject, html };
            break;
        }
        case constant_1.NOTIFICATION_PURPOSE.PAYMENT_REFUNDED: {
            const { email, fullName, reference, amount } = data;
            const { subject, html } = (0, emailTemp_1.paymentRefundedEmailTemplate)(fullName, reference, amount);
            emailContent = { to: email, subject, html };
            break;
        }
        default:
            throw new Error(`Unknown notification purpose: ${purpose}`);
    }
    await (0, ProviderConfig_1.emailProvider)(emailContent);
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=service.js.map