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
    // The @actions/cache toolkit (v6+) is ESM-only and cannot be loaded by
    // Jest's CommonJS resolver. For unit tests we redirect imports to a
    // local CJS-compatible stub that exposes the same surface; production
    // builds (tsc + ncc) use the real ESM package directly.
    moduleNameMapper: {
        "^@actions/cache$": "<rootDir>/__tests__/__mocks__/actions-cache.ts"
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
