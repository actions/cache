import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as path from "path";

import { CacheFilename } from "../src/constants";
import * as tar from "../src/tar";

import fs = require("fs");

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

test("extract BSD tar", async () => {
    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");

    const IS_WINDOWS = process.platform === "win32";
    const archivePath = IS_WINDOWS
        ? `${process.env["windir"]}\\fakepath\\cache.tar`
        : "cache.tar";
    const workspace = process.env["GITHUB_WORKSPACE"];

    await tar.extractTar(archivePath);

    expect(mkdirMock).toHaveBeenCalledWith(workspace);

    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "-xz",
            "-f",
            IS_WINDOWS ? archivePath.replace(/\\/g, "/") : archivePath,
            "-P",
            "-C",
            IS_WINDOWS ? workspace?.replace(/\\/g, "/") : workspace
        ],
        { cwd: undefined }
    );
});

test("extract GNU tar", async () => {
    const IS_WINDOWS = process.platform === "win32";
    if (IS_WINDOWS) {
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        jest.spyOn(tar, "isGnuTar").mockReturnValue(Promise.resolve(true));

        const execMock = jest.spyOn(exec, "exec");
        const archivePath = `${process.env["windir"]}\\fakepath\\cache.tar`;
        const workspace = process.env["GITHUB_WORKSPACE"];

        await tar.extractTar(archivePath);

        expect(execMock).toHaveBeenCalledTimes(2);
        expect(execMock).toHaveBeenLastCalledWith(
            `"tar"`,
            [
                "-xz",
                "-f",
                archivePath.replace(/\\/g, "/"),
                "-P",
                "-C",
                workspace?.replace(/\\/g, "/"),
                "--force-local"
            ],
            { cwd: undefined }
        );
    }
});

test("create BSD tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archiveFolder = getTempDir();
    const workspace = process.env["GITHUB_WORKSPACE"];
    const sourceDirectories = ["~/.npm/cache", `${workspace}/dist`];

    await fs.promises.mkdir(archiveFolder, { recursive: true });

    await tar.createTar(archiveFolder, sourceDirectories);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        [
            "-cz",
            "-f",
            IS_WINDOWS ? CacheFilename.replace(/\\/g, "/") : CacheFilename,
            "-P",
            "-C",
            IS_WINDOWS ? workspace?.replace(/\\/g, "/") : workspace,
            "--files-from",
            "manifest.txt"
        ],
        {
            cwd: archiveFolder
        }
    );
});
