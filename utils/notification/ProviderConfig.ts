import { BrevoClient } from '@getbrevo/brevo';
import type { EmailPayload } from './type';

const requiredEnvVars = ['BREVO_API_KEY', 'MAIL_FROM'] as const;

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
    }
}

const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY as string });

export const brevoProvider = async ({ to, subject, html }: EmailPayload): Promise<void> => {
    try {
        await brevo.transactionalEmails.sendTransacEmail({
            sender: { name: 'Creative Furniture', email: process.env.MAIL_FROM as string },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Brevo send failed: ${message}`);
    }
};

export const emailProvider: (payload: EmailPayload) => Promise<void> = brevoProvider;