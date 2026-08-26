/**
 * Runs once after the entire integration test run finishes.
 * Stops the single MongoMemoryServer instance created in globalSetup.
 */
module.exports = async function globalTeardown() {
    const mongoServer = (global as any).__MONGOINSTANCE;
    if (mongoServer) {
        await mongoServer.stop();
    }

    const redisServer = (global as any).__REDISINSTANCE;
    if (redisServer) {
        await redisServer.stop();
    }
};