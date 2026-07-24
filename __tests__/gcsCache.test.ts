import * as cache from "@actions/cache";
import { Storage } from "@google-cloud/storage";

import * as actionUtils from "../src/utils/actionUtils";
import { restoreCache } from "../src/utils/gcsCache";

jest.mock("@actions/cache");
jest.mock("@google-cloud/storage");
jest.mock("../src/utils/actionUtils");
jest.mock("@actions/cache/lib/internal/cacheUtils", () => ({
    getCompressionMethod: jest.fn().mockResolvedValue("zstd"),
    getCacheFileName: jest.fn().mockReturnValue("cache.tzst"),
    createTempDirectory: jest.fn().mockResolvedValue("/tmp/gcs-cache-test"),
    getArchiveFileSizeInBytes: jest.fn().mockReturnValue(1024),
    unlinkFile: jest.fn().mockResolvedValue(undefined),
    resolvePaths: jest.fn().mockResolvedValue(["some/path"])
}));
jest.mock("@actions/cache/lib/internal/tar", () => ({
    createTar: jest.fn(),
    extractTar: jest.fn(),
    listTar: jest.fn()
}));

const BUCKET = "test-bucket";
const PREFIX = "github-cache";

interface FakeObject {
    name: string;
    updated: string;
}

function mockStorage(objects: FakeObject[]): void {
    const bucketApi = {
        file: (path: string) => ({
            exists: jest
                .fn()
                .mockResolvedValue([objects.some(o => o.name === path)]),
            download: jest.fn().mockResolvedValue(undefined)
        }),
        getFiles: jest.fn(({ prefix }: { prefix: string }) => [
            objects
                .filter(o => o.name.startsWith(prefix))
                .map(o => ({
                    name: o.name,
                    metadata: { updated: o.updated }
                }))
        ])
    };
    (Storage as unknown as jest.Mock).mockImplementation(() => ({
        bucket: () => bucketApi
    }));
}

beforeEach(() => {
    jest.mocked(actionUtils.isGCSAvailable).mockReturnValue(true);
    jest.mocked(actionUtils.getGCSBucket).mockReturnValue(BUCKET);
    jest.mocked(cache.restoreCache).mockResolvedValue(undefined);
});

afterEach(() => {
    jest.clearAllMocks();
});

test("primary key exact match returns primary key", async () => {
    mockStorage([
        {
            name: `${PREFIX}/nx-abc123.cache.tzst`,
            updated: "2026-07-01T00:00:00Z"
        }
    ]);

    const result = await restoreCache(["some/path"], "nx-abc123", ["nx-"], {
        lookupOnly: true
    });

    expect(result).toBe("nx-abc123");
});

test("restore key prefix-matches and returns newest entry's key", async () => {
    mockStorage([
        {
            name: `${PREFIX}/nx-older00.cache.tzst`,
            updated: "2026-07-01T00:00:00Z"
        },
        {
            name: `${PREFIX}/nx-newer00.cache.tzst`,
            updated: "2026-07-20T00:00:00Z"
        }
    ]);

    const result = await restoreCache(["some/path"], "nx-abc123", ["nx-"], {
        lookupOnly: true
    });

    expect(result).toBe("nx-newer00");
});

test("restore key ignores objects with other compression suffix", async () => {
    mockStorage([
        {
            name: `${PREFIX}/nx-gzipped0.cache.tgz`,
            updated: "2026-07-20T00:00:00Z"
        }
    ]);

    const result = await restoreCache(["some/path"], "nx-abc123", ["nx-"], {
        lookupOnly: true
    });

    expect(result).toBeUndefined();
    expect(cache.restoreCache).toHaveBeenCalled();
});

test("restore keys are tried in order", async () => {
    mockStorage([
        {
            name: `${PREFIX}/fallback-key.cache.tzst`,
            updated: "2026-07-01T00:00:00Z"
        },
        {
            name: `${PREFIX}/preferred-key.cache.tzst`,
            updated: "2026-06-01T00:00:00Z"
        }
    ]);

    const result = await restoreCache(
        ["some/path"],
        "nx-abc123",
        ["preferred-", "fallback-"],
        { lookupOnly: true }
    );

    expect(result).toBe("preferred-key");
});

test("no match falls back to GitHub cache", async () => {
    mockStorage([]);

    const result = await restoreCache(["some/path"], "nx-abc123", ["nx-"], {
        lookupOnly: true
    });

    expect(result).toBeUndefined();
    expect(cache.restoreCache).toHaveBeenCalledWith(
        ["some/path"],
        "nx-abc123",
        ["nx-"],
        { lookupOnly: true },
        undefined
    );
});

test("keys containing slashes resolve to the full matched key", async () => {
    mockStorage([
        {
            name: `${PREFIX}/develop/nx-abc.cache.tzst`,
            updated: "2026-07-01T00:00:00Z"
        }
    ]);

    const result = await restoreCache(["some/path"], "develop/nx-xyz", [
        "develop/"
    ]);

    expect(result).toBe("develop/nx-abc");
});
