import type { Request, Response } from 'express';
import {
    loginUser,
    registerUser,
    verifyEmail,
    resendVerificationEmail,
    logoutUser,
    getUserProfile,
    forgotPassword,
    verifyResetToken,
    resetPassword,
} from '../../controllers/userController';
import User from '../../models/User';
import Order from '../../models/Order';
import TokenBlocklist from '../../models/TokenBlocklist';
import validator from 'validator';
import { verifyAccessToken } from '../../utils/jwt';
import { generateVerificationToken, generateResetToken } from '../../utils/verification';
import { sendNotification, NOTIFICATION_PURPOSE } from '../../utils/notification/index';
import { generateUserTokens } from '../../utils/generateToken';
import { hashValue, compareValue } from '../../utils/hashing';
import {
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    setAccessTokenCookie,
    clearAccessTokenCookie,
    ACCESS_TOKEN_COOKIE_NAME,
} from '../../utils/cookies';

jest.mock('../../models/User');
jest.mock('../../models/Order');
jest.mock('../../models/TokenBlocklist');
jest.mock('validator');
jest.mock('../../utils/jwt');
jest.mock('../../utils/verification');
// Auto-mocking would still import the real module (and its ProviderConfig,
// which throws if EMAIL_USER/etc are unset), so we supply an explicit factory.
jest.mock('../../utils/notification/index', () => ({
    sendNotification: jest.fn(),
    NOTIFICATION_PURPOSE: jest.requireActual('../../utils/notification/constant').NOTIFICATION_PURPOSE,
}));
jest.mock('../../utils/generateToken');
jest.mock('../../utils/hashing');
jest.mock('../../utils/cookies');

const mockedUser = User as unknown as jest.Mocked<typeof User>;
const mockedOrder = Order as unknown as jest.Mocked<typeof Order>;
const mockedTokenBlocklist = TokenBlocklist as unknown as jest.Mocked<typeof TokenBlocklist>;
const mockedValidator = validator as jest.Mocked<typeof validator>;
const mockedVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const mockedGenerateVerificationToken = generateVerificationToken as jest.MockedFunction<typeof generateVerificationToken>;
const mockedGenerateResetToken = generateResetToken as jest.MockedFunction<typeof generateResetToken>;
const mockedSendNotification = sendNotification as jest.MockedFunction<typeof sendNotification>;
const mockedGenerateUserTokens = generateUserTokens as jest.MockedFunction<typeof generateUserTokens>;
const mockedHashValue = hashValue as jest.MockedFunction<typeof hashValue>;
const mockedCompareValue = compareValue as jest.MockedFunction<typeof compareValue>;
const mockedSetRefreshTokenCookie = setRefreshTokenCookie as jest.MockedFunction<typeof setRefreshTokenCookie>;
const mockedClearRefreshTokenCookie = clearRefreshTokenCookie as jest.MockedFunction<typeof clearRefreshTokenCookie>;
const mockedSetAccessTokenCookie = setAccessTokenCookie as jest.MockedFunction<typeof setAccessTokenCookie>;
const mockedClearAccessTokenCookie = clearAccessTokenCookie as jest.MockedFunction<typeof clearAccessTokenCookie>;

