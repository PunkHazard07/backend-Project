import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import TokenBlocklist from '../../models/TokenBlocklist';
import { connectTestDB, clearTestDB, closeTestDB, closeQueueConnections } from '../setup';

/**
 * Integration test for the user registration -> verification -> login ->
 * profile -> logout flow, hitting the real Express app (app.ts) over HTTP
 * via Supertest, backed by a real in-memory MongoDB (booted once in
 * globalSetup).
 *
 * notification/index.ts -> queue.ts -> config/redis.ts is exercised for
 * real: registerUser() really calls emailQueue.add(), which really lands a
 * job on the in-memory Redis booted in globalSetup. Nothing here is mocked.
 * No worker is running in this process (worker.ts is only started in
 * server.ts), so the job sits queued and unprocessed — no real SMTP call
 * is ever made.
 */
import { emailQueue } from '../../utils/notification/queue';

describe('User auth flow (integration)', () => {
    beforeAll(async () => {
        await connectTestDB();
    });

    afterEach(async () => {
        await clearTestDB();
        await emailQueue.drain(); // remove any jobs left over from the previous test
    });

    afterAll(async () => {
        await closeTestDB();
        await closeQueueConnections();
    });

    const validUser = {
        username: 'jdoe',
        email: 'jdoe@example.com',
        password: 'Sup3rSecret!',
    };

    // Registers + verifies a user, returning the Set-Cookie header array so
    // callers can act as that logged-in user against protected routes.
    const registerAndVerifyUser = async (): Promise<string[]> => {
        await request(app).post('/api/register').send(validUser);
        const user = await User.findOne({ email: validUser.email });
        const res = await request(app).get('/api/verify-email').query({
            email: validUser.email,
            code: user!.verificationToken,
        });
        return res.headers['set-cookie'] as unknown as string[];
    };

    describe('POST /api/register', () => {
        it('creates an unverified user and enqueues verification + welcome emails', async () => {
            const res = await request(app).post('/api/register').send(validUser);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const savedUser = await User.findOne({ email: validUser.email });
            expect(savedUser).not.toBeNull();
            expect(savedUser?.verified).toBe(false);
            expect(savedUser?.verificationToken).toBeTruthy();
            expect(savedUser?.password).not.toBe(validUser.password); // hashed, not plaintext

            // registerUser() calls sendNotification() twice (verification email +
            // welcome email); both should have landed as real jobs on the queue.
            const waitingJobs = await emailQueue.getJobs(['waiting', 'delayed', 'active']);
            expect(waitingJobs.length).toBe(2);
        });

        it('rejects a duplicate email or username', async () => {
            await request(app).post('/api/register').send(validUser);

            const res = await request(app).post('/api/register').send(validUser);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toMatch(/already exists/i);

            const count = await User.countDocuments({ email: validUser.email });
            expect(count).toBe(1);
        });

        it('rejects a password under 8 characters', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({ ...validUser, email: 'short@example.com', password: 'short1' });

            expect(res.status).toBe(400);
            expect(await User.findOne({ email: 'short@example.com' })).toBeNull();
        });

        it('rejects a missing field', async () => {
            const res = await request(app)
                .post('/api/register')
                .send({ email: validUser.email, password: validUser.password });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /api/verify-email', () => {
        it('verifies the user with a valid token and sets auth cookies', async () => {
            await request(app).post('/api/register').send(validUser);
            const user = await User.findOne({ email: validUser.email });

            const res = await request(app).get('/api/verify-email').query({
                email: validUser.email,
                code: user!.verificationToken,
            });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
            expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

            const updatedUser = await User.findOne({ email: validUser.email });
            expect(updatedUser?.verified).toBe(true);
            expect(updatedUser?.verificationToken).toBeNull();
        });

        it('rejects an invalid or expired token', async () => {
            await request(app).post('/api/register').send(validUser);

            const res = await request(app).get('/api/verify-email').query({
                email: validUser.email,
                code: 'not-the-real-token',
            });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);

            const user = await User.findOne({ email: validUser.email });
            expect(user?.verified).toBe(false);
        });
    });

    describe('POST /api/login', () => {
        it('rejects login before the email is verified', async () => {
            await request(app).post('/api/register').send(validUser);

            const res = await request(app).post('/api/login').send({
                email: validUser.email,
                password: validUser.password,
            });

            expect(res.status).toBe(401);
            expect(res.body.isVerified).toBe(false);
        });

        it('logs in successfully once verified, with correct credentials', async () => {
            await registerAndVerifyUser();

            const res = await request(app).post('/api/login').send({
                email: validUser.email,
                password: validUser.password,
            });

            expect(res.status).toBe(200);
            const cookies = res.headers['set-cookie'] as unknown as string[];
            expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
        });

        it('rejects an incorrect password and increments failedLoginAttempts', async () => {
            await registerAndVerifyUser();

            const res = await request(app).post('/api/login').send({
                email: validUser.email,
                password: 'wrong-password',
            });

            expect(res.status).toBe(400);
            const user = await User.findOne({ email: validUser.email });
            expect(user?.failedLoginAttempts).toBe(1);
        });

        it('locks the account out after 5 failed attempts', async () => {
            await registerAndVerifyUser();

            for (let i = 0; i < 5; i++) {
                await request(app).post('/api/login').send({
                    email: validUser.email,
                    password: 'wrong-password',
                });
            }

            const res = await request(app).post('/api/login').send({
                email: validUser.email,
                password: validUser.password, // even the correct password should be locked out
            });

            expect(res.status).toBe(429);
            expect(res.body.message).toMatch(/temporarily locked/i);
        });
    });

    describe('GET /api/user/profile', () => {
        it('rejects requests with no auth cookie', async () => {
            const res = await request(app).get('/api/user/profile');
            expect(res.status).toBe(401);
        });

        it('returns the user and order summary when authenticated', async () => {
            const cookies = await registerAndVerifyUser();

            const res = await request(app).get('/api/user/profile').set('Cookie', cookies);

            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe(validUser.email);
            expect(res.body.ordersSummary.total).toBe(0);
        });
    });

    describe('POST /api/logoutUser', () => {
        it('blocklists the access token and clears cookies', async () => {
            const cookies = await registerAndVerifyUser();

            const res = await request(app).post('/api/logoutUser').set('Cookie', cookies);

            expect(res.status).toBe(200);

            const blocklisted = await TokenBlocklist.countDocuments({});
            expect(blocklisted).toBe(1);

            // The now-blocklisted token should no longer work for a protected route.
            const profileRes = await request(app).get('/api/user/profile').set('Cookie', cookies);
            expect(profileRes.status).toBe(401);
        });
    });
});