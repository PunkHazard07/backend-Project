import jwt, { type SignOptions, type VerifyOptions, type JwtPayload } from 'jsonwebtoken';

type SecretEnvVar = 'JWT_SECRET' | 'JWT_REFRESH_SECRET';

const getSecret = (secretEnvVar: SecretEnvVar): string => {
    const secret = process.env[secretEnvVar];
    if (!secret) {
        throw new Error(`${secretEnvVar} is missing from the .env file`);
    }
    return secret;
};

export const signAccessToken = (
    payload: object,
    expiresIn: SignOptions['expiresIn'] = '15m'
): string => {
    return jwt.sign(payload, getSecret('JWT_SECRET'), { expiresIn });
};

export const signRefreshToken = (
    payload: object,
    expiresIn: SignOptions['expiresIn'] = '7d'
): string => {
    return jwt.sign(payload, getSecret('JWT_REFRESH_SECRET'), { expiresIn });
};

export const verifyAccessToken = (token: string, options: VerifyOptions = {}): JwtPayload | string => {
    return jwt.verify(token, getSecret('JWT_SECRET'), options);
};

export const verifyRefreshToken = (token: string): JwtPayload | string => {
    return jwt.verify(token, getSecret('JWT_REFRESH_SECRET'));
};