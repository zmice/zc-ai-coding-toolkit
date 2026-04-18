import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const publishablePackagePaths = [
  "apps/cli/package.json",
  "packages/toolkit/package.json",
  "packages/platform-core/package.json",
  "packages/platform-qwen/package.json",
  "packages/platform-codex/package.json",
  "packages/platform-qoder/package.json"
];

const preVersionAllowedPatterns = [/^\.changeset\/[^/]+\.md$/];
const postVersionAllowedPatterns = [
  /^pnpm-lock\.yaml$/,
  /^apps\/cli\/package\.json$/,
  /^packages\/[^/]+\/package\.json$/
];

export function parseCliArgs(argv) {
  const [mode, ...rest] = argv;
  if (!mode || !["pre-version", "post-version"].includes(mode)) {
    throw new Error(
      "Usage: node scripts/release-check.mjs <pre-version|post-version> [--root <dir>] [--skip-commands]"
    );
  }

  let root = process.cwd();
  let skipCommands = false;

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--root") {
      root = resolve(rest[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--skip-commands") {
      skipCommands = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { mode, root, skipCommands };
}

export function parseGitStatus(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const payload = line.slice(3);
      const renamed = payload.includes(" -> ") ? payload.split(" -> ").at(-1) : payload;
      return renamed;
    });
}

export function findUnexpectedDirtyPaths(paths, mode) {
  const patterns = mode === "pre-version" ? preVersionAllowedPatterns : postVersionAllowedPatterns;

  return paths.filter((path) => !patterns.some((pattern) => pattern.test(path)));
}

export function loadPublishablePackages(root) {
  return publishablePackagePaths.map((relativePath) => {
    const manifest = JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
    return {
      manifestPath: relativePath,
      name: manifest.name,
      version: manifest.version
    };
  });
}
