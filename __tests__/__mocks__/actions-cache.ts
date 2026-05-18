/**
 * Local CommonJS stub for the `@actions/cache` toolkit package.
 *
 * The published toolkit is an ESM-only package, which Jest's CJS resolver
 * cannot load directly. The action's runtime is bundled by `@vercel/ncc`
 * (which handles ESM deps), but Jest tests run uncompiled and therefore
 * need a CJS-compatible surface to import.
 *
 * This file re-implements just the public surface that the action's source
 * code imports, with no-op implementations. Tests use `jest.spyOn` or
 * `jest.mock("@actions/cache")` to override the implementations as needed.
 *
 * Wired up via `moduleNameMapper` in `jest.config.js`.
 *
 * Types are pulled from the real `@actions/cache` package via type-only
 * imports, so a TypeScript build (via `tsc --noEmit` or ts-jest) verifies
 * that the stub's runtime surface still satisfies the real package's
 * signatures — a signature drift (renamed parameter, added property,
 * changed return type) will surface here as a compile error rather than
 * as a silent test-only behavior change. `import type` is fully erased at
 * compile time, so the Jest `moduleNameMapper` redirect for this file is
 * not affected at runtime (no self-referential require loop).
 */

import type * as Cache from "@actions/cache";

// Re-export the toolkit's types so consumers of this stub and consumers of
// the real package see identical types — there is no second source of truth.
export type {
    CacheIntegrityErrorCode,
    DownloadOptions,
    PathValidationMode,
    PathValidationViolation,
    UploadOptions
} from "@actions/cache";

// Each `typeof Cache.X` annotation forces the local implementation to be
// assignable to the real package's exported signature.

export const ValidationError: typeof Cache.ValidationError = class extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ValidationError";
    }
};

export const ReserveCacheError: typeof Cache.ReserveCacheError = class extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ReserveCacheError";
    }
};

export const FinalizeCacheError: typeof Cache.FinalizeCacheError = class extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FinalizeCacheError";
    }
};

export const CacheIntegrityError: typeof Cache.CacheIntegrityError = class extends Error {
    readonly code: Cache.CacheIntegrityErrorCode;
    readonly violations?: Cache.PathValidationViolation[];
    constructor(
        code: Cache.CacheIntegrityErrorCode,
        message: string,
        violations?: Cache.PathValidationViolation[]
    ) {
        super(message);
        this.name = "CacheIntegrityError";
        this.code = code;
        this.violations = violations;
    }
};

export const isFeatureAvailable: typeof Cache.isFeatureAvailable = () => true;

function checkKey(key: string): void {
    if (key.length > 512) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot be larger than 512 characters.`
        );
    }
    const regex = /^[^,]*$/;
    if (!regex.test(key)) {
        throw new ValidationError(
            `Key Validation Error: ${key} cannot contain commas.`
        );
    }
}

export const restoreCache: typeof Cache.restoreCache = async (
    _paths,
    primaryKey,
    restoreKeys,
    _options,
    _enableCrossOsArchive
) => {
    const keys = [primaryKey, ...(restoreKeys ?? [])];
    if (keys.length > 10) {
        throw new ValidationError(
            `Key Validation Error: Keys are limited to a maximum of 10.`
        );
    }
    for (const key of keys) {
        checkKey(key);
    }
    return undefined;
};

export const saveCache: typeof Cache.saveCache = async (
    _paths,
    key,
    _options,
    _enableCrossOsArchive
) => {
    checkKey(key);
    return -1;
};
