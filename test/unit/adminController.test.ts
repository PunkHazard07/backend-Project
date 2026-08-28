import { Request, Response } from 'express';
import {
    registerAdmin,
    adminLogin,
    logoutadmin,
    verifyToken
} from '../../controllers/adminController'; // Update import path if necessary
import Admin from '../../models/Admin';
import TokenBlocklist from '../../models/TokenBlocklist';
import { hashValue, compareValue } from '../../utils/hashing';
import { generateAdminTokens } from '../../utils/generateToken';
import { verifyRefreshToken, verifyAccessToken } from '../../utils/jwt';
import { setRefreshTokenCookie, clearRefreshTokenCookie } from '../../utils/cookies';
import jwt from 'jsonwebtoken';

// 1. Mock External Dependencies
jest.mock('../../models/Admin');
jest.mock('../../models/TokenBlocklist');
jest.mock('../../utils/hashing');
jest.mock('../../utils/generateToken');
jest.mock('../../utils/jwt');
jest.mock('../../utils/cookies');
jest.mock('jsonwebtoken');

const mockedAdmin = Admin as jest.Mocked<typeof Admin>;
const mockedTokenBlocklist = TokenBlocklist as jest.Mocked<typeof TokenBlocklist>;
const mockedHashValue = hashValue as jest.MockedFunction<typeof hashValue>;
const mockedCompareValue = compareValue as jest.MockedFunction<typeof compareValue>;
const mockedGenerateAdminTokens = generateAdminTokens as jest.MockedFunction<typeof generateAdminTokens>;
const mockedVerifyRefreshToken = verifyRefreshToken as jest.MockedFunction<typeof verifyRefreshToken>;
const mockedVerifyAccessToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;
const mockedSetRefreshTokenCookie = setRefreshTokenCookie as jest.MockedFunction<typeof setRefreshTokenCookie>;
const mockedClearRefreshTokenCookie = clearRefreshTokenCookie as jest.MockedFunction<typeof clearRefreshTokenCookie>;
const mockedJwtDecode = jwt.decode as jest.MockedFunction<typeof jwt.decode>;

describe('Admin Controller Unit Tests', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });

        req = {
            body: {},
            headers: {},
            cookies: {},
        };

        res = {
            status: statusMock,
            json: jsonMock,
        };
    });

    // REGISTER ADMIN TESTS
    describe('registerAdmin', () => {
        it('should return 400 if email or password is missing', async () => {
            req.body = { email: 'admin@example.com' };

            await registerAdmin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Email and password are required',
            });
        });

        it('should return 400 if admin already exists', async () => {
            req.body = { email: 'admin@example.com', password: 'password123' };
            mockedAdmin.findOne.mockResolvedValue({ id: 'existing_id' } as any);

            await registerAdmin(req as Request, res as Response);

            expect(mockedAdmin.findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Admin already exists',
            });
        });

        it('should successfully register a new admin and return 201', async () => {
            req.body = { email: 'newadmin@example.com', password: 'password123' };
            mockedAdmin.findOne.mockResolvedValue(null);
            mockedHashValue.mockResolvedValue('hashed_password');
            mockedAdmin.create.mockResolvedValue({ _id: 'new_admin_id', email: 'newadmin@example.com' } as any);

            await registerAdmin(req as Request, res as Response);

            expect(mockedHashValue).toHaveBeenCalledWith('password123');
            expect(mockedAdmin.create).toHaveBeenCalledWith({
                email: 'newadmin@example.com',
                password: 'hashed_password',
            });
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Admin registered successfully',
                adminId: 'new_admin_id',
            });
        });

        it('should return 500 on database error', async () => {
            req.body = { email: 'admin@example.com', password: 'password123' };
            mockedAdmin.findOne.mockRejectedValue(new Error('Database Connection Failed'));

            await registerAdmin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Database Connection Failed',
            });
        });
    });

    // ADMIN LOGIN TESTS
    describe('adminLogin', () => {
        it('should return 400 if credentials are incomplete', async () => {
            req.body = { email: 'admin@example.com' };

            await adminLogin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Email and password are required',
            });
        });

        it('should return 400 if admin is not found', async () => {
            req.body = { email: 'nonexistent@example.com', password: 'password123' };
            mockedAdmin.findOne.mockResolvedValue(null);

            await adminLogin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid credential',
            });
        });

        it('should return 400 if password does not match', async () => {
            req.body = { email: 'admin@example.com', password: 'wrongpassword' };
            const fakeAdmin = { email: 'admin@example.com', password: 'hashed_password' };
            mockedAdmin.findOne.mockResolvedValue(fakeAdmin as any);
            mockedCompareValue.mockResolvedValue(false);

            await adminLogin(req as Request, res as Response);

            expect(mockedCompareValue).toHaveBeenCalledWith('wrongpassword', 'hashed_password');
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Invalid credentials',
            });
        });

        it('should successfully log in admin, set cookies, and return access token', async () => {
            req.body = { email: 'admin@example.com', password: 'correctpassword' };
            const fakeAdmin = {
                _id: 'admin_id',
                email: 'admin@example.com',
                password: 'hashed_password',
                save: jest.fn().mockResolvedValue(true),
                refreshToken: '',
            };

            mockedAdmin.findOne.mockResolvedValue(fakeAdmin as any);
            mockedCompareValue.mockResolvedValue(true);
            mockedGenerateAdminTokens.mockReturnValue({
                accessToken: 'access_token_abc',
                refreshToken: 'refresh_token_xyz',
            });
            mockedHashValue.mockResolvedValue('hashed_refresh_token');

            await adminLogin(req as Request, res as Response);

            expect(fakeAdmin.refreshToken).toBe('hashed_refresh_token');
            expect(fakeAdmin.save).toHaveBeenCalled();
            expect(mockedSetRefreshTokenCookie).toHaveBeenCalledWith(res, 'refresh_token_xyz');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Admin logged in successfully',
                accessToken: 'access_token_abc',
            });
        });

        it('should return 500 if error occurs during login process', async () => {
            req.body = { email: 'admin@example.com', password: 'password123' };
            mockedAdmin.findOne.mockRejectedValue(new Error('Internal error'));

            await adminLogin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'Internal error',
            });
        });
    });

    
    // ADMIN LOGOUT TESTS
    describe('logoutadmin', () => {
        it('should blocklist access token and clear refresh token successfully', async () => {
            req.headers = { authorization: 'Bearer access_token_123' };
            req.cookies = { refreshToken: 'valid_refresh_token' };

            mockedJwtDecode.mockReturnValue({ exp: 1700000000 } as any);
            mockedVerifyRefreshToken.mockReturnValue({ id: 'admin_id' } as any);

            await logoutadmin(req as Request, res as Response);

            expect(mockedTokenBlocklist.create).toHaveBeenCalledWith({
                token: 'access_token_123',
                expiresAt: new Date(1700000000 * 1000),
            });
            expect(mockedAdmin.findByIdAndUpdate).toHaveBeenCalledWith('admin_id', { refreshToken: null });
            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Admin logged out successfully',
            });
        });

        it('should proceed with logout even if refresh token verification throws an error', async () => {
            req.headers = {};
            req.cookies = { refreshToken: 'invalid_or_expired_refresh_token' };

            mockedVerifyRefreshToken.mockImplementation(() => {
                throw new Error('Token expired');
            });

            await logoutadmin(req as Request, res as Response);

            expect(mockedAdmin.findByIdAndUpdate).not.toHaveBeenCalled();
            expect(mockedClearRefreshTokenCookie).toHaveBeenCalledWith(res);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith({
                success: true,
                message: 'Admin logged out successfully',
            });
        });

        it('should return 500 if an unexpected error occurs during blocklisting', async () => {
            req.headers = { authorization: 'Bearer access_token_123' };
            mockedJwtDecode.mockReturnValue({ exp: 1700000000 } as any);
            mockedTokenBlocklist.create.mockRejectedValue(new Error('DB Write Error'));

            await logoutadmin(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                message: 'DB Write Error',
            });
        });
    });

    // VERIFY TOKEN TESTS
    describe('verifyToken', () => {
        it('should return 401 if Authorization header is missing or malformed', async () => {
            req.headers = {}; // missing

            await verifyToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({
                valid: false,
                message: 'Access denied. No token provided.',
            });
        });

        it('should return 403 if token verification fails', async () => {
            req.headers = { authorization: 'Bearer invalid_token' };
            mockedVerifyAccessToken.mockImplementation(() => {
                throw new Error('Invalid token signature');
            });

            await verifyToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                valid: false,
                message: 'Invalid or expired token',
            });
        });

        it('should return 403 if token payload role is not admin', async () => {
            req.headers = { authorization: 'Bearer valid_user_token' };
            mockedVerifyAccessToken.mockReturnValue({ id: 'user_id', role: 'user' } as any);

            await verifyToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                valid: false,
                message: 'Invalid token',
            });
        });

        it('should return 403 if admin is not found in the database', async () => {
            req.headers = { authorization: 'Bearer valid_token' };
            mockedVerifyAccessToken.mockReturnValue({ id: 'nonexistent_admin', role: 'admin' } as any);
            mockedAdmin.findById.mockResolvedValue(null);

            await verifyToken(req as Request, res as Response);

            expect(mockedAdmin.findById).toHaveBeenCalledWith('nonexistent_admin');
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({
                valid: false,
                message: 'Forbidden: Admin access required',
            });
        });

        it('should return 200 with user data if access token is valid and admin exists', async () => {
            req.headers = { authorization: 'Bearer valid_token' };
            mockedVerifyAccessToken.mockReturnValue({ id: 'admin_123', role: 'admin' } as any);
            mockedAdmin.findById.mockResolvedValue({ _id: 'admin_123', email: 'admin@example.com' } as any);

            await verifyToken(req as Request, res as Response);

            expect(jsonMock).toHaveBeenCalledWith({
                valid: true,
                user: { id: 'admin_123', email: 'admin@example.com' },
            });
        });

        it('should return 500 if database fails during verification', async () => {
            req.headers = { authorization: 'Bearer valid_token' };
            mockedVerifyAccessToken.mockReturnValue({ id: 'admin_123', role: 'admin' } as any);
            mockedAdmin.findById.mockRejectedValue(new Error('DB failure'));

            await verifyToken(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(500);
            expect(jsonMock).toHaveBeenCalledWith({
                valid: false,
                message: 'Internal server error',
            });
        });
    });
});