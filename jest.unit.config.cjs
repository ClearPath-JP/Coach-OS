/** @type {import('jest').Config} */
// Standalone UNIT lane for pure functions — no live dev server or DB (unlike the
// numbered integration suites driven by jest.config.cjs). Run: npm run test:unit
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.unit.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // `server-only` throws if imported outside a React Server bundle — stub it here.
    '^server-only$': '<rootDir>/__tests__/_stubs/server-only.cjs',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  testTimeout: 15000,
}
