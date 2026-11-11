module.exports = {
  displayName: 'query-typegoose',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  // TypegooseModule.forRoot uses the mongoose default connection singleton.
  // Parallel MongoMemoryServer suites race and produce ECONNRESET in CI.
  maxWorkers: 1,
  testTimeout: 120000,
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json'
      }
    ]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/packages/query-typegoose'
}
