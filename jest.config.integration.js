const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    transform: {
        ...tsJestTransformCfg,
},
    testMatch: ["**/test/integration/**/*.test.ts"],

    // Boots ONE MongoMemoryServer for the whole run and stops it at the end,
    // instead of a fresh instance per test file (see test/globalSetup.ts).
    globalSetup: "<rootDir>/test/globalSetup.ts",
    globalTeardown: "<rootDir>/test/globalTeardown.ts",

    // Loads .env.test before each test file's environment is set up.
    setupFiles: ["<rootDir>/test/env.setup.ts"],

    // Gives MongoDB Memory Server enough time to boot up
    testTimeout: 60000,

    // Prevents lingering Mongoose/network connections from hanging Jest
    forceExit: true,

    clearMocks: true,
};