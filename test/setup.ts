import mongoose from 'mongoose';

/**
 * Connects Mongoose to the shared in-memory MongoDB instance booted once
 * in test/globalSetup.ts (via process.env.MONGO_URI).
 * Call this in `beforeAll` before running integration tests.
 */
export const connectTestDB = async (): Promise<void> => {
    await mongoose.connect(process.env.MONGO_URI as string);
};

/**
 * Clears all data from all collections in the test database.
 * Call this in `afterEach` to keep tests isolated from one another.
 */
export const clearTestDB = async (): Promise<void> => {
    const collections = mongoose.connection.collections;
    for(const key in collections) {
        await collections[key].deleteMany({});
    }
};

/**
 * Disconnects Mongoose from the shared in-memory MongoDB instance.
 * Call this in `afterAll` after tests complete to avoid open handles.
 * The server itself is stopped once, centrally, in test/globalTeardown.ts.
 */
export const closeTestDB = async (): Promise<void> => {
    await mongoose.disconnect();
};