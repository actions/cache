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
  // We don't want :: commands to be executed by the runner during tests
  // Replace any :: with :
  if (!str.match(/^::/)) {
    return processStdoutWrite(str, encoding, cb);
  } else {
    return processStdoutWrite(str.replace(/::/g, ":"), encoding, cb);
  }
}