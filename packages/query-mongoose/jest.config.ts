module.exports = {
  displayName: 'query-mongoose',
  preset: '../../jest.preset.js',
  globals: {},
  testEnvironment: 'node',
  // MongoMemoryServer init/download exceeds the preset 10s timeout under CI load.
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
  coverageDirectory: '../../coverage/packages/query-mongoose'
}
