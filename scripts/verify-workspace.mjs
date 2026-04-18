import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();

function resolveTscBin() {
  const candidates = [
    "node_modules/typescript/bin/tsc",
    "apps/cli/node_modules/typescript/bin/tsc",
    "packages/toolkit/node_modules/typescript/bin/tsc"
  ].map((relativePath) => resolve(root, relativePath));

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`TypeScript compiler not found. Tried:\n${candidates.join("\n")}`);
  }

  return match;
}

function resolveCommanderPackageRoot() {
  const candidates = [
    "node_modules/commander",
    "apps/cli/node_modules/commander"
  ].map((relativePath) => resolve(root, relativePath));

  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`Commander package not found. Tried:\n${candidates.join("\n")}`);
  }

  return match;
}

function run(command, args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

function assertFile(filePath, pattern) {
  if (!existsSync(filePath)) {
    throw new Error(`Expected file not found: ${filePath}`);
  }

  if (pattern) {
    const content = readFileSync(filePath, "utf8");
    if (!pattern.test(content)) {
      throw new Error(`Expected pattern ${pattern} not found in ${filePath}`);
    }
  }
}

function main() {
  const tscBin = resolveTscBin();
  const commanderRoot = resolveCommanderPackageRoot();

  run("node", [tscBin, "-p", "packages/toolkit/tsconfig.json"], "build toolkit");
  run("node", [tscBin, "-p", "packages/platform-core/tsconfig.json"], "build platform-core");
  run("node", [tscBin, "-p", "packages/platform-qwen/tsconfig.json"], "build platform-qwen");
  run("node", [tscBin, "-p", "packages/platform-codex/tsconfig.json"], "build platform-codex");
  run("node", [tscBin, "-p", "packages/platform-qoder/tsconfig.json"], "build platform-qoder");
  run("node", [tscBin, "-p", "apps/cli/tsconfig.json"], "build apps/cli");

  run(
    "node",
    ["--test", "packages/toolkit/dist/loaders.test.js", "packages/toolkit/dist/manifests.test.js"],
    "test toolkit"
  );
  run("node", ["--test", "packages/platform-core/dist/index.test.js"], "test platform-core");
  run(
    "node",
    [
      "--test",
      "packages/platform-qwen/dist/index.test.js",
      "packages/platform-codex/dist/index.test.js",
      "packages/platform-qoder/dist/index.test.js"
    ],
    "test platform packages"
  );

  run("node", ["apps/cli/dist/cli/index.js", "toolkit", "validate"], "smoke toolkit validate");
  run("node", ["scripts/upstream-governance.mjs", "list"], "smoke upstream list");

  const smokeRoot = mkdtempSync(join(tmpdir(), "ai-coding-verify-"));
  const installRoot = mkdtempSync(join(tmpdir(), "ai-coding-install-"));
  try {
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "generate", "qwen", "--dir", smokeRoot],
      "smoke platform generate qwen"
    );
    assertFile(join(smokeRoot, "QWEN.md"), /skill:api-and-interface-design|skill:sdd-tdd-workflow/);
    assertFile(join(smokeRoot, "qwen-extension.json"), /"platform": "qwen"/);
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "install", "codex", "--dir", installRoot],
      "smoke platform install codex"
    );
    assertFile(join(installRoot, "AGENTS.md"), /Codex 平台说明/);

    const publishedRoot = mkdtempSync(join(tmpdir(), "ai-coding-zc-published-"));
    try {
      cpSync(resolve(root, "apps/cli/dist"), join(publishedRoot, "dist"), { recursive: true });
      cpSync(resolve(root, "apps/cli/vendor"), join(publishedRoot, "vendor"), { recursive: true });
      cpSync(resolve(root, "apps/cli/package.json"), join(publishedRoot, "package.json"));
      cpSync(commanderRoot, join(publishedRoot, "node_modules", "commander"), { recursive: true });

      run("node", [join(publishedRoot, "dist/cli/index.js"), "toolkit", "validate"], "smoke published zc toolkit validate");
      run(
        "node",
        [join(publishedRoot, "dist/cli/index.js"), "platform", "where", "codex", "--global", "--json"],
        "smoke published zc platform where codex --global"
      );
    } finally {
      rmSync(publishedRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(smokeRoot, { recursive: true, force: true });
    rmSync(installRoot, { recursive: true, force: true });
  }

  console.log("\nWorkspace MVP verification passed.");
}

main();
