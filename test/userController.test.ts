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
} from '../controllers/userController';
import User from '../models/User';
import Order from '../models/Order';
import TokenBlocklist from '../models/TokenBlocklist';
import validator from 'validator';
import { verifyAccessToken } from '../utils/jwt';
import { generateVerificationToken, generateResetToken } from '../utils/verification';
import { sendNotification, NOTIFICATION_PURPOSE } from '../utils/notification/index';
import { generateUserTokens } from '../utils/generateToken';
import { hashValue, compareValue } from '../utils/hashing';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../utils/cookies';

jest.mock('../models/User');
jest.mock('../models/Order');
jest.mock('../models/TokenBlocklist');
jest.mock('validator');
jest.mock('../utils/jwt');
jest.mock('../utils/verification');
jest.mock('../utils/notification/index');
jest.mock('../utils/generateToken');
jest.mock('../utils/hashing');
jest.mock('../utils/cookies');

const mockedUser = User as unknown as jest.Mocked<typeof User>;
const mockedOrder = Order as unknown as jest.Mocked<typeof Order>;
const mockedTokenBlocklist = TokenBlocklist as unknown as jest.Mocked<typeof TokenBlocklist>;
const mockedValidator = validator as jest.Mocked<typeof validator>;
const mockedVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const mockedGenerateVerificationToken = generateVerificationToken as jest.MockedFunction<
    typeof generateVerificationToken
>;
const mockedGenerateResetToken = generateResetToken as jest.MockedFunction<typeof generateResetToken>;
const mockedSendNotification = sendNotification as jest.MockedFunction<typeof sendNotification>;
const mockedGenerateUserTokens = generateUserTokens as jest.MockedFunction<typeof generateUserTokens>;
const mockedHashValue = hashValue as jest.MockedFunction<typeof hashValue>;
const mockedCompareValue = compareValue as jest.MockedFunction<typeof compareValue>;
const mockedSetRefreshTokenCookie = setRefreshTokenCookie as jest.MockedFunction<typeof setRefreshTokenCookie>;
const mockedClearRefreshTokenCookie = clearRefreshTokenCookie as jest.MockedFunction<typeof clearRefreshTokenCookie>;

describe('userController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    const userId = '507f1f77bcf86cd799439011';
    const email = 'test@example.com';
    const password = 'password123';

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        res = { status: statusMock, json: jsonMock, cookie: jest.fn() } as unknown as Response;
        req = {};
    });

    describe('loginUser', () => {
        beforeEach(() => {
            req.body = { email, password };
        });

        it('should log in a verified user with correct credentials', async () => {
            const mockUser = {
                _id: userId,
                email,
                password: 'hashed',
                verified: true,
                failedLoginAttempts: 0,
                lastLoginAttempt: null,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedCompareValue.mockResolvedValue(true);
            mockedGenerateUserTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
            mockedHashValue.mockResolvedValue('hashedRefresh');

            await loginUser(req as Request, res as Response);

            expect(mockedUser.findOne).toHaveBeenCalledWith({ email });
            expect(mockedCompareValue).toHaveBeenCalledWith(password, 'hashed');
            expect(mockUser.failedLoginAttempts).toBe(0);
            expect(mockUser.save).toHaveBeenCalled();
            expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(res, 'refresh');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'User logged in successfully',
                accessToken: 'access',
            });
        });

        it('should return 400 if user does not exist', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
        });

        it('should return 429 if account is locked out from too many failed attempts', async () => {
            const mockUser = {
                _id: userId,
                email,
                password: 'hashed',
                verified: true,
                failedLoginAttempts: 5,
                lastLoginAttempt: new Date(), // just failed, well within lockout window
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Account temporarily locked due to too many failed login attempts. Please try again later.',
            });
        });

        it('should reset failed attempts and continue if lockout window has passed', async () => {
            const mockUser = {
                _id: userId,
                email,
                password: 'hashed',
                verified: true,
                failedLoginAttempts: 5,
                lastLoginAttempt: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago, past 15 min lockout
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedCompareValue.mockResolvedValue(true);
            mockedGenerateUserTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
            mockedHashValue.mockResolvedValue('hashedRefresh');

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should return 401 and not leak accessToken if user is unverified', async () => {
            const mockUser = {
                _id: userId,
                email,
                password: 'hashed',
                verified: false,
                failedLoginAttempts: 0,
                lastLoginAttempt: null,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);

            await loginUser(req as Request, res as Response);

            expect(mockUser.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Please verify your email before logging in',
                isVerified: false,
            });
        });

        it('should increment failed attempts and return 400 on wrong password', async () => {
            const mockUser = {
                _id: userId,
                email,
                password: 'hashed',
                verified: true,
                failedLoginAttempts: 0,
                lastLoginAttempt: null,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedCompareValue.mockResolvedValue(false);

            await loginUser(req as Request, res as Response);

            expect(mockUser.failedLoginAttempts).toBe(1);
            expect(mockUser.save).toHaveBeenCalled();
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid credentials' });
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await loginUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'An error occurred during login',
            });
        });
    });

    describe('registerUser', () => {
        beforeEach(() => {
            req.body = { username: 'testuser', email, password };
            mockedUser.findOne.mockResolvedValue(null);
            (mockedValidator.isEmail as jest.Mock).mockReturnValue(true);
            mockedHashValue.mockResolvedValue('hashedPassword');
            mockedGenerateVerificationToken.mockReturnValue('123456');
            mockedSendNotification.mockResolvedValue(undefined);
        });

        it('should register a new user and send verification + welcome emails', async () => {
            const saveMock = jest.fn().mockResolvedValue(true);
            (mockedUser as unknown as jest.Mock).mockImplementation(() => ({ save: saveMock }));

            await registerUser(req as Request, res as Response);

            expect(mockedUser.findOne).toHaveBeenCalledWith({ $or: [{ email }, { username: 'testuser' }] });
            expect(mockedValidator.isEmail).toHaveBeenCalledWith(email);
            expect(saveMock).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data: { email, fullName: 'testuser', code: '123456' },
            });
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.WELCOME_EMAIL,
                data: { email, fullName: 'testuser' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'User registered successfully. Please check your email to verify your account.',
            });
        });

        it('should return 400 if required fields are missing', async () => {
            req.body = { email, password };

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'All fields are required' });
        });

        it('should return 400 if password is too short', async () => {
            req.body = { username: 'testuser', email, password: 'short' };

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
        });

        it('should return 400 if user already exists', async () => {
            mockedUser.findOne.mockResolvedValue({ _id: userId } as any);

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'User already exists' });
        });

        it('should return 400 if email is invalid', async () => {
            (mockedValidator.isEmail as jest.Mock).mockReturnValue(false);

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid email' });
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await registerUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Registration failed. Please try again.',
            });
        });
    });

    describe('verifyEmail', () => {
        beforeEach(() => {
            req.query = { email, code: '123456' };
        });

        it('should verify email and return an access token', async () => {
            const mockUser = {
                verified: false,
                verificationToken: '123456',
                verificationTokenCreatedAt: new Date(),
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedGenerateUserTokens.mockReturnValue({ accessToken: 'access', refreshToken: 'refresh' });
            mockedHashValue.mockResolvedValue('hashedRefresh');

            await verifyEmail(req as Request, res as Response);

            expect(mockUser.verified).toBe(true);
            expect(mockUser.verificationToken).toBeNull();
            expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(res, 'refresh');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Email verified successfully',
                accessToken: 'access',
            });
        });

        it('should return 400 if email or code is missing', async () => {
            req.query = { email };

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Email and verification code are required',
            });
        });

        it('should return 400 if token is invalid or expired', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid or expired verification token',
            });
        });

        it('should return 200 if email is already verified', async () => {
            mockedUser.findOne.mockResolvedValue({ verified: true } as any);

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Email is already verified',
            });
        });

        it('should return 400 if the verification code has expired', async () => {
            const mockUser = {
                verified: false,
                verificationToken: '123456',
                verificationTokenCreatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
                save: jest.fn(),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Verification code has expired. Please request a new one.',
            });
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await verifyEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('resendVerificationEmail', () => {
        beforeEach(() => {
            req.body = { email };
        });

        it('should resend verification email for an unverified user', async () => {
            const mockUser = {
                username: 'testuser',
                verified: false,
                verificationTokenCreatedAt: null,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedGenerateVerificationToken.mockReturnValue('654321');
            mockedSendNotification.mockResolvedValue(undefined);

            await resendVerificationEmail(req as Request, res as Response);

            expect(mockUser.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data: { email, fullName: 'testuser', code: '654321' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Verification email sent successfully',
            });
        });

        it('should return 400 if email is missing', async () => {
            req.body = {};

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return a generic 200 message if user does not exist (no email enumeration)', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'If your email exists in our system, a verification email has been sent.',
            });
        });

        it('should return 400 if email is already verified', async () => {
            mockedUser.findOne.mockResolvedValue({ verified: true } as any);

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Email is already verified' });
        });

        it('should return 429 if a token was recently sent', async () => {
            mockedUser.findOne.mockResolvedValue({
                verified: false,
                verificationTokenCreatedAt: new Date(), // just sent
            } as any);

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await resendVerificationEmail(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('logoutUser', () => {
        beforeEach(() => {
            req.headers = { authorization: 'Bearer sometoken' };
        });

        it('should blocklist the token, clear refreshToken, and log out successfully', async () => {
            const futureExp = Math.floor(Date.now() / 1000) + 3600;
            mockedVerifyAccessToken.mockReturnValue({ id: userId, exp: futureExp } as any);
            mockedTokenBlocklist.create.mockResolvedValue({} as any);
            mockedUser.findByIdAndUpdate.mockResolvedValue({} as any);

            await logoutUser(req as Request, res as Response);

            expect(mockedTokenBlocklist.create).toHaveBeenCalledWith({
                token: 'sometoken',
                expiresAt: new Date(futureExp * 1000),
            });
            expect(mockedUser.findByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshToken: null });
            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'User logged out successfully' });
        });

        it('should return 400 if no Authorization header is present', async () => {
            req.headers = {};

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'No token provided' });
        });

        it('should return 400 if the token fails verification', async () => {
            mockedVerifyAccessToken.mockImplementation(() => {
                throw new Error('invalid signature');
            });

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
        });

        it('should return 400 if the decoded token has no exp claim', async () => {
            mockedVerifyAccessToken.mockReturnValue({ id: userId } as any);

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
        });

        it('should return 500 on unexpected error', async () => {
            const futureExp = Math.floor(Date.now() / 1000) + 3600;
            mockedVerifyAccessToken.mockReturnValue({ id: userId, exp: futureExp } as any);
            mockedTokenBlocklist.create.mockRejectedValue(new Error('DB down'));

            await logoutUser(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Server error during logout' });
        });
    });

    describe('getUserProfile', () => {
        beforeEach(() => {
            req.user = { _id: userId } as any;
        });

        it('should return the user profile with an orders summary', async () => {
            const mockUser = { _id: userId, email };
            (mockedUser.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockResolvedValue(mockUser),
            });
            mockedOrder.countDocuments
                .mockResolvedValueOnce(1) // pending
                .mockResolvedValueOnce(2) // shipped
                .mockResolvedValueOnce(3) // delivered
                .mockResolvedValueOnce(0) // cancelled
                .mockResolvedValueOnce(6); // total

            await getUserProfile(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                user: mockUser,
                ordersSummary: {
                    total: 6,
                    pending: 1,
                    shipped: 2,
                    delivered: 3,
                    cancelled: 0,
                },
            });
        });

        it('should return 500 on unexpected error', async () => {
            (mockedUser.findById as jest.Mock).mockReturnValue({
                select: jest.fn().mockRejectedValue(new Error('DB down')),
            });

            await getUserProfile(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'DB down' });
        });
    });

    describe('forgotPassword', () => {
        beforeEach(() => {
            req.body = { email };
        });

        it('should generate a reset token and send the reset email', async () => {
            const mockUser = {
                username: 'testuser',
                email,
                resetPasswordCreatedAt: null,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedGenerateResetToken.mockReturnValue('resetcode');
            mockedSendNotification.mockResolvedValue(undefined);

            await forgotPassword(req as Request, res as Response);

            expect(mockUser.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.FORGOT_PASSWORD,
                data: { email, fullName: 'testuser', code: 'resetcode' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
        });

        it('should return 400 if email is missing', async () => {
            req.body = {};

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return a generic 200 message if user does not exist (no email enumeration)', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'If your email exists in our system, you will receive a password reset link.',
            });
        });

        it('should return 429 if a reset token was recently sent', async () => {
            mockedUser.findOne.mockResolvedValue({
                resetPasswordCreatedAt: new Date(), // just sent
            } as any);

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(429);
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await forgotPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('verifyResetToken', () => {
        beforeEach(() => {
            req.query = { email, code: 'resetcode' };
        });

        it('should return 200 if the reset token is valid', async () => {
            mockedUser.findOne.mockResolvedValue({ _id: userId } as any);

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Token is valid' });
        });

        it('should return 400 if email or code is missing', async () => {
            req.query = { email };

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
        });

        it('should return 400 if token is invalid or expired', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired reset token' });
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await verifyResetToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });

    describe('resetPassword', () => {
        beforeEach(() => {
            req.body = {
                email,
                code: 'resetcode',
                newPassword: 'newpassword123',
                confirmPassword: 'newpassword123',
            };
        });

        it('should reset the password and notify the user', async () => {
            const mockUser = {
                email,
                username: 'testuser',
                password: 'oldhashed',
                resetPasswordToken: 'resetcode',
                resetPasswordExpires: Date.now() + 10000,
                failedLoginAttempts: 3,
                save: jest.fn().mockResolvedValue(true),
            };
            mockedUser.findOne.mockResolvedValue(mockUser as any);
            mockedHashValue.mockResolvedValue('newHashed');
            mockedSendNotification.mockResolvedValue(undefined);

            await resetPassword(req as Request, res as Response);

            expect(mockUser.password).toBe('newHashed');
            expect(mockUser.resetPasswordToken).toBeNull();
            expect(mockUser.failedLoginAttempts).toBe(0);
            expect(mockUser.save).toHaveBeenCalled();
            expect(mockedSendNotification).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.PASSWORD_RESET_SUCCESS,
                data: { email, fullName: 'testuser' },
            });
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({ success: true, message: 'Password reset successful' });
        });

        it('should return 400 if required fields are missing', async () => {
            req.body = { email };

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'All fields are required' });
        });

        it('should return 400 if passwords do not match', async () => {
            req.body.confirmPassword = 'different';

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Passwords do not match' });
        });

        it('should return 400 if the new password is too short', async () => {
            req.body.newPassword = 'short';
            req.body.confirmPassword = 'short';

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Password must be at least 8 characters long',
            });
        });

        it('should return 400 if token is invalid or expired', async () => {
            mockedUser.findOne.mockResolvedValue(null);

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ success: false, message: 'Invalid or expired reset code' });
        });

        it('should return 500 on unexpected error', async () => {
            mockedUser.findOne.mockRejectedValue(new Error('DB down'));

            await resetPassword(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
        });
    });
});