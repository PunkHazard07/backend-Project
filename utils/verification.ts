import crypto from 'crypto';

const generateOTP = (): string => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

export const generateVerificationToken = (): string => generateOTP();

export const generateResetToken = (): string => generateOTP();