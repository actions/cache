import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { promises as fs } from "fs";
import * as path from "path";

import { CacheFilename, ManifestFilename } from "../src/constants";
import * as tar from "../src/tar";

jest.mock("@actions/exec");
jest.mock("@actions/io");

function getTempDir(): string {
    return path.join(__dirname, "_temp", "tar");
}

beforeAll(async () => {
    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });

    process.env["GITHUB_WORKSPACE"] = process.cwd();
    await jest.requireActual("@actions/io").rmRF(getTempDir());
});

afterAll(async () => {
    delete process.env["GITHUB_WORKSPACE"];
    await jest.requireActual("@actions/io").rmRF(getTempDir());
});

test("extract tar", async () => {
    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");

    const archivePath = "cache.tar";
    const workingDirectory = process.env["GITHUB_WORKSPACE"];

    await tar.extractTar(archivePath);

    expect(mkdirMock).toHaveBeenCalledWith(workingDirectory);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "--use-compress-program",
            "zstd --long=31 -d",
            "-xf",
            archivePath,
            "-P",
            "-C",
            workingDirectory
        ],
        { cwd: undefined }
    );
});

test("create tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archiveFolder = getTempDir();
    const workingDirectory = process.env["GITHUB_WORKSPACE"];
    const sourceDirectories = ["~/.npm/cache", `${workingDirectory}/dist`];

    await fs.mkdir(archiveFolder, { recursive: true });

    await tar.createTar(archiveFolder, sourceDirectories);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "--use-compress-program",
            "zstd -T0 --long=31",
            "-cf",
            CacheFilename,
            "-C",
            workingDirectory,
            "--files-from",
            ManifestFilename
        ],
        { cwd: archiveFolder }
    );
});
