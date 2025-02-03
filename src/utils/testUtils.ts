/* istanbul ignore file */

import { Inputs } from "../constants";
import { rest } from "msw";
import { setupServer } from "msw/node";
import nock from "nock";

export const successCacheKey = "Linux-node-bb828da54c148048dd17899ba9fda624811cfb43";
export const wrongRefCacheKey = "Linux-latest-node-bb828da54c148048dd17899ba9fda624811cfb43";
export const failureCacheKey = "Windows-node-bb828da54c148048dd17899ba9fda624811cfb43";
export const passThroughCacheKey = "macOS-node-bb828da54c148048dd17899ba9fda624811cfb43";
const successCacheId = 1337;
const failureCacheId = 69;

// See: https://github.com/actions/toolkit/blob/master/packages/core/src/core.ts#L67
function getInputName(name: string): string {
    return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}

export function setInput(name: string, value: string): void {
    process.env[getInputName(name)] = value;
}

interface CacheInput {
    path: string;
    key: string;
    restoreKeys?: string[];
    enableCrossOsArchive?: boolean;
    failOnCacheMiss?: boolean;
    lookupOnly?: boolean;
    refreshCache?: boolean;
}

export function setInputs(input: CacheInput): void {
    setInput(Inputs.Path, input.path);
    setInput(Inputs.Key, input.key);
    input.restoreKeys &&
        setInput(Inputs.RestoreKeys, input.restoreKeys.join("\n"));
    input.enableCrossOsArchive !== undefined &&
        setInput(
            Inputs.EnableCrossOsArchive,
            input.enableCrossOsArchive.toString()
        );
    input.failOnCacheMiss !== undefined &&
        setInput(Inputs.FailOnCacheMiss, input.failOnCacheMiss.toString());
    input.lookupOnly !== undefined &&
        setInput(Inputs.LookupOnly, input.lookupOnly.toString());
    input.refreshCache !== undefined &&
        setInput(Inputs.RefreshCache, input.refreshCache.toString());
}

export function clearInputs(): void {
    delete process.env[getInputName(Inputs.Path)];
    delete process.env[getInputName(Inputs.Key)];
    delete process.env[getInputName(Inputs.RestoreKeys)];
    delete process.env[getInputName(Inputs.UploadChunkSize)];
    delete process.env[getInputName(Inputs.EnableCrossOsArchive)];
    delete process.env[getInputName(Inputs.FailOnCacheMiss)];
    delete process.env[getInputName(Inputs.LookupOnly)];
    delete process.env[getInputName(Inputs.RefreshCache)];
}

export const mockServer = setupServer(
    rest.delete('https://api.github.com/repos/owner/repo/actions/caches/', (req, res, ctx) => {
        return res(ctx.status(422),
            ctx.json({
                message: "Invalid request.\n\nMissing required query parameter key",
                documentation_url: "https://docs.github.com/rest/actions/cache#delete-github-actions-caches-for-a-repository-using-a-cache-key",
            })
        )
    }),
    rest.delete('https://api.github.com/repos/owner/repo/actions/caches/:id', (req, res, ctx) => {
        const { id } = req.params;
        if (parseInt(id as string) === failureCacheId) {
            return res(ctx.status(404),
                ctx.json({
                    message: "Not Found",
                    documentation_url: "https://docs.github.com/rest/actions/cache#delete-a-github-actions-cache-for-a-repository-using-a-cache-id"
                }));
        }
        return res(ctx.status(204));
    }),
    // This endpoint always returns 200/OK, what we're checking here is whether we can get a unique cache ID, to avoid deleting the wrong entry.
    rest.get('https://api.github.com/repos/owner/repo/actions/caches', (req, res, ctx) => {
        let key : string = req.url?.searchParams?.get('key') || '';
        let ref : string = req.url?.searchParams?.get('ref') || '';
        if (key === '' || ref === '') {
            return res(ctx.status(200),
                ctx.json({
                    total_count: 2,
                    actions_caches: [{
                        id: 15,
                        ref: "refs/heads/main",
                        key: failureCacheKey,
                        version: "73885106f58cc52a7df9ec4d4a5622a5614813162cb516c759a30af6bf56e6f0",
                        last_accessed_at: "2022-12-29T22:06:42.683333300Z",
                        created_at: "2022-12-29T22:06:42.683333300Z",
                        size_in_bytes: 6057793
                    },
                    {
                        id: 16,
                        ref: "refs/heads/another-feature-branch",
                        key: failureCacheKey,
                        version: "73885106f58cc52a7df9ec4d4a5622a5614813162cb516c759a30af6bf56e6f0",
                        last_accessed_at: "2022-12-29T22:06:42.683333300Z",
                        created_at: "2022-12-29T22:06:42.683333300Z",
                        size_in_bytes: 6057793
                    }]
                })
            );
        }
        // This is the behavior seen when search doesn't find anything, but it is seen both when no key matches, as well as when the key matches but the entry belongs to another (likely the base) branch.
        else if (key === wrongRefCacheKey) {
            return res(ctx.status(200),
                ctx.json({
                    total_count: 0,
                    actions_caches: []
                })
            );
        }
        else if (key === successCacheKey || key === failureCacheKey) {
            return res(ctx.status(200),
                ctx.json({
                    total_count: 1,
                    actions_caches: [{
                        id: (key === successCacheKey ? successCacheId : failureCacheId),
                        ref: ref,
                        key: key,
                        version: "93a0f912fdb70083e929c1bf564bca2050be1c4e0932f7f9e78465ddcfbcc8f6",
                        last_accessed_at: "2022-12-29T22:06:42.683333300Z",
                        created_at: "2022-12-29T22:06:42.683333300Z",
                        size_in_bytes: 6057793
                    }]
                })
            );
        }
        return req.passthrough();
    })
);