import { spawnSync } from "node:child_process";

const task = process.argv[2];

if (!task) {
  throw new Error("Usage: node scripts/run-workspace-task.mjs <task>");
}

const workspacePackages = [
  "packages/toolkit",
  "packages/platform-core",
  "packages/platform-qwen",
  "packages/platform-codex",
  "packages/platform-claude",
  "packages/platform-opencode",
  "apps/cli"
];

function run(command, args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

for (const pkg of workspacePackages) {
  run("pnpm", ["--dir", pkg, task], `${pkg}#${task}`);
}
