module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '.*\\.e2e\\.spec\\.ts$',
    '.*\\.functional\\.spec\\.ts$'
  ],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/src/app/portal/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1'
  },
  globalSetup: 'jest-preset-angular/global-setup',
  reporters: ['default', '<rootDir>/jest/no-focused-tests-reporter.js']
}
