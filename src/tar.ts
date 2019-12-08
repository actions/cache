import { exec } from "@actions/exec";
import * as io from "@actions/io";

export async function extractTar(archivePath: string, targetDirectory: string) {
    // Create directory to extract tar into
    await io.mkdirP(targetDirectory);

    // http://man7.org/linux/man-pages/man1/tar.1.html
    // tar [-options] <name of the tar archive> [files or directories which to add into archive]
    const args = ["-xz", "-f", archivePath, "-C", targetDirectory];
    await exec(`"${await getTarPath()}"`, args);
}

export async function createTar(archivePath: string, sourceDirectory: string) {
    // http://man7.org/linux/man-pages/man1/tar.1.html
    // tar [-options] <name of the tar archive> [files or directories which to add into archive]
    const args = ["-cz", "-f", archivePath, "-C", sourceDirectory, "."];
    await exec(`"${await getTarPath()}"`, args);
}

async function getTarPath(): Promise<string> {
    // Explicitly use BSD Tar on Windows
    const IS_WINDOWS = process.platform === "win32";
    return IS_WINDOWS
        ? `${process.env["windir"]}\\System32\\tar.exe`
        : await io.which("tar", true);
}
