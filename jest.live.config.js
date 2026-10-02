/**
 * The live regression suite: real servers, real data, read-only.
 *
 *   npm run test:live         check the app against the live API
 *   npm run capture:fixtures  same, and refresh tests/fixtures/captured/
 *
 * Sign-in needs WAVEX_LIVE_EMAIL and WAVEX_LIVE_PASSWORD in `.env.local`.
 */
const { jest: base } = require('./package.json')

module.exports = {
  ...base,
  testEnvironment: '<rootDir>/tests/live/environment.js',
  testMatch: ['<rootDir>/tests/live/**/*.live.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.kilo/'],
  modulePathIgnorePatterns: ['<rootDir>/.kilo/'],
  setupFiles: ['<rootDir>/tests/live/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/live/after-env.ts'],
  testTimeout: 60_000,
  // One account, one session at a time.
  maxWorkers: 1,
}
