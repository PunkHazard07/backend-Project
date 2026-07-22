import cron from 'node-cron';
import User from '../models/User';
import TokenBlocklist from '../models/TokenBlocklist';

// Function to clean up expired tokens from blocklist
const cleanupExpiredTokens = async (): Promise<void> => {
    try {
        const now = new Date();
        const result = await TokenBlocklist.deleteMany({ expiresAt: { $lt: now } });
        console.log(`Cleaned up ${result.deletedCount} expired tokens from blocklist`);
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
    }
};

// Function to clean up expired verification tokens (older than 24 hours)
const cleanupExpiredVerificationTokens = async (): Promise<void> => {
    try {
        // Find users with verification tokens older than 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Using the verificationTokenCreatedAt field to properly track token age
        const result = await User.updateMany(
            {
                verified: false,
                verificationToken: { $ne: null },
                verificationTokenCreatedAt: { $lt: yesterday },
            },
            {
                $set: {
                    verificationToken: null,
                    verificationTokenCreatedAt: null,
                },
            }
        );

        console.log(`Reset ${result.modifiedCount} expired verification tokens`);
    } catch (error) {
        console.error('Error cleaning up verification tokens:', error);
    }
};

// Reset failed login attempts for accounts that haven't tried logging in for 24 hours
const resetFailedLoginAttempts = async (): Promise<void> => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const result = await User.updateMany(
            {
                failedLoginAttempts: { $gt: 0 },
                lastLoginAttempt: { $lt: yesterday },
            },
            { $set: { failedLoginAttempts: 0 } }
        );

        console.log(`Reset failed login attempts for ${result.modifiedCount} users`);
    } catch (error) {
        console.error('Error resetting failed login attempts:', error);
    }
};

// Schedule cleanup jobs
export const scheduleCleanupJobs = (): void => {
    // Run every hour, on the hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled cleanup jobs...');
        await cleanupExpiredTokens();
        await cleanupExpiredVerificationTokens();
        await resetFailedLoginAttempts();
    });

    // Also run once when the server starts
    cleanupExpiredTokens();
    cleanupExpiredVerificationTokens();
    resetFailedLoginAttempts();
};