"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleCleanupJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const User_1 = __importDefault(require("../models/User"));
const TokenBlocklist_1 = __importDefault(require("../models/TokenBlocklist"));
// Function to clean up expired tokens from blocklist
const cleanupExpiredTokens = async () => {
    try {
        const now = new Date();
        const result = await TokenBlocklist_1.default.deleteMany({ expiresAt: { $lt: now } });
        console.log(`Cleaned up ${result.deletedCount} expired tokens from blocklist`);
    }
    catch (error) {
        console.error('Error cleaning up expired tokens:', error);
    }
};
// Function to clean up expired verification tokens (older than 24 hours)
const cleanupExpiredVerificationTokens = async () => {
    try {
        // Find users with verification tokens older than 24 hours
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        // Using the verificationTokenCreatedAt field to properly track token age
        const result = await User_1.default.updateMany({
            verified: false,
            verificationToken: { $ne: null },
            verificationTokenCreatedAt: { $lt: yesterday },
        }, {
            $set: {
                verificationToken: null,
                verificationTokenCreatedAt: null,
            },
        });
        console.log(`Reset ${result.modifiedCount} expired verification tokens`);
    }
    catch (error) {
        console.error('Error cleaning up verification tokens:', error);
    }
};
// Reset failed login attempts for accounts that haven't tried logging in for 24 hours
const resetFailedLoginAttempts = async () => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await User_1.default.updateMany({
            failedLoginAttempts: { $gt: 0 },
            lastLoginAttempt: { $lt: yesterday },
        }, { $set: { failedLoginAttempts: 0 } });
        console.log(`Reset failed login attempts for ${result.modifiedCount} users`);
    }
    catch (error) {
        console.error('Error resetting failed login attempts:', error);
    }
};
// Schedule cleanup jobs
const scheduleCleanupJobs = () => {
    // Run every hour, on the hour
    node_cron_1.default.schedule('0 * * * *', async () => {
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
exports.scheduleCleanupJobs = scheduleCleanupJobs;
//# sourceMappingURL=cleanup.js.map