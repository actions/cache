import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tar from "../src/tar";

jest.mock("@actions/exec");
jest.mock("@actions/io");

beforeAll(() => {
    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });
});

test("extract tar", async () => {
    const mkdirMock = jest.spyOn(io, "mkdirP");
    const execMock = jest.spyOn(exec, "exec");

    const archivePath = "cache.tar";
    const targetDirectory = "~/.npm/cache";
    await tar.extractTar(archivePath, targetDirectory);

    expect(mkdirMock).toHaveBeenCalledWith(targetDirectory);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    let tarParams = ["-xz", "-f", archivePath, "-C", targetDirectory];
    let tarExec = `${tarPath}`;
    if (!IS_WINDOWS) {
        tarExec = "sudo";
        tarParams = [`${tarPath}`, ...tarParams];
    }

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"${tarExec}"`, tarParams);
});

test("create tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archivePath = "cache.tar";
    const sourceDirectory = "~/.npm/cache";
    await tar.createTar(archivePath, sourceDirectory);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    let tarParams = ["-cz", "-f", archivePath, "-C", sourceDirectory, "."];
    let tarExec = `${tarPath}`;
    if (!IS_WINDOWS) {
        tarExec = "sudo";
        tarParams = [`${tarPath}`, ...tarParams];
    }

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"${tarExec}"`, tarParams);
});
