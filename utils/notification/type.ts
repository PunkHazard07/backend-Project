export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export enum EMAIL_PROVIDER {
    NODEMAILER = "NODEMAILER",
}