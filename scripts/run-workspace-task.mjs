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

if (task === "build" || task === "generate") {
  run("pnpm", ["--dir", "apps/cli", "build"], "apps/cli#build (includes internal packages)");
} else if (task === "test" || task === "verify") {
  run("pnpm", ["--dir", "apps/cli", "build"], "apps/cli#build (includes internal packages)");
  process.env.ZC_WORKSPACE_BUILT = "1";
  if (task === "verify") {
    for (const pkg of workspacePackages) {
      run("pnpm", ["--dir", pkg, "lint"], `${pkg}#lint`);
    }
  }
  for (const pkg of workspacePackages) {
    run("pnpm", ["--dir", pkg, "test:built"], `${pkg}#test:built`);
  }
  run(process.execPath, ["scripts/skill-evals.mjs", "validate"], "skill-evals#validate");
  run(process.execPath, ["--test", "apps/cli/scripts/safe-dist.test.mjs", "tests/skill-evals/runner.test.mjs", "tests/skill-evals/codex-capture.test.mjs", "tests/skill-evals/review-coverage-cases.test.mjs", "scripts/content-budget-audit.test.mjs", "scripts/release-check.test.mjs", "scripts/release-tarball.test.mjs", "tests/skill-distribution/audit.test.mjs", "tests/skill-distribution/discovery.test.mjs"], "evaluation-catalog-and-distribution#test");
  run(process.execPath, ["--test", "tests/visual-refinement/*.test.mjs"], "visual-refinement#test");
  if (task === "verify") {
    run(process.execPath, ["scripts/verify-workspace.mjs", "--built"], "workspace#mvp-smoke");
  }
} else {
  for (const pkg of workspacePackages) {
    run("pnpm", ["--dir", pkg, task], `${pkg}#${task}`);
  }
}
