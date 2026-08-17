import { sendNotification, NOTIFICATION_PURPOSE } from "../utils/notification";
import { emailQueue } from "../utils/notification/queue";
import { sendEmail } from "../utils/notification/service";

jest.mock('../utils/notification/queue', () => ({
    emailQueue: { add: jest.fn() },
}));

jest.mock('../utils/notification/service', () => ({
    sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockAdd = emailQueue.add as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

describe('sendNotification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('happy path (Redis reachable)', () => {
        it('enqueues the job and does not fall back to direct send', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });

            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data: { email: 'test@example.com', code: 'abc123' },
            });

            expect(mockAdd).toHaveBeenCalledTimes(1);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });

        it('passes purpose and data through as the job payload', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });
            const data = { email: 'test@example.com', code: 'abc123' };

            await sendNotification({ purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION, data });

            expect(mockAdd).toHaveBeenCalledWith(
                NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                { purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION, data },
                expect.any(Object)
            );
        });
    });

        describe('jobId dedup key selection', () => {
        it('never produces a jobId containing a colon', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });

            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.PAYMENT_SUCCESS,
                data: { reference: 'pay_ref_1' },
            });

            const jobId = mockAdd.mock.calls[0][2].jobId;
            expect(jobId).not.toContain(':');
        });

        it('prefers "code" when present', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });

            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.FORGOT_PASSWORD,
                data: { email: 'test@example.com', code: 'reset_code_1' },
            });

            expect(mockAdd.mock.calls[0][2].jobId).toBe(`${NOTIFICATION_PURPOSE.FORGOT_PASSWORD}-reset_code_1`);
        });

        it('prefers "reference" over "email" when "code" is absent', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });

            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.PAYMENT_FAILED,
                data: { email: 'test@example.com', reference: 'pay_ref_2' },
            });

            expect(mockAdd.mock.calls[0][2].jobId).toBe(`${NOTIFICATION_PURPOSE.PAYMENT_FAILED}-pay_ref_2`);
        });

        it('falls back to "email" when neither "code" nor "reference" is present', async () => {
            mockAdd.mockResolvedValue({ id: 'job_1' });

            await sendNotification({
                purpose: NOTIFICATION_PURPOSE.WELCOME_EMAIL,
                data: { email: 'test@example.com' },
            });

            expect(mockAdd.mock.calls[0][2].jobId).toBe(`${NOTIFICATION_PURPOSE.WELCOME_EMAIL}-test@example.com`);
        });
    });

        describe('fallback to direct send (Option B)', () => {
        it('falls back to sendEmail when the enqueue rejects', async () => {
            mockAdd.mockRejectedValue(new Error('ECONNREFUSED'));
            const data = { email: 'test@example.com', code: 'abc123' };

            await sendNotification({ purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION, data });

            expect(mockSendEmail).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data,
            });
        });

        it('does not throw when the enqueue rejects but the fallback send succeeds', async () => {
            mockAdd.mockRejectedValue(new Error('ECONNREFUSED'));

            await expect(
                sendNotification({
                    purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                    data: { email: 'test@example.com', code: 'abc123' },
                })
            ).resolves.toBeUndefined();
        });

        it('propagates the error if the fallback send also fails', async () => {
            mockAdd.mockRejectedValue(new Error('ECONNREFUSED'));
            mockSendEmail.mockRejectedValueOnce(new Error('SMTP down'));

            await expect(
                sendNotification({
                    purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                    data: { email: 'test@example.com', code: 'abc123' },
                })
            ).rejects.toThrow('SMTP down');
        });

        it('falls back when the enqueue hangs past the timeout instead of rejecting', async () => {
            jest.useFakeTimers();
            // Simulate the exact real-world case this timeout exists for:
            // maxRetriesPerRequest: null means a command against an
            // unreachable Redis retries forever rather than rejecting, so
            // emailQueue.add() never settles on its own here either.
            mockAdd.mockReturnValue(new Promise(() => {}));
            const data = { email: 'test@example.com', code: 'abc123' };

            const pending = sendNotification({ purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION, data });

            await jest.advanceTimersByTimeAsync(3000);
            await pending;

            expect(mockSendEmail).toHaveBeenCalledWith({
                purpose: NOTIFICATION_PURPOSE.EMAIL_VERIFICATION,
                data,
            });

            jest.useRealTimers();
        });
    });
});
