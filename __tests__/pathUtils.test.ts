import * as path from "path";
import * as os from "os";
import * as pathUtils from "../src/utils/pathUtils";

jest.mock("@actions/core");
jest.mock("os");

test("expandPaths with no ~ in path", () => {
    const filePath = ".cache/yarn";

    const resolvedPath = pathUtils.expandPaths([filePath]);

    const expectedPath = [path.resolve(filePath)];
    expect(resolvedPath).toStrictEqual(expectedPath);
});

test("expandPaths with ~ in path", () => {
    const filePath = "~/.cache/yarn";

    const homedir = jest.requireActual("os").homedir();
    const homedirMock = jest.spyOn(os, "homedir");
    homedirMock.mockImplementation(() => {
        return homedir;
    });

    const resolvedPath = pathUtils.expandPaths([filePath]);

    const expectedPath = [path.join(homedir, ".cache/yarn")];
    expect(resolvedPath).toStrictEqual(expectedPath);
});

test("expandPaths with home not found", () => {
    const filePath = "~/.cache/yarn";
    const homedirMock = jest.spyOn(os, "homedir");
    homedirMock.mockImplementation(() => {
        return "";
    });

    expect(() => pathUtils.expandPaths([filePath])).toThrow(
        "Unable to resolve `~` to HOME"
    );
});
