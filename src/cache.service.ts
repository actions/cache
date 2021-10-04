import * as utils from "@actions/cache/lib/internal/cacheUtils";
import {
    createTar,
    extractTar,
    listTar
} from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import { AWSError, S3 } from "aws-sdk";
import { GetObjectOutput, ListObjectsV2Output } from "aws-sdk/clients/s3";
import { PromiseResult } from "aws-sdk/lib/request";
import filesize from "filesize";
import fs from "fs";
import * as path from "path";

import { formatKey } from "./utils/actionUtils";

export class CacheService {
    private _client: S3;
    private _bucket: string;

    constructor(accessKeyId: string, secretAccessKey: string, bucket: string) {
        if (accessKeyId && secretAccessKey) {
            this._client = new S3({
                credentials: {
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey
                }
            });
        } else {
            this._client = new S3();
        }
        this._bucket = bucket;
    }

    async restoreCache(
        paths: string[],
        primaryKey: string,
        restoreKeys: string[]
    ): Promise<string | undefined> {
        restoreKeys = restoreKeys || [];
        const keys = [primaryKey, ...restoreKeys].map(x => formatKey(x));

        core.debug("Resolved Keys:");
        core.debug(JSON.stringify(keys));

        const compressionMethod = await utils.getCompressionMethod();

        // path are needed to compute version
        const cacheEntry = await this.getS3CacheKey(keys);
        if (!cacheEntry) {
            // Cache not found
            return undefined;
        }

        const archivePath = path.join(
            await utils.createTempDirectory(),
            cacheEntry
        );
        core.debug(`Archive Path: ${archivePath}`);

        try {
            // Download the cache from the cache entry
            await this.downloadFromS3(cacheEntry, archivePath);

            if (core.isDebug()) {
                await listTar(archivePath, compressionMethod);
            }

            core.info(
                `Cache Size: ~${filesize(fs.statSync(archivePath).size)}`
            );

            await extractTar(archivePath, compressionMethod);
            core.info("Cache restored successfully");
        } finally {
            // Try to delete the archive to save space
            try {
                await utils.unlinkFile(archivePath);
            } catch (error) {
                core.debug(`Failed to delete archive: ${error}`);
            }
        }

        return cacheEntry;
    }

    async saveCache(paths: string[], key: string): Promise<string> {
        const formattedKey: string = formatKey(key);
        const compressionMethod = await utils.getCompressionMethod();

        const cachePaths = await utils.resolvePaths(paths);
        core.debug("Cache Paths:");
        core.debug(`${JSON.stringify(cachePaths)}`);

        const archiveFolder = await utils.createTempDirectory();
        const archivePath = path.join(
            archiveFolder,
            utils.getCacheFileName(compressionMethod)
        );

        core.debug(`Archive Path: ${archivePath}`);

        try {
            await createTar(archiveFolder, cachePaths, compressionMethod);
            if (core.isDebug()) {
                await listTar(archivePath, compressionMethod);
            }

            core.info(
                `Archive Size: ${filesize(fs.statSync(archivePath).size)}`
            );

            core.debug(`Saving Cache (ID: ${formattedKey})`);
            await this.uploadToS3(formattedKey, archivePath);
        } finally {
            // Try to delete the archive to save space
            try {
                await utils.unlinkFile(archivePath);
            } catch (error) {
                core.debug(`Failed to delete archive: ${error}`);
            }
        }

        return formattedKey;
    }

    private async uploadToS3(
        key: string,
        archivePath: string
    ): Promise<PromiseResult<S3.PutObjectOutput, AWSError>> {
        const data = fs.readFileSync(archivePath);

        return this._client
            .putObject({
                Bucket: this._bucket,
                Key: path.join(this.getCacheFolder(), `${key}.tgz`),
                Body: data,
                ContentType: "text/plain",
                ContentEncoding: "gzip"
            })
            .promise();
    }

    private async downloadFromS3(key: string, savePath: string): Promise<void> {
        try {
            const response: GetObjectOutput = await this._client
                .getObject({
                    Bucket: this._bucket,
                    Key: path.join(this.getCacheFolder(), `${key}.tgz`)
                })
                .promise();
            fs.writeFileSync(savePath, response.Body);
        } catch (err) {
            core.warning("Could not download cache from S3");
            core.warning(err.message);
        }
    }

    private async getS3CacheKey(keys: string[]): Promise<string | undefined> {
        // return first matching key
        for (let i = 0; i < keys.length; i++) {
            if (i === 0) {
                // look for exact match
                try {
                    await this._client
                        .headObject({
                            Bucket: this._bucket,
                            Key: path.join(
                                this.getCacheFolder(),
                                `${keys[i]}.tgz`
                            )
                        })
                        .promise();
                    return keys[i];
                    // eslint-disable-next-line no-empty
                } catch {}
            } else {
                // look for match with newest added date that matches a prefix
                try {
                    const response: ListObjectsV2Output = await this._client
                        .listObjectsV2({
                            Bucket: this._bucket,
                            Prefix: path.join(this.getCacheFolder(), keys[i])
                        })
                        .promise();
                    let selected: S3.Object | undefined = undefined;
                    if (response.Contents) {
                        for (const object of response.Contents) {
                            if (selected === undefined) {
                                selected = object;
                            } else {
                                if (
                                    object.LastModified &&
                                    selected.LastModified
                                ) {
                                    if (
                                        object.LastModified >
                                        selected.LastModified
                                    ) {
                                        selected = object;
                                    }
                                }
                            }
                        }
                        if (selected && selected.Key) {
                            return path.parse(selected.Key).name;
                        }
                    }
                    core.debug(JSON.stringify(response));
                    // eslint-disable-next-line no-empty
                } catch {}
            }
        }
        return undefined;
    }

    private getCacheFolder(): string {
        return (process.env["GITHUB_REPOSITORY"] as string)
            .replace("/", "-")
            .toLowerCase();
    }
}
