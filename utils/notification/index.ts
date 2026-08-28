import { sendEmail } from "./service";
import { NOTIFICATION_PURPOSE } from "./constant";
import { emailQueue } from "./queue";

const ENQUEUE_TIMEOUT_MS = 3000;

const buildJobId = (purpose: NOTIFICATION_PURPOSE, data: Record<string, any>): string => {
    const dedupKey = data.code ?? data.reference ?? data.email;
    return `${purpose}-${dedupKey}`;
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Enqueue timed out after ${ms}ms`)), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value)
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
};

export const sendNotification = async ({
    purpose,
    data,
}: {
    purpose: NOTIFICATION_PURPOSE;
    data: Record<string, any>;
}): Promise<void> => {
    try {
        await withTimeout(emailQueue.add(purpose, {purpose, data}, {jobId: buildJobId(purpose, data) }),
        ENQUEUE_TIMEOUT_MS
     );
    } catch (error) {
        console.error('Failed to enqueue email job, falling back to direct send:', error);
        await sendEmail({ purpose, data });
    }
};

export { NOTIFICATION_PURPOSE } from './constant';