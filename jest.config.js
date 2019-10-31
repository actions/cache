module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  verbose: true
}

const processStdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = (str, encoding, cb) => {
  // Core library will directly call process.stdout.write for commands
  // We don't want :: commands to be executed by the runner during tests
  if (!str.match(/^::/)) {
    return processStdoutWrite(str, encoding, cb);
  }
}