export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
}

export enum EMAIL_PROVIDER {
    BREVO = "BREVO"
}