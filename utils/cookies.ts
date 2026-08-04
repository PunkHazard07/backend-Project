import type { Response } from 'express'

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';

const REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 15 * 60 * 1000, 
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

export const setAccessTokenCookie = (res: Response, token: string): void => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, ACCESS_TOKEN_COOKIE_OPTIONS);
};

export const clearAccessTokenCookie = (res: Response): void => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: ACCESS_TOKEN_COOKIE_OPTIONS.httpOnly,
        secure: ACCESS_TOKEN_COOKIE_OPTIONS.secure,
        sameSite: ACCESS_TOKEN_COOKIE_OPTIONS.sameSite,
    });
};