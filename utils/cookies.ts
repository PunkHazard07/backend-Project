import type { CookieOptions, Response } from 'express';

export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';

const isProduction = process.env.NODE_ENV === 'production';

const CROSS_SITE_COOKIE_ATTRS: CookieOptions = {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
};

const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    ...CROSS_SITE_COOKIE_ATTRS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
    httpOnly: true,
    ...CROSS_SITE_COOKIE_ATTRS,
    maxAge: 15 * 60 * 1000, 
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, REFRESH_TOKEN_COOKIE_OPTIONS);
};

export const clearRefreshTokenCookie = (res: Response): void => {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, CROSS_SITE_COOKIE_ATTRS);
};

export const setAccessTokenCookie = (res: Response, token: string): void => {
    res.cookie(ACCESS_TOKEN_COOKIE_NAME, token, ACCESS_TOKEN_COOKIE_OPTIONS);
};

export const clearAccessTokenCookie = (res: Response): void => {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, CROSS_SITE_COOKIE_ATTRS);
};