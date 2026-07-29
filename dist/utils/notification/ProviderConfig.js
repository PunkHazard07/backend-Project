"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailProvider = exports.nodemailerProvider = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// TODO(bullmq): this currently sends mail inline on the request (register,
// forgot-password, etc. all `await` this). Once BullMQ is wired in, make
// this module a queue *consumer* instead -- controllers should enqueue a
// job (purpose + data) and a worker calls sendEmail/emailProvider from
// there, so a slow/failed email send never blocks or fails the request.
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASSWORD', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM'];
for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
    }
}
const port = Number(process.env.SMTP_PORT);
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});
const nodemailerProvider = async ({ to, subject, html }) => {
    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
    });
};
exports.nodemailerProvider = nodemailerProvider;
exports.emailProvider = exports.nodemailerProvider;
//# sourceMappingURL=ProviderConfig.js.map