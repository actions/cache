import * as io from "@actions/io";
import * as path from "path";
import { CacheFilename } from "./constants";
import { exec } from "@actions/exec";
import { existsSync, writeFileSync } from "fs";

async function getTarPath(): Promise<string> {
    // Explicitly use BSD Tar on Windows
    const IS_WINDOWS = process.platform === "win32";
    if (IS_WINDOWS) {
        const systemTar = `${process.env["windir"]}\\System32\\tar.exe`;
        if (existsSync(systemTar)) {
            return systemTar;
        }
    }
    return await io.which("tar", true);
}

async function execTar(args: string[], cwd?: string): Promise<void> {
    try {
        await exec(`"${await getTarPath()}"`, args, { cwd: cwd });
    } catch (error) {
        console.log("error", error);

        const IS_WINDOWS = process.platform === "win32";
        if (IS_WINDOWS) {
            throw new Error(
                `Tar failed with error: ${error?.message}. Ensure BSD tar is installed and on the PATH.`
            );
        }
        throw new Error(`Tar failed with error: ${error?.message}`);
    }
}

function getWorkingDirectory(): string {
    return process.env["GITHUB_WORKSPACE"] ?? process.cwd();
}

export async function extractTar(archivePath: string): Promise<void> {
    // Create directory to extract tar into
    const workingDirectory = getWorkingDirectory();
    await io.mkdirP(workingDirectory);
    const args = ["-xz", "-f", archivePath, "-P", "-C", workingDirectory];
    await execTar(args);
}

export async function createTar(
    archiveFolder: string,
    sourceDirectories: string[]
): Promise<void> {
    // TODO: will want to stream sourceDirectories into tar
    const manifestFilename = "manifest.txt";
    writeFileSync(
        path.join(archiveFolder, manifestFilename),
        sourceDirectories.join("\n")
    );

    const workingDirectory = getWorkingDirectory();
    const args = [
        "-cz",
        "-f",
        CacheFilename,
        "-C",
        workingDirectory,
        "--files-from",
        manifestFilename
    ];
    await execTar(args, archiveFolder);
}
