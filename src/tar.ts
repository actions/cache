import { exec } from "@actions/exec";
import * as io from "@actions/io";
import { existsSync } from "fs";

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

async function execTar(args: string[]): Promise<void> {
    try {
        const tarPath = await getTarPath();
        const tarExec = process.platform !== "win32" ? `sudo ${tarPath}` : tarPath;
        await exec(`"${tarExec}"`, args);
    } catch (error) {
        const IS_WINDOWS = process.platform === "win32";
        if (IS_WINDOWS) {
            throw new Error(
                `Tar failed with error: ${error?.message}. Ensure BSD tar is installed and on the PATH.`
            );
        }
        throw new Error(`Tar failed with error: ${error?.message}`);
    }
}

export async function extractTar(
    archivePath: string,
    targetDirectory: string
): Promise<void> {
    // Create directory to extract tar into
    await io.mkdirP(targetDirectory);
    const args = ["-xz", "-f", archivePath, "-C", targetDirectory];
    await execTar(args);
}

export async function createTar(
    archivePath: string,
    sourceDirectory: string
): Promise<void> {
    const args = ["-cz", "-f", archivePath, "-C", sourceDirectory, "."];
    await execTar(args);
}
