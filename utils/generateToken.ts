import { signAccessToken, signRefreshToken } from './jwt';
import type { SignOptions } from 'jsonwebtoken';

export type TokenRole = 'admin' | 'user';

interface EntityLike {
    _id: unknown;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

const ACCESS_TOKEN_EXPIRY = (process.env.ACCESS_TOKEN_EXPIRY || '15m') as SignOptions['expiresIn'];
const REFRESH_TOKEN_EXPIRY = (process.env.REFRESH_TOKEN_EXPIRY || '7d') as SignOptions['expiresIn'];

const generateTokenPair = (entity: EntityLike, role: TokenRole): TokenPair => {
    const accessToken = signAccessToken({ id: entity._id, role }, ACCESS_TOKEN_EXPIRY);
    const refreshToken = signRefreshToken({ id: entity._id, role }, REFRESH_TOKEN_EXPIRY);

    return { accessToken, refreshToken };
};

export const generateAdminTokens = (admin: EntityLike): TokenPair =>
    generateTokenPair(admin, 'admin');

export const generateUserTokens = (user: EntityLike): TokenPair =>
    generateTokenPair(user, 'user');