module.exports = {
  displayName: 'query-typeorm-bench',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  testMatch: ['**/benchmarks/**/*.bench.ts'],
  collectCoverage: false,
  testTimeout: 120000,
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx']
}
