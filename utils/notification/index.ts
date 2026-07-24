import { sendEmail } from "./service";
import { NOTIFICATION_PURPOSE } from "./constant";

// TODO(bullmq): once queueing is added, this is the seam -- swap the body of
// sendNotification to enqueue a job instead of calling sendEmail directly,
// and nothing outside this file needs to change.

export const sendNotification = async ({
    purpose,
    data,
}: {
    purpose: NOTIFICATION_PURPOSE;
    data: Record<string, any>;
}): Promise<void> => {
    await sendEmail({ purpose, data });
};

export { NOTIFICATION_PURPOSE } from './constant';