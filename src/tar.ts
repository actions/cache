import * as core from "@actions/core";
import { exec } from "@actions/exec";
import * as io from "@actions/io";
import { existsSync } from "fs";
import * as path from "path";
import * as tar from "./tar";

export async function isGnuTar(): Promise<boolean> {
    core.debug("Checking tar --version");
    let versionOutput = "";
    await exec("tar --version", [], {
        ignoreReturnCode: true,
        silent: true,
        listeners: {
            stdout: (data: Buffer): string =>
                (versionOutput += data.toString()),
            stderr: (data: Buffer): string => (versionOutput += data.toString())
        }
    });

    core.debug(versionOutput.trim());
    return versionOutput.toUpperCase().includes("GNU TAR");
}

async function getTarPath(args: string[]): Promise<string> {
    // Explicitly use BSD Tar on Windows
    const IS_WINDOWS = process.platform === "win32";
    if (IS_WINDOWS) {
        const systemTar = `${process.env["windir"]}\\System32\\tar.exe`;
        if (existsSync(systemTar)) {
            return systemTar;
        } else if (await tar.isGnuTar()) {
            args.push("--force-local");
        }
    }
    return await io.which("tar", true);
}

async function execTar(args: string[]): Promise<void> {
    try {
        await exec(`"${await getTarPath(args)}"`, args);
    } catch (error) {
        throw new Error(`Tar failed with error: ${error?.message}`);
    }
}

export async function extractTar(
    archivePath: string,
    targetDirectory: string
): Promise<void> {
    // Create directory to extract tar into
    await io.mkdirP(targetDirectory);
    const args = [
        "-xz",
        "-f",
        archivePath.replace(new RegExp("\\" + path.sep, "g"), "/"),
        "-C",
        targetDirectory.replace(new RegExp("\\" + path.sep, "g"), "/")
    ];
    await execTar(args);
}

export async function createTar(
    archivePath: string,
    sourceDirectory: string
): Promise<void> {
    const args = [
        "-cz",
        "-f",
        archivePath.replace(new RegExp("\\" + path.sep, "g"), "/"),
        "-C",
        sourceDirectory.replace(new RegExp("\\" + path.sep, "g"), "/"),
        "."
    ];
    await execTar(args);
}
