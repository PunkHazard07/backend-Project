import IORedis, { type Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    throw new Error("Missing REDIS_URL in environment variables");
}

export const redisConnection: Redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

redisConnection.on('error', (error) => {
    console.error('Redis connection error:', error);
});

redisConnection.on('connect', () => {
    console.log('Redis connected');
});