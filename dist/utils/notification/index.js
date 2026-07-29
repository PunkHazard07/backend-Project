"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_PURPOSE = exports.sendNotification = void 0;
const service_1 = require("./service");
// TODO(bullmq): once queueing is added, this is the seam -- swap the body of
// sendNotification to enqueue a job instead of calling sendEmail directly,
// and nothing outside this file needs to change.
// TODO(bullmq): once queueing is added, this also needs idempotency —
// a redelivered job could send the same email twice. Look at BullMQ's
// built-in jobId dedup (deterministic jobId per purpose+user+token) before
// reaching for a hand-rolled DB flag like Payment uses.
const sendNotification = async ({ purpose, data, }) => {
    await (0, service_1.sendEmail)({ purpose, data });
};
exports.sendNotification = sendNotification;
var constant_1 = require("./constant");
Object.defineProperty(exports, "NOTIFICATION_PURPOSE", { enumerable: true, get: function () { return constant_1.NOTIFICATION_PURPOSE; } });
//# sourceMappingURL=index.js.map