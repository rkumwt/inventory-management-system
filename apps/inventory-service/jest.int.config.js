// Integration tests: run against real infrastructure (pnpm docker:up).
module.exports = {
  displayName: 'inventory-service-int',
  preset: '../../jest.preset.js',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.int-spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  testTimeout: 30000,
};
