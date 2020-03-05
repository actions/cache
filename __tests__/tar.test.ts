import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as tar from "../src/tar";

jest.mock("@actions/exec");
jest.mock("@actions/io");

beforeAll(() => {
    jest.spyOn(io, "which").mockImplementation(tool => {
        return Promise.resolve(tool);
    });

    process.env["GITHUB_WORKSPACE"] = process.cwd();
});

afterAll(() => {
    delete process.env["GITHUB_WORKSPACE"];
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
    expect(execMock).toHaveBeenCalledWith(`"${tarPath}"`, [
        "-xz",
        "-f",
        archivePath,
        "-P",
        "-C",
        workspace
    ]);
});

test("create tar", async () => {
    const execMock = jest.spyOn(exec, "exec");

    const archivePath = "cache.tar";
    const workspace = process.env["GITHUB_WORKSPACE"];
    const sourceDirectories = ["~/.npm/cache", `${workspace}/dist`];

    await tar.createTar(archivePath, sourceDirectories);

    const IS_WINDOWS = process.platform === "win32";
    const tarPath = IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : "tar";
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(`"${tarPath}"`, [
        "-cz",
        "-f",
        archivePath,
        "-C",
        workspace,
        sourceDirectories.join(" ")
    ]);
});
