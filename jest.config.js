require("nock").disableNetConnect();

module.exports = {
    clearMocks: true,
    moduleFileExtensions: ["js", "ts"],
    testEnvironment: "node",
    testMatch: ["**/*.test.ts"],
    testRunner: "jest-circus/runner",
    transform: {
        "^.+\\.ts$": "ts-jest"
    },
    verbose: true
};

const processStdoutWrite = process.stdout.write.bind(process.stdout);
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
process.stdout.write = (str, encoding, cb) => {
    // Core library will directly call process.stdout.write for commands
    // We don't want :: commands to be executed by the runner during tests
    if (!String(str).match(/^::/)) {
        return processStdoutWrite(str, encoding, cb);
    }
};
