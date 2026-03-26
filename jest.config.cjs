/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Enforce deterministic suite order because later suites depend on persisted state.
  testMatch: [
    '**/__tests__/01-*.test.ts',
    '**/__tests__/02-*.test.ts',
    '**/__tests__/03-*.test.ts',
    '**/__tests__/04-*.test.ts',
    '**/__tests__/05-*.test.ts',
    '**/__tests__/06-*.test.ts',
  ],
  // Jest can discover tests in a non-deterministic order; later suites depend on earlier suites' persisted context.
  testSequencer: '<rootDir>/__tests__/testSequencer.cjs',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 120_000,
  maxWorkers: 1,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.jest.json',
      },
    ],
  },
}
