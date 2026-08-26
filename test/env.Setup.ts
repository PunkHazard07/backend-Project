import dotenv from 'dotenv';
import path from 'path';

// Runs before each test file's environment is set up (Jest `setupFiles`),
// so JWT_SECRET etc. are populated before app.ts / controllers get imported.
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });