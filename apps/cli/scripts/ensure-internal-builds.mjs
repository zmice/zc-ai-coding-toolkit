import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanPackageDist } from "./safe-dist.mjs";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(cliRoot, "..", "..");

const internalPackages = ["toolkit", "platform-core", "platform-qwen", "platform-codex", "platform-claude", "platform-opencode"];

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

export function ensureInternalBuilds() {
  const tscBin = resolveTscBin();

  for (const name of internalPackages) {
    cleanPackageDist(workspaceRoot, `packages/${name}`);
    run(process.execPath, [tscBin, "-p", `packages/${name}/tsconfig.json`], `build ${name}`);
  }
}

ensureInternalBuilds();
