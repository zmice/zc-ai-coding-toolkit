import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(cliRoot, "..", "..");

const internalPackages = [
  { name: "toolkit", tsconfig: "packages/toolkit/tsconfig.json", dist: "packages/toolkit/dist/index.js" },
  { name: "platform-core", tsconfig: "packages/platform-core/tsconfig.json", dist: "packages/platform-core/dist/index.js" },
  { name: "platform-qwen", tsconfig: "packages/platform-qwen/tsconfig.json", dist: "packages/platform-qwen/dist/index.js" },
  { name: "platform-codex", tsconfig: "packages/platform-codex/tsconfig.json", dist: "packages/platform-codex/dist/index.js" },
  { name: "platform-claude", tsconfig: "packages/platform-claude/tsconfig.json", dist: "packages/platform-claude/dist/index.js" },
  { name: "platform-opencode", tsconfig: "packages/platform-opencode/tsconfig.json", dist: "packages/platform-opencode/dist/index.js" },
];

function resolveTscBin() {
  const candidates = [
    resolve(workspaceRoot, "node_modules/typescript/bin/tsc"),
    resolve(cliRoot, "node_modules/typescript/bin/tsc"),
    resolve(workspaceRoot, "packages/toolkit/node_modules/typescript/bin/tsc"),
  ];

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`TypeScript compiler not found. Tried:\n${candidates.join("\n")}`);
  }

  return match;
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

function needsBuild(relativeDistPath) {
  return !existsSync(resolve(workspaceRoot, relativeDistPath));
}

export function ensureInternalBuilds() {
  const tscBin = resolveTscBin();

  for (const pkg of internalPackages) {
    if (!needsBuild(pkg.dist)) {
      continue;
    }

    run("node", [tscBin, "-p", pkg.tsconfig], `build ${pkg.name}`);
  }
}

ensureInternalBuilds();