describe('userController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;
    let cookieMock: jest.Mock;
    let clearCookieMock: jest.Mock;

    const userId = '507f1f77bcf86cd799439011';

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        cookieMock = jest.fn();
        clearCookieMock = jest.fn();
        res = {
            status: statusMock,
            json: jsonMock,
            cookie: cookieMock,
            clearCookie: clearCookieMock,
        } as unknown as Response;
        req = { body: {}, query: {}, cookies: {} };

        mockedGenerateUserTokens.mockReturnValue({
            accessToken: 'fake-access-token',
            refreshToken: 'fake-refresh-token',
        });
        mockedHashValue.mockResolvedValue('hashed-value');
    });

    
    describe('loginUser', () => {
        const buildUser = (overrides = {}) => ({
            _id: userId,
            email: 'test@example.com',
            password: 'hashed-password',
            verified: true,
            failedLoginAttempts: 0,
            lastLoginAttempt: null,
            refreshToken: null,
            save: jest.fn().mockResolvedValue(undefined),
            ...overrides,
        });

        beforeEach(() => {
            req.body = { email: 'test@example.com', password: 'Password123!' };
        });

        it('returns 400 when the user does not exist', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
        });

        it('returns 429 when the account is locked out from too many failed attempts', async () => {
            const user = buildUser({
                failedLoginAttempts: 5,
                lastLoginAttempt: new Date(), // just failed, well within lockout window
            });
            mockedUser.findOne.mockResolvedValue(user as any);

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ success: false })
            );
        });

        it('resets the failed-attempt counter once the lockout window has passed', async () => {
            const longAgo = new Date(Date.now() - 16 * 60 * 1000); // 16 min ago, lockout is 15 min
            const user = buildUser({ failedLoginAttempts: 5, lastLoginAttempt: longAgo });
            mockedUser.findOne.mockResolvedValue(user as any);
            mockedCompareValue.mockResolvedValue(true);

            await loginUser(req as Request, res as Response);

            expect(user.failedLoginAttempts).toBe(0);
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 401 when the user has not verified their email', async () => {
            const user = buildUser({ verified: false });
            mockedUser.findOne.mockResolvedValue(user as any);

            await loginUser(req as Request, res as Response);

            expect(user.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ success: false, isVerified: false })
            );
        });

        it('logs in successfully on correct credentials: resets attempts, sets cookies, saves hashed refresh token', async () => {
            const user = buildUser();
            mockedUser.findOne.mockResolvedValue(user as any);
            mockedCompareValue.mockResolvedValue(true);

            await loginUser(req as Request, res as Response);

            expect(mockedCompareValue).toHaveBeenCalledWith('Password123!', 'hashed-password');
            expect(user.failedLoginAttempts).toBe(0);
            expect(mockedGenerateUserTokens).toHaveBeenCalledWith(user);
            expect(mockedHashValue).toHaveBeenCalledWith('fake-refresh-token');
            expect(user.refreshToken).toBe('hashed-value');
            expect(user.save).toHaveBeenCalled();
            expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(res, 'fake-refresh-token');
            expect(mockedSetAccessTokenCookie).toHaveBeenCalledWith(res, 'fake-access-token');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('increments failedLoginAttempts and returns 400 on wrong password', async () => {
            const user = buildUser();
            mockedUser.findOne.mockResolvedValue(user as any);
            mockedCompareValue.mockResolvedValue(false);

            await loginUser(req as Request, res as Response);

            expect(user.failedLoginAttempts).toBe(1);
            expect(user.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
        });

        it('returns 500 on unexpected database error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('registerUser', () => {
        beforeEach(() => {
            req.body = { username: 'testuser', email: 'test@example.com', password: 'Password123!' };
            mockedValidator.isEmail.mockReturnValue(true);
            mockedGenerateVerificationToken.mockReturnValue('123456');
        });

        it('returns 400 when required fields are missing', async () => {
            req.body = { username: 'testuser' }; // missing email/password

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(mockedUser.findOne).not.toHaveBeenCalled();
        });

        it('returns 400 when password is shorter than 8 characters', async () => {
            req.body.password = 'short';

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('8 characters') })
            );
        });

        it('returns 400 when the user already exists', async () => {
            mockedUser.findOne.mockResolvedValue({ _id: userId } as any);

            await registerUser(req as Request, res as Response);

            expect(mockedUser.findOne).toHaveBeenCalledWith({
                $or: [{ email: 'test@example.com' }, { username: 'testuser' }],
            });
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'User already exists' });
        });

        it('returns 400 when the email fails validation', async () => {
            mockedUser.findOne.mockResolvedValue(null);
            mockedValidator.isEmail.mockReturnValue(false);

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid email' });
        });

        it('creates the user, hashes the password, and sends both verification and welcome emails', async () => {
            mockedUser.findOne.mockResolvedValue(null);
            const saveMock = jest.fn().mockResolvedValue(undefined);
            (mockedUser as any).mockImplementation(function (this: any, data: any) {
                Object.assign(this, data);
                this.save = saveMock;
            });

            await registerUser(req as Request, res as Response);

            expect(mockedHashValue).toHaveBeenCalledWith('Password123!');
            expect(saveMock).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data: { email: 'test@example.com', fullName: 'testuser', code: '123456' },
            });
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.WELCOME_EMAIL,
                data: { email: 'test@example.com', fullName: 'testuser' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            );
        });

        it('returns 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('verifyEmail', () => {
        const buildUser = (overrides = {}) => ({
            _id: userId,
            email: 'test@example.com',
            verified: false,
            verificationToken: '123456',
            verificationTokenCreatedAt: new Date(),
            refreshToken: null,
            save: jest.fn().mockResolvedValue(undefined),
            ...overrides,
        });

        it('returns 400 when email or code query params are missing', async () => {
            req.query = { email: 'test@example.com' }; // missing code

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(mockedUser.findOne).not.toHaveBeenCalled();
        });

        it('returns 400 when no user matches the email/code pair', async () => {
            req.query = { email: 'test@example.com', code: '123456' };
            mockedUser.findOne.mockResolvedValue(null);

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Invalid or expired verification token' })
            );
        });

        it('returns 200 "already verified" without reissuing tokens when user.verified is already true', async () => {
            req.query = { email: 'test@example.com', code: '123456' };
            const user = buildUser({ verified: true });
            mockedUser.findOne.mockResolvedValue(user as any);

            await verifyEmail(req as Request, res as Response);

            expect(mockedGenerateUserTokens).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Email is already verified' })
            );
        });

        it('returns 400 when the verification token has expired (older than 10 minutes)', async () => {
            req.query = { email: 'test@example.com', code: '123456' };
            const expiredDate = new Date(Date.now() - 11 * 60 * 1000);
            const user = buildUser({ verificationTokenCreatedAt: expiredDate });
            mockedUser.findOne.mockResolvedValue(user as any);

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('expired') })
            );
        });

        it('verifies the user, clears the token, and sets auth cookies on success', async () => {
            req.query = { email: 'test@example.com', code: '123456' };
            const user = buildUser();
            mockedUser.findOne.mockResolvedValue(user as any);

            await verifyEmail(req as Request, res as Response);

            expect(user.verified).toBe(true);
            expect(user.verificationToken).toBeNull();
            expect(user.verificationTokenCreatedAt).toBeNull();
            expect(mockedGenerateUserTokens).toHaveBeenCalledWith(user);
            expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(res, 'fake-refresh-token');
            expect(mockedSetAccessTokenCookie).toHaveBeenCalledWith(res, 'fake-access-token');
            expect(user.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 on unexpected error', async () => {
            req.query = { email: 'test@example.com', code: '123456' };
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('resendVerificationEmail', () => {
        beforeEach(() => {
            req.body = { email: 'test@example.com' };
            mockedGenerateVerificationToken.mockReturnValue('654321');
        });

        it('returns 400 when email is missing', async () => {
            req.body = {};

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('returns a generic 200 success message when no user matches (prevents user enumeration)', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await resendVerificationEmail(req as Request, res as Response);

            expect(mockedSendNotification).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 400 when the user is already verified', async () => {
            mockedUser.findOne.mockResolvedValue({ verified: true } as any);

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Email is already verified' })
            );
        });

        it('returns 429 when a token was already sent within the last 5 minutes (anti-spam)', async () => {
            const recent = new Date(Date.now() - 2 * 60 * 1000);
            mockedUser.findOne.mockResolvedValue({
                verified: false,
                verificationTokenCreatedAt: recent,
            } as any);

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
        });

        it('generates a new token, saves the user, and resends the verification email', async () => {
            const user = {
                verified: false,
                username: 'testuser',
                verificationToken: 'old',
                verificationTokenCreatedAt: new Date(Date.now() - 6 * 60 * 1000),
                save: jest.fn().mockResolvedValue(undefined),
            };
            mockedUser.findOne.mockResolvedValue(user as any);

            await resendVerificationEmail(req as Request, res as Response);

            expect(user.verificationToken).toBe('654321');
            expect(user.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data: { email: 'test@example.com', fullName: 'testuser', code: '654321' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('logoutUser', () => {
        it('clears cookies and returns 200 immediately when there is no access token cookie', async () => {
            req.cookies = {};

            await logoutUser(req as Request, res as Response);

            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(mockedClearAccessTokenCookie).toHaveBeenCalledWith(res);
            expect(mockedVerifyAccessToken).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 400 and clears cookies when the token is malformed/undecodable', async () => {
            req.cookies = { [ACCESS_TOKEN_COOKIE_NAME]: 'garbage-token' };
            mockedVerifyAccessToken.mockImplementation(() => {
                throw new Error('jwt malformed');
            });

            await logoutUser(req as Request, res as Response);

            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(mockedClearAccessTokenCookie).toHaveBeenCalledWith(res);
            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('returns 400 when the decoded token is a string or missing "exp"', async () => {
            req.cookies = { [ACCESS_TOKEN_COOKIE_NAME]: 'weird-token' };
            mockedVerifyAccessToken.mockReturnValue('a-raw-string' as any);

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('blocklists the token, clears the stored refresh token, clears cookies, and returns 200', async () => {
            req.cookies = { [ACCESS_TOKEN_COOKIE_NAME]: 'valid-token' };
            const exp = Math.floor(Date.now() / 1000) + 900;
            mockedVerifyAccessToken.mockReturnValue({ id: userId, exp } as any);
            mockedTokenBlocklist.create.mockResolvedValue({} as any);
            mockedUser.findByIdAndUpdate.mockResolvedValue({} as any);

            await logoutUser(req as Request, res as Response);

            expect(mockedTokenBlocklist.create).toHaveBeenCalledWith(
                expect.objectContaining({ token: 'valid-token' })
            );
            expect(mockedUser.findByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshToken: null });
            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(mockedClearAccessTokenCookie).toHaveBeenCalledWith(res);
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 when the blocklist write fails unexpectedly', async () => {
            req.cookies = { [ACCESS_TOKEN_COOKIE_NAME]: 'valid-token' };
            const exp = Math.floor(Date.now() / 1000) + 900;
            mockedVerifyAccessToken.mockReturnValue({ id: userId, exp } as any);
            mockedTokenBlocklist.create.mockRejectedValue(new Error('DB down'));

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('getUserProfile', () => {
        beforeEach(() => {
            req.user = { _id: userId } as any;
        });

        it('returns the user with password excluded and an order status summary', async () => {
            const selectMock = jest.fn().mockResolvedValue({ _id: userId, email: 'test@example.com' });
            mockedUser.findById.mockReturnValue({ select: selectMock } as any);
            mockedOrder.countDocuments
                .mockResolvedValueOnce(2) // pending
                .mockResolvedValueOnce(1) // shipped
                .mockResolvedValueOnce(3) // delivered
                .mockResolvedValueOnce(0) // cancelled
                .mockResolvedValueOnce(6); // total

            await getUserProfile(req as Request, res as Response);

            expect(mockedUser.findById).toHaveBeenCalledWith(userId);
            expect(selectMock).toHaveBeenCalledWith('-password');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    ordersSummary: { total: 6, pending: 2, shipped: 1, delivered: 3, cancelled: 0 },
                })
            );
        });

        it('returns 500 on unexpected error', async () => {
            mockedUser.findById.mockImplementation(() => {
                throw new Error('DB down');
            });

            await getUserProfile(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('forgotPassword', () => {
        beforeEach(() => {
            req.body = { email: 'test@example.com' };
            mockedGenerateResetToken.mockReturnValue('reset-token-123');
        });

        it('returns 400 when email is missing', async () => {
            req.body = {};

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('returns a generic 200 message when no user matches (prevents user enumeration)', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await forgotPassword(req as Request, res as Response);

            expect(mockedSendNotification).not.toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 429 when a reset token was already sent within the last 5 minutes', async () => {
            mockedUser.findOne.mockResolvedValue({
                resetPasswordCreatedAt: new Date(Date.now() - 60 * 1000),
            } as any);

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
        });

        it('generates and saves a reset token, then sends the email', async () => {
            const user: any = {
                username: 'testuser',
                email: 'test@example.com',
                resetPasswordCreatedAt: null,
                save: jest.fn().mockResolvedValue(undefined),
            };
            mockedUser.findOne.mockResolvedValue(user as any);

            await forgotPassword(req as Request, res as Response);

            expect(user.resetPasswordToken).toBe('reset-token-123');
            expect(user.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.FORGOT_PASSWORD,
                data: { email: 'test@example.com', fullName: 'testuser', code: 'reset-token-123' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('verifyResetToken', () => {
        it('returns 400 when email or code query params are missing', async () => {
            req.query = { email: 'test@example.com' };

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(mockedUser.findOne).not.toHaveBeenCalled();
        });

        it('returns 400 when no user matches (invalid or expired token)', async () => {
            req.query = { email: 'test@example.com', code: 'bad-code' };
            mockedUser.findOne.mockResolvedValue(null);

            await verifyResetToken(req as Request, res as Response);

            expect(mockedUser.findOne).toHaveBeenCalledWith({
                email: 'test@example.com',
                resetPasswordToken: 'bad-code',
                resetPasswordExpires: { $gt: expect.any(Number) },
            });
            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('returns 200 when the token is valid', async () => {
            req.query = { email: 'test@example.com', code: 'good-code' };
            mockedUser.findOne.mockResolvedValue({ _id: userId } as any);

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Token is valid' });
        });

        it('returns 500 on unexpected error', async () => {
            req.query = { email: 'test@example.com', code: 'good-code' };
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    
    describe('resetPassword', () => {
        beforeEach(() => {
            req.body = {
                email: 'test@example.com',
                code: 'good-code',
                newPassword: 'NewPassword123!',
                confirmPassword: 'NewPassword123!',
            };
        });

        it('returns 400 when a required field is missing', async () => {
            req.body = { email: 'test@example.com' };

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(mockedUser.findOne).not.toHaveBeenCalled();
        });

        it('returns 400 when newPassword and confirmPassword do not match', async () => {
            req.body.confirmPassword = 'Different123!';

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Passwords do not match' })
            );
        });

        it('returns 400 when the new password is shorter than 8 characters', async () => {
            req.body.newPassword = 'short';
            req.body.confirmPassword = 'short';

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: expect.stringContaining('8 characters') })
            );
        });

        it('returns 400 when no user matches the email/code/expiry combination', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Invalid or expired reset code' })
            );
        });

        it('hashes the new password, clears the reset token, resets failed attempts, saves, and notifies', async () => {
            const user = {
                email: 'test@example.com',
                username: 'testuser',
                password: 'old-hash',
                resetPasswordToken: 'good-code',
                resetPasswordExpires: Date.now() + 60000,
                failedLoginAttempts: 3,
                save: jest.fn().mockResolvedValue(undefined),
            };
            mockedUser.findOne.mockResolvedValue(user as any);

            await resetPassword(req as Request, res as Response);

            expect(mockedHashValue).toHaveBeenCalledWith('NewPassword123!');
            expect(user.password).toBe('hashed-value');
            expect(user.resetPasswordToken).toBeNull();
            expect(user.resetPasswordExpires).toBeNull();
            expect(user.failedLoginAttempts).toBe(0);
            expect(user.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.PASSWORD_RESET_SUCCESS,
                data: { email: 'test@example.com', fullName: 'testuser' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('returns 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });
});