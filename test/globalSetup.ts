import { MongoMemoryServer } from 'mongodb-memory-server';
import { RedisMemoryServer } from 'redis-memory-server';

/**
 * Runs once before the entire integration test run (not per file).
 * Boots a single MongoMemoryServer shared by every test file, stores the
 * instance on `global` so globalTeardown can stop it, and exposes the
 * connection string via process.env.MONGO_URI for test/setup.ts to use.
 */
module.exports = async function globalSetup() {
    const mongoServer = await MongoMemoryServer.create();

    (global as any).__MONGOINSTANCE = mongoServer;
    process.env.MONGO_URI = mongoServer.getUri();

    const redisServer = new RedisMemoryServer();
    const redisHost = await redisServer.getHost();
    const redisPort = await redisServer.getPort();
    (global as any).__REDISINSTANCE =redisServer;
    process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;
};