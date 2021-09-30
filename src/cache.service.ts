import * as utils from "@actions/cache/lib/internal/cacheUtils";
import { createTar, listTar } from "@actions/cache/lib/internal/tar";
import * as core from "@actions/core";
import { AWSError, S3 } from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import filesize from "filesize";
import fs from "fs";
import * as path from "path";

export class CacheService {
    private _client: S3;
    private _bucket: string;

    constructor(
        accessKeyId: string,
        secretAccessKey: string,
        region: string,
        bucket: string
    ) {
        this._client = new S3({
            region: region,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });
        this._bucket = bucket;
    }

    async restoreCache(
        paths: string[],
        primaryKey: string,
        restoreKeys: string[]
    ): Promise<string | undefined> {
        return "";
    }

    async saveCache(paths: string[], key: string): Promise<string> {
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

            core.debug(`Saving Cache (ID: ${key})`);
            await this.uploadToS3(key, archivePath);
        } finally {
            // Try to delete the archive to save space
            try {
                await utils.unlinkFile(archivePath);
            } catch (error) {
                core.debug(`Failed to delete archive: ${error}`);
            }
        }

        return key;
    }

    private async uploadToS3(
        key: string,
        archivePath: string
    ): Promise<PromiseResult<S3.PutObjectOutput, AWSError>> {
        const client = new S3();
        const data = fs.readFileSync(archivePath).toString("base64");

        return client
            .putObject({
                Bucket: this._bucket,
                Key: key,
                Body: data
            })
            .promise();
    }
}
