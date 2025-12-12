// tests/setup.js
const { pool } = require('../src/config/database');

// Set test timeout
jest.setTimeout(10000);

// --- Global test database setup ---
beforeAll(async () => {
  console.log('Setting up test database...');
  // Add global test setup here if needed
});

// --- Safe pool shutdown wrapper to avoid mysql2 race ---
const IGNORED_POOL_END_ERROR = /Can't add new command when connection is in closed state/;

async function safePoolEnd(poolInstance) {
  if (!poolInstance) return;
  try {
    await poolInstance.end();
  } catch (err) {
    if (err && err.message && IGNORED_POOL_END_ERROR.test(err.message)) {
      console.warn('Warning: Ignored pool.end() race condition:', err.message);
    } else {
      throw err; // unexpected errors should still fail CI
    }
  }
}

// --- Global cleanup after all tests ---
afterAll(async () => {
  console.log('Cleaning up test database...');

  if (pool) {
    await safePoolEnd(pool);
  }

  // Allow pending microtasks to settle
  await new Promise(resolve => setTimeout(resolve, 500));
});

// --- Clean up after each test ---
afterEach(async () => {
  jest.clearAllTimers();
});

// --- Mock console to reduce output noise ---
global.console = {
  ...console,
  log: jest.fn(),      // suppress console.log
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,  // keep warnings
  error: console.error // keep errors
};

module.exports = { safePoolEnd };
