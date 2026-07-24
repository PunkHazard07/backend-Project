import {
    verificationEmailTemplate,
    welcomeEmailTemplate,
    forgotPasswordEmailTemplate,
    passwordResetSuccessEmailTemplate,
} from './emailTemp';
import { NOTIFICATION_PURPOSE } from './constant';
import { emailProvider } from './ProviderConfig';

export const sendEmail = async ({
    purpose,
    data,
}: {
    purpose: NOTIFICATION_PURPOSE;
    data: Record<string, any>;
}): Promise<void> => {
    let emailContent: { to: string; subject: string; html: string };

    switch (purpose) {
        case NOTIFICATION_PURPOSE.WELCOME_EMAIL: {
            const { email, fullName } = data;
            const { subject, html } = welcomeEmailTemplate(fullName);
            emailContent = { to: email, subject, html };
            break;
        }

        case NOTIFICATION_PURPOSE.EMAIL_VERIFICATION: {
            const { email, fullName, code } = data;
            const { subject, html } = verificationEmailTemplate(fullName, code);
            emailContent = { to: email, subject, html };
            break;
        }

        case NOTIFICATION_PURPOSE.FORGOT_PASSWORD: {
            const { email, fullName, code } = data;
            const { subject, html } = forgotPasswordEmailTemplate(fullName, code);
            emailContent = { to: email, subject, html };
            break;
        }

        case NOTIFICATION_PURPOSE.PASSWORD_RESET_SUCCESS: {
            const { email, fullName } = data;
            const { subject, html } = passwordResetSuccessEmailTemplate(fullName);
            emailContent = { to: email, subject, html };
            break;
        }

        default:
            throw new Error(`Unknown notification purpose: ${purpose}`);
    }

    await emailProvider(emailContent);
};