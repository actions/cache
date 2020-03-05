import * as os from "os";
import * as path from "path";
import { readdirSync } from "fs";
import { IOptions, Minimatch } from "minimatch";

const globCharacters: string[] = ["*", "?", "[", "]"];
const options: IOptions = {
    nocase: true,
    dot: true,
    nobrace: true
};

// export function resolvePath(filePath: string): string {
//     if (filePath[0] === "~") {
//         const home = os.homedir();
//         if (!home) {
//             throw new Error("Unable to resolve `~` to HOME");
//         }
//         return path.join(home, filePath.slice(1));
//     }

//     return path.resolve(filePath);
// }

export function isMinimatchPattern(pattern: string): boolean {
    if (globCharacters.some(x => pattern.includes(x))) {
        return true;
    }

    return false;
}

export function matchDirectories(pattern: string, workspace: string): string[] {
    const directories = readdirSync(workspace, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const minimatch = new Minimatch(pattern, options);
    const matches = directories.filter(x => minimatch.match(x));

    return matches;
}

export function expandPaths(filePaths: string[]): string[] {
    const paths: string[] = [];
    const workspace = process.env["GITHUB_WORKSPACE"] ?? process.cwd();

    for (const filePath of filePaths) {
        if (isMinimatchPattern(filePath)) {
            paths.push(...matchDirectories(filePath, workspace));
        } else if (filePath[0] === "~") {
            const home = os.homedir();
            if (!home) {
                throw new Error("Unable to resolve `~` to HOME");
            }
            paths.push(path.join(home, filePath.slice(1)));
        } else {
            paths.push(path.resolve(filePath));
        }
    }

    return paths;
}
