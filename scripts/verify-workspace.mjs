import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
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

function resolveInstalledPackageRoot(dependencyName, requiringPackageJsonPath) {
  const requireFromPackage = createRequire(requiringPackageJsonPath);
  let candidate = dirname(requireFromPackage.resolve(dependencyName));

  while (candidate !== dirname(candidate)) {
    const packageJsonPath = join(candidate, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (packageJson.name === dependencyName) {
        return candidate;
      }
    }
    candidate = dirname(candidate);
  }

  throw new Error(`Cannot resolve package root for runtime dependency: ${dependencyName}`);
}

function copyRuntimeDependency(dependencyName, requiringPackageJsonPath, targetNodeModules, copiedTargets) {
  const dependencyRoot = resolveInstalledPackageRoot(dependencyName, requiringPackageJsonPath);
  const targetRoot = join(targetNodeModules, dependencyName);

  if (copiedTargets.has(targetRoot)) {
    return;
  }
  copiedTargets.add(targetRoot);
  mkdirSync(dirname(targetRoot), { recursive: true });
  cpSync(dependencyRoot, targetRoot, { recursive: true, dereference: true });

  const dependencyPackageJsonPath = join(dependencyRoot, "package.json");
  const dependencyPackageJson = JSON.parse(readFileSync(dependencyPackageJsonPath, "utf8"));
  const transitiveDependencies = Object.keys(dependencyPackageJson.dependencies ?? {});
  if (transitiveDependencies.length === 0) {
    return;
  }

  const nestedNodeModules = join(targetRoot, "node_modules");
  mkdirSync(nestedNodeModules, { recursive: true });
  for (const transitiveDependency of transitiveDependencies) {
    copyRuntimeDependency(
      transitiveDependency,
      dependencyPackageJsonPath,
      nestedNodeModules,
      copiedTargets
    );
  }
}

function copyPublishedRuntimeDependencies(publishedRoot) {
  const cliPackageJsonPath = resolve(root, "apps/cli/package.json");
  const cliPackageJson = JSON.parse(readFileSync(cliPackageJsonPath, "utf8"));
  const runtimeDependencies = Object.keys(cliPackageJson.dependencies ?? {});
  const targetNodeModules = join(publishedRoot, "node_modules");
  const copiedTargets = new Set();

  mkdirSync(targetNodeModules, { recursive: true });

  for (const dependencyName of runtimeDependencies) {
    copyRuntimeDependency(dependencyName, cliPackageJsonPath, targetNodeModules, copiedTargets);
  }
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

  assertFile(
    resolve(root, ".github/workflows/publish-codex-marketplace-repo.yml"),
    /rsync -a --checksum --delete --exclude '\.git\/'/
  );
  assertFile(
    resolve(root, ".github/workflows/publish-qwen-extension-repo.yml"),
    /rsync -a --checksum --delete --exclude '\.git\/'/
  );

  run("node", [tscBin, "-p", "packages/toolkit/tsconfig.json"], "build toolkit");
  run("node", [tscBin, "-p", "packages/platform-core/tsconfig.json"], "build platform-core");
  run("node", [tscBin, "-p", "packages/platform-qwen/tsconfig.json"], "build platform-qwen");
  run("node", [tscBin, "-p", "packages/platform-codex/tsconfig.json"], "build platform-codex");
  run("node", [tscBin, "-p", "packages/platform-claude/tsconfig.json"], "build platform-claude");
  run("node", [tscBin, "-p", "packages/platform-opencode/tsconfig.json"], "build platform-opencode");
  run("pnpm", ["--dir", "apps/cli", "build"], "build apps/cli");

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
      "packages/platform-claude/dist/index.test.js",
      "packages/platform-opencode/dist/index.test.js"
    ],
    "test platform packages"
  );

  run("node", ["apps/cli/dist/cli/index.js", "toolkit", "validate"], "smoke toolkit validate");
  run("node", ["scripts/upstream-governance.mjs", "list"], "smoke upstream list");

  const smokeRoot = mkdtempSync(join(tmpdir(), "ai-coding-verify-"));
  const qoderCnPluginRoot = mkdtempSync(join(tmpdir(), "ai-coding-qoder-cn-plugin-"));
  const installRoot = mkdtempSync(join(tmpdir(), "ai-coding-install-"));
  const codexMarketplaceRoot = mkdtempSync(join(tmpdir(), "ai-coding-codex-marketplace-"));
  try {
    const qwenExtensionRoot = join(smokeRoot, ".qwen", "extensions", "zc-toolkit");
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "generate", "qwen", "--dir", smokeRoot],
      "smoke platform generate qwen"
    );
    assertFile(join(qwenExtensionRoot, "QWEN.md"), /skill:api-and-interface-design|skill:sdd-tdd-workflow/);
    assertFile(join(qwenExtensionRoot, "qwen-extension.json"), /"platform": "qwen"/);
    assertFile(join(qwenExtensionRoot, "commands", "zc", "start.md"), /zc:start/);
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "generate", "qoder-cn", "--dir", qoderCnPluginRoot],
      "smoke platform generate qoder-cn plugin bundle"
    );
    const qoderCnManifestPath = join(qoderCnPluginRoot, ".qoder-plugin", "plugin.json");
    assertFile(qoderCnManifestPath, /"displayName": "zc AI 编码工具包"/);
    assertFile(qoderCnManifestPath, /"commands": "\.\/commands"/);
    assertFile(join(qoderCnPluginRoot, "commands", "start.md"), /name: "start"/);
    assertFile(join(qoderCnPluginRoot, "skills", "sdd-tdd-workflow", "SKILL.md"));
    const qoderCnManifest = JSON.parse(readFileSync(qoderCnManifestPath, "utf8"));
    const cliPackage = JSON.parse(readFileSync(resolve(root, "apps/cli/package.json"), "utf8"));
    if (qoderCnManifest.version !== cliPackage.version) {
      throw new Error(`Qoder CN plugin version ${qoderCnManifest.version} does not match CLI version ${cliPackage.version}`);
    }
    run(
      "node",
      ["scripts/export-codex-marketplace-bundle.mjs", "--out", codexMarketplaceRoot],
      "smoke export codex marketplace bundle"
    );
    assertFile(join(codexMarketplaceRoot, ".gitattributes"), /assets\/zc-agents\/\*\* text eol=lf/);
    assertFile(join(codexMarketplaceRoot, ".agents", "plugins", "marketplace.json"), /"path": "\.\/plugins\/zc-toolkit"/);
    assertFile(join(codexMarketplaceRoot, "plugins", "zc-toolkit", ".codex-plugin", "plugin.json"), /"name": "zc-toolkit"/);
    assertFile(join(codexMarketplaceRoot, "plugins", "zc-toolkit", "skills", "start", "SKILL.md"), /zc:start/);
    if (existsSync(join(codexMarketplaceRoot, "plugins", "zc-toolkit", "commands"))) {
      throw new Error("Codex bundle must expose commands as skills without a duplicate legacy commands directory");
    }
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "install", "claude", "--dir", installRoot],
      "smoke platform install claude"
    );
    assertFile(join(installRoot, "CLAUDE.md"), /Claude Code 工作流入口/);
    assertFile(join(installRoot, ".zc", "platform-state", "claude.install-receipt.json"), /"platform": "claude"/);
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "status", "claude", "--dir", installRoot, "--json"],
      "smoke platform status claude"
    );
    run(
      "node",
      ["apps/cli/dist/cli/index.js", "platform", "update", "claude", "--dir", installRoot, "--plan", "--json"],
      "smoke platform update claude --plan"
    );

    const publishedRoot = mkdtempSync(join(tmpdir(), "ai-coding-zc-published-"));
    try {
      cpSync(resolve(root, "apps/cli/dist"), join(publishedRoot, "dist"), { recursive: true });
      cpSync(resolve(root, "apps/cli/vendor"), join(publishedRoot, "vendor"), { recursive: true });
      cpSync(resolve(root, "apps/cli/package.json"), join(publishedRoot, "package.json"));
      copyPublishedRuntimeDependencies(publishedRoot);

      run("node", [join(publishedRoot, "dist/cli/index.js"), "toolkit", "validate"], "smoke published zc toolkit validate");
      run(
        "node",
        [join(publishedRoot, "dist/cli/index.js"), "platform", "where", "opencode", "--global", "--json"],
        "smoke published zc platform where opencode --global"
      );
      run(
        "node",
        [join(publishedRoot, "dist/cli/index.js"), "platform", "install", "qoder-cn", "--global", "--plan", "--json"],
        "smoke published zc platform install qoder-cn --global --plan"
      );
    } finally {
      rmSync(publishedRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(smokeRoot, { recursive: true, force: true });
    rmSync(qoderCnPluginRoot, { recursive: true, force: true });
    rmSync(installRoot, { recursive: true, force: true });
    rmSync(codexMarketplaceRoot, { recursive: true, force: true });
  }

  console.log("\nWorkspace MVP verification passed.");
}

main();
