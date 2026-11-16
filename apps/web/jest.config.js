// Unit tests for framework-free code (API client, auth helpers, formatters).
module.exports = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  coverageDirectory: '../../coverage/apps/web',
};
