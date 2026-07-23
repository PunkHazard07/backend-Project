import type { Response } from 'express'

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

const REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, REFRESH_TOKEN_COOKIE_OPTIONS);
};

export const clearRefreshTokenCookie = (res: Response): void => {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: REFRESH_TOKEN_COOKIE_OPTIONS.httpOnly,
        secure: REFRESH_TOKEN_COOKIE_OPTIONS.secure,
        sameSite: REFRESH_TOKEN_COOKIE_OPTIONS.sameSite,
    });
};