import { getCacheVersion, retry } from "../src/cacheHttpClient";
import { CompressionMethod, Inputs } from "../src/constants";
import * as testUtils from "../src/utils/testUtils";

afterEach(() => {
    testUtils.clearInputs();
});

test("getCacheVersion with path input and compression method undefined returns version", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");

    const result = getCacheVersion();

    expect(result).toEqual(
        "b3e0c6cb5ecf32614eeb2997d905b9c297046d7cbf69062698f25b14b4cb0985"
    );
});

test("getCacheVersion with zstd compression returns version", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const result = getCacheVersion(CompressionMethod.Zstd);

    expect(result).toEqual(
        "273877e14fd65d270b87a198edbfa2db5a43de567c9a548d2a2505b408befe24"
    );
});

test("getCacheVersion with gzip compression does not change vesion", async () => {
    testUtils.setInput(Inputs.Path, "node_modules");
    const result = getCacheVersion(CompressionMethod.Gzip);

    expect(result).toEqual(
        "b3e0c6cb5ecf32614eeb2997d905b9c297046d7cbf69062698f25b14b4cb0985"
    );
});

test("getCacheVersion with no input throws", async () => {
    expect(() => getCacheVersion()).toThrow();
});

interface TestResponse {
    statusCode: number;
    result: string | null;
}

function handleResponse(
    response: TestResponse | undefined
): Promise<TestResponse> {
    if (!response) {
        fail("Retry method called too many times");
    }

    if (response.statusCode === 999) {
        throw Error("Test Error");
    } else {
        return Promise.resolve(response);
    }
}

async function testRetryExpectingResult(
    responses: Array<TestResponse>,
    expectedResult: string | null
): Promise<void> {
    responses = responses.reverse(); // Reverse responses since we pop from end

    const actualResult = await retry(
        "test",
        () => handleResponse(responses.pop()),
        (response: TestResponse) => response.statusCode
    );

    expect(actualResult.result).toEqual(expectedResult);
}

async function testRetryExpectingError(
    responses: Array<TestResponse>
): Promise<void> {
    responses = responses.reverse(); // Reverse responses since we pop from end

    expect(
        retry(
            "test",
            () => handleResponse(responses.pop()),
            (response: TestResponse) => response.statusCode
        )
    ).rejects.toBeInstanceOf(Error);
}

test("retry works on successful response", async () => {
    await testRetryExpectingResult(
        [
            {
                statusCode: 200,
                result: "Ok"
            }
        ],
        "Ok"
    );
});

test("retry works after retryable status code", async () => {
    await testRetryExpectingResult(
        [
            {
                statusCode: 503,
                result: null
            },
            {
                statusCode: 200,
                result: "Ok"
            }
        ],
        "Ok"
    );
});

test("retry fails after exhausting retries", async () => {
    await testRetryExpectingError([
        {
            statusCode: 503,
            result: null
        },
        {
            statusCode: 503,
            result: null
        },
        {
            statusCode: 200,
            result: "Ok"
        }
    ]);
});

test("retry fails after non-retryable status code", async () => {
    await testRetryExpectingError([
        {
            statusCode: 500,
            result: null
        },
        {
            statusCode: 200,
            result: "Ok"
        }
    ]);
});

test("retry works after error", async () => {
    await testRetryExpectingResult(
        [
            {
                statusCode: 999,
                result: null
            },
            {
                statusCode: 200,
                result: "Ok"
            }
        ],
        "Ok"
    );
});

test("retry returns after client error", async () => {
    await testRetryExpectingResult(
        [
            {
                statusCode: 400,
                result: null
            },
            {
                statusCode: 200,
                result: "Ok"
            }
        ],
        null
    );
});
