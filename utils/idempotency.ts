import crypto from 'crypto';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-_]{8,128}$/;

export const generateIdempotencyKey = (): string => crypto.randomUUID();

export const isValidIdempotencyKey = (key: unknown): key is string => {
    return typeof key === 'string' && IDEMPOTENCY_KEY_PATTERN.test(key);
};