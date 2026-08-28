import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis";
import { NOTIFICATION_PURPOSE } from "./constant";

export interface EmailJobData {
    purpose: NOTIFICATION_PURPOSE;
    data: Record<string, any>;
}

export const EMAIL_QUEUE_NAME = 'email-notifications';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: {
            age: 24 * 60 * 60,
            count: 1000
        },
        removeOnFail: {
            age: 7 * 24 * 60 * 60
        }
    }
});

emailQueue.on('error', (error) => {
    console.error('Email queue error:', error);
});