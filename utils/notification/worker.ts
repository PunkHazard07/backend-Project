import { Worker, type Job } from 'bullmq';
import { redisConnection } from '../../config/redis';
import { EMAIL_QUEUE_NAME, type EmailJobData } from './queue';
import { sendEmail } from './service';

const CONCURRENCY = 5;

export const emailWorker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
        await sendEmail(job.data);
    },
    {
        connection: redisConnection,
        concurrency: CONCURRENCY
    }
);

emailWorker.on('completed', (job) => {
    console.log(`Email job ${job.id} (${job.data.purpose}) completed`);
});

emailWorker.on('failed', (job, error) => {
    console.error(`Email job ${job?.id} (${job?.data.purpose}) failed:`, error.message);
});

emailWorker.on('error', (error) => {
    console.error('Email worker error:', error);
})