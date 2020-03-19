import * as exec from "@actions/exec";
import * as io from "@actions/io";
import { promises as fs } from "fs";
import * as path from "path";

import { CacheFilename } from "../src/constants";
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
    const workspace = process.env["GITHUB_WORKSPACE"];

    await tar.extractTar(archivePath);

    expect(mkdirMock).toHaveBeenCalledWith(workspace);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
        `"${tarPath}"`,
        ["-xz", "-f", archivePath, "-P", "-C", workspace],
        { cwd: undefined }
    );
});

test("create tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archiveFolder = getTempDir();
    const workspace = process.env["GITHUB_WORKSPACE"];
    const sourceDirectories = ["~/.npm/cache", `${workspace}/dist`];

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
            "-cz",
            "-f",
            CacheFilename,
            "-C",
            workspace,
            "--files-from",
            "manifest.txt"
        ],
        {
            cwd: archiveFolder
        }
    );
});
