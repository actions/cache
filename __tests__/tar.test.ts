import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tar from "../src/tar";

import fs = require("fs");

jest.mock("@actions/exec");
jest.mock("@actions/io");

beforeAll(() => {
    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });
});

test("extract BSD tar", async () => {
    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");

    const IS_WINDOWS = process.platform === "win32";
    const archivePath = IS_WINDOWS
        ? `${process.env["windir"]}\\fakepath\\cache.tar`
        : "cache.tar";
    const targetDirectory = "~/.npm/cache";
    await tar.extractTar(archivePath, targetDirectory);

    expect(mkdirMock).toHaveBeenCalledWith(targetDirectory);

    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"${tarPath}"`, [
        "-xz",
        "-f",
        IS_WINDOWS ? archivePath.replace(/\\/g, "/") : archivePath,
        "-C",
        IS_WINDOWS ? targetDirectory?.replace(/\\/g, "/") : targetDirectory
    ]);
});

test("extract GNU tar", async () => {
    const IS_WINDOWS = process.platform === "win32";
    if (IS_WINDOWS) {
        jest.spyOn(fs, "existsSync").mockReturnValueOnce(false);
        jest.spyOn(tar, "isGnuTar").mockReturnValue(Promise.resolve(true));

        const execMock = jest.spyOn(exec, "exec");
        const archivePath = `${process.env["windir"]}\\fakepath\\cache.tar`;
        const targetDirectory = "~/.npm/cache";

        await tar.extractTar(archivePath, targetDirectory);

        expect(execMock).toHaveBeenCalledTimes(1);
        expect(execMock).toHaveBeenLastCalledWith(`"tar"`, [
            "-xz",
            "-f",
            archivePath.replace(/\\/g, "/"),
            "-C",
            targetDirectory?.replace(/\\/g, "/"),
            "--force-local"
        ]);
    }
});

test("create BSD tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archivePath = "cache.tar";
    const sourceDirectory = "~/.npm/cache";
    await tar.createTar(archivePath, sourceDirectory);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"${tarPath}"`, [
        "-cz",
        "-f",
        IS_WINDOWS ? archivePath.replace(/\\/g, "/") : archivePath,
        "-C",
        IS_WINDOWS ? sourceDirectory?.replace(/\\/g, "/") : sourceDirectory,
        "."
    ]);
});
