import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailPayload } from './type';

// TODO(bullmq): this currently sends mail inline on the request (register,
// forgot-password, etc. all `await` this). Once BullMQ is wired in, make
// this module a queue *consumer* instead -- controllers should enqueue a
// job (purpose + data) and a worker calls sendEmail/emailProvider from
// there, so a slow/failed email send never blocks or fails the request.

const requiredEnvVars = [ 'EMAIL_USER', 'EMAIL_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM' ] as const;

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
    }
}

const port = Number(process.env.SMTP_PORT);

const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});

export const nodemailerProvider = async ({ to, subject, html }: EmailPayload): Promise<void> => {
    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
    });
};

export const emailProvider: (payload: EmailPayload) => Promise<void> = nodemailerProvider;