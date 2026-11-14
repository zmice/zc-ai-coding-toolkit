import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const sourceInputs = [
  "apps/cli/src", "apps/cli/scripts", "apps/cli/package.json", "apps/cli/tsconfig.json", "apps/cli/README.md",
  "packages/toolkit/src", "packages/toolkit/templates", "packages/toolkit/package.json", "packages/toolkit/tsconfig.json",
  ...["platform-core", "platform-qwen", "platform-codex", "platform-claude", "platform-opencode"].flatMap((name) => [
    `packages/${name}/src`, `packages/${name}/package.json`, `packages/${name}/tsconfig.json`,
    ...(name === "platform-core" ? [] : [`packages/${name}/templates`])
  ]),
  "references/upstreams.yaml", "package.json", "pnpm-lock.yaml",
  "scripts/release-tarball.mjs", "scripts/release-check.mjs", "scripts/release-check-lib.mjs", "scripts/publish-tested-tarball.mjs"
];

export const buildOutputs = [
  ...["toolkit", "platform-core", "platform-qwen", "platform-codex", "platform-claude", "platform-opencode"].map((name) => `packages/${name}/dist`),
  "apps/cli/dist", "apps/cli/vendor"
];

function digestPaths(root, inputs) {
  const hash = createHash("sha256");
  function visit(relative) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) return;
    const entries = readdirSync(absolute, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const child = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Release input contains a symlink: ${child}`);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) addFile(child);
    }
  }
  function addFile(relative) {
    const bytes = readFileSync(resolve(root, relative));
    hash.update(`${relative.replaceAll("\\", "/")}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  for (const relative of inputs) {
    const absolute = resolve(root, relative);
    if (!existsSync(absolute)) throw new Error(`Missing release source input: ${relative}`);
    if (lstatSync(absolute).isSymbolicLink()) throw new Error(`Release input is a symlink: ${relative}`);
    if (readdirSafe(absolute)) visit(relative);
    else addFile(relative);
  }
  return hash.digest("hex");
}

export function sourceDigest(root) { return digestPaths(root, sourceInputs); }
export function buildOutputDigest(root) { return digestPaths(root, buildOutputs); }

function readdirSafe(path) {
  try { readdirSync(path); return true; } catch (error) {
    if (error?.code === "ENOTDIR") return false;
    throw error;
  }
}

export function runNpm(root, args, { capture = false } = {}) {
  const cliRequire = createRequire(resolve(root, "apps/cli/package.json"));
  const crossSpawn = cliRequire("cross-spawn");
  const result = crossSpawn.sync("npm", args, { cwd: capture ? resolve(root, "apps/cli") : root, encoding: "utf8", stdio: capture ? "pipe" : "inherit", env: process.env });
  if (result.status !== 0) throw new Error(`npm ${args.join(" ")} failed: ${result.stderr ?? result.error ?? result.status}`);
  return result.stdout ?? "";
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr ?? result.error ?? result.status}`);
  return result.stdout.trim();
}

export function sourceSnapshot(root) {
  return { sourceSha256: sourceDigest(root), head: git(root, ["rev-parse", "HEAD"]) };
}

export function assertSnapshotStable(root, before) {
  const after = sourceSnapshot(root);
  if (after.sourceSha256 !== before.sourceSha256 || after.head !== before.head) {
    throw new Error("Release source or HEAD changed during pack/smoke; rebuild and rerun the release gate.");
  }
  return after;
}

export function assertPublishReady(root, receipt) {
  if (git(root, ["rev-parse", "HEAD"]) !== receipt.head) {
    throw new Error("HEAD changed after release verification; rerun release:check:post-version.");
  }
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=all", "--", ...sourceInputs]);
  if (dirty) throw new Error(`Release inputs have uncommitted changes; commit and rerun release:check:post-version.\n${dirty}`);
  const committed = JSON.parse(git(root, ["show", "HEAD:apps/cli/package.json"]));
  if (committed.name !== receipt.name || committed.version !== receipt.version) {
    throw new Error("Current HEAD does not contain the verified CLI version; commit version changes and rerun release:check:post-version.");
  }
  const tag = `${receipt.name}@${receipt.version}`;
  if (git(root, ["tag", "--list", tag])) throw new Error(`Release tag already exists: ${tag}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr ?? result.error ?? result.status}`);
  }
  return result.stdout ?? "";
}

function packageRoot(name, fromManifest) {
  const resolver = createRequire(fromManifest);
  let current = dirname(resolver.resolve(name));
  while (current !== dirname(current)) {
    const manifestPath = join(current, "package.json");
    if (existsSync(manifestPath) && JSON.parse(readFileSync(manifestPath, "utf8")).name === name) {
      return current;
    }
    current = dirname(current);
  }
  throw new Error(`Cannot resolve runtime dependency ${name} from ${fromManifest}`);
}

function copyDependencies(manifestPath, targetNodeModules, copied = new Set()) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    const source = packageRoot(name, manifestPath);
    const target = join(targetNodeModules, name);
    if (copied.has(target)) continue;
    copied.add(target);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true, dereference: true });
    copyDependencies(join(source, "package.json"), join(target, "node_modules"), copied);
  }
}

export function releaseReceiptPath(root) {
  return resolve(root, ".cache/release/zc-release-receipt.json");
}

export function buildReceiptPath(root) {
  return resolve(root, ".cache/release/zc-build-receipt.json");
}

export function recordBuildReceipt(root, before) {
  assertSnapshotStable(root, before);
  const receipt = { ...before, outputSha256: buildOutputDigest(root) };
  mkdirSync(dirname(buildReceiptPath(root)), { recursive: true });
  writeFileSync(buildReceiptPath(root), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

export function verifyBuildReceipt(root) {
  const receipt = JSON.parse(readFileSync(buildReceiptPath(root), "utf8"));
  const current = sourceSnapshot(root);
  if (receipt.sourceSha256 !== current.sourceSha256 || receipt.head !== current.head) {
    throw new Error("Build receipt does not match current source or HEAD; rebuild apps/cli before packing.");
  }
  if (receipt.outputSha256 !== buildOutputDigest(root)) {
    throw new Error("Build output changed after the recorded build; rebuild apps/cli before packing.");
  }
  return receipt;
}

export function verifyReleaseReceipt(root) {
  const receipt = JSON.parse(readFileSync(releaseReceiptPath(root), "utf8"));
  const manifest = JSON.parse(readFileSync(resolve(root, "apps/cli/package.json"), "utf8"));
  if (receipt.name !== manifest.name || receipt.version !== manifest.version) {
    throw new Error("Release receipt does not match the current CLI version; run release:check:post-version again.");
  }
  const tarball = resolve(root, receipt.tarball);
  if (receipt.sourceSha256 !== sourceDigest(root)) {
    throw new Error("Release source changed after verification; run release:check:post-version again.");
  }
  const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  if (sha256 !== receipt.sha256) {
    throw new Error("Release tarball changed after verification; run release:check:post-version again.");
  }
  return { ...receipt, tarball };
}

function smokeCodexLifecycle(cli, root) {
  const target = join(root, "codex-target");
  mkdirSync(target);
  const configPath = join(target, "config.toml");
  const userConfig = 'model = "user-selected-model"\n[agents.custom]\ndescription = "user role"\nconfig_file = "custom.toml"\n';
  const customPath = join(target, "custom.toml");
  writeFileSync(configPath, userConfig);
  writeFileSync(customPath, 'model = "user-custom-role"\n');
  const invoke = (args, expectedStatus = 0) => {
    const result = spawnSync(process.execPath, [cli, "platform", ...args, "--dir", target, "--json"], {
      cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, expectedStatus, `Codex tarball smoke ${args.join(" ")}: ${result.error ?? result.stderr}\n${result.stdout}`);
    return JSON.parse(result.stdout.trim() || result.stderr.trim());
  };
  invoke(["install", "codex"]);
  const roles = readdirSync(join(target, "agents")).filter(name => name.endsWith(".toml"));
  assert.ok(roles.length > 0, "Codex install must contain custom-agent TOMLs");
  for (const role of roles) {
    assert.doesNotMatch(readFileSync(join(target, "agents", role), "utf8"), /^\s*(model|model_reasoning_effort)\s*=/m, "generated roles must inherit model settings");
  }
  assert.ok(readFileSync(configPath, "utf8").includes(userConfig.trim()), "install must retain user configuration");
  invoke(["update", "codex"]);
  assert.ok(readFileSync(configPath, "utf8").includes(userConfig.trim()), "update must retain user configuration");
  // A user-edited role must block both update and uninstall without mutating other files.
  const rolePath = join(target, "agents", roles[0]);
  const originalRole = readFileSync(rolePath, "utf8");
  writeFileSync(rolePath, originalRole + '\nmodel = "user-edited-role"\n');
  const drifted = digestPaths(root, ["codex-target"]);
  invoke(["update", "codex"], 1);
  assert.equal(digestPaths(root, ["codex-target"]), drifted, "blocked update must not mutate the installation");
  invoke(["uninstall", "codex"], 1);
  assert.equal(digestPaths(root, ["codex-target"]), drifted, "blocked uninstall must not mutate the installation");
  writeFileSync(rolePath, originalRole);
  const removed = invoke(["uninstall", "codex"]);
  assert.equal(removed.receiptRemoved, true);
  assert.equal(existsSync(removed.receiptPath), false);
  for (const role of roles) assert.equal(existsSync(join(target, "agents", role)), false);
  assert.equal(readFileSync(configPath, "utf8").trim(), userConfig.trim());
  assert.equal(readFileSync(customPath, "utf8"), 'model = "user-custom-role"\n');

  // Exercise the filesystem marketplace path, including a drifted bundle, without Codex CLI.
  invoke(["plugin", "codex"]);
  const bundle = join(target, "plugins", "zc-toolkit");
  writeFileSync(join(bundle, "skills", "start", "SKILL.md"), "# user-edited fixture\n");
  const preserved = invoke(["plugin", "codex", "--uninstall"]);
  assert.ok(preserved.skipped.length > 0);
  assert.equal(existsSync(bundle), true);
  const forced = invoke(["plugin", "codex", "--uninstall", "--force"]);
  assert.deepEqual(forced.skipped, []);
  assert.equal(existsSync(bundle), false);
  assert.equal(readFileSync(configPath, "utf8").trim(), userConfig.trim());
  assert.equal(readFileSync(customPath, "utf8"), 'model = "user-custom-role"\n');
  return { status: "passed", roles: roles.length, scope: "isolated filesystem lifecycle; no Codex host or model calls" };
}

export function packAndSmoke(root, { record = false } = {}) {
  const build = verifyBuildReceipt(root);
  const before = sourceSnapshot(root);
  const cliRoot = resolve(root, "apps/cli");
  const outputRoot = resolve(root, ".cache/release");
  mkdirSync(outputRoot, { recursive: true });
  const packed = JSON.parse(runNpm(root, ["pack", "--ignore-scripts", "--offline", "--cache", resolve(root, ".cache/npm"), "--pack-destination", outputRoot, "--json"], { capture: true }));
  if (packed.length !== 1 || !packed[0].filename) throw new Error("npm pack did not return one tarball");
  const tarball = join(outputRoot, packed[0].filename);
  const listing = run("tar", ["-tf", tarball], { capture: true }).split(/\r?\n/).filter(Boolean);
  const testArtifacts = listing.filter((path) => path.includes("/dist/") && (/\.test\./.test(path) || path.includes("/__tests__/")));
  if (testArtifacts.length) throw new Error(`Release tarball includes test artifacts: ${testArtifacts.slice(0, 5).join(", ")}`);
  for (const required of ["package/dist/cli/index.js", "package/vendor/packages/toolkit/src/content"]) {
    if (!listing.some((path) => path === required || path.startsWith(`${required}/`))) {
      throw new Error(`Release tarball missing ${required}`);
    }
  }
  const smokeRoot = mkdtempSync(join(tmpdir(), "zc-release-tarball-"));
  let codexLifecycle;
  try {
    run("tar", ["-xzf", tarball, "-C", smokeRoot]);
    const installedRoot = join(smokeRoot, "package");
    copyDependencies(join(cliRoot, "package.json"), join(installedRoot, "node_modules"));
    const cli = join(installedRoot, "dist/cli/index.js");
    run(process.execPath, [cli, "toolkit", "validate"], { cwd: smokeRoot, capture: true });
    run(process.execPath, [cli, "platform", "where", "opencode", "--global", "--json"], { cwd: smokeRoot, capture: true });
    run(process.execPath, [cli, "platform", "install", "qoder-cn", "--global", "--plan", "--json"], { cwd: smokeRoot, capture: true });
    codexLifecycle = smokeCodexLifecycle(cli, smokeRoot);
  } finally {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
  const manifest = JSON.parse(readFileSync(resolve(cliRoot, "package.json"), "utf8"));
  assertSnapshotStable(root, before);
  if (build.outputSha256 !== buildOutputDigest(root)) {
    throw new Error("Build output changed during pack/smoke; rebuild and rerun the release gate.");
  }
  const receipt = { name: manifest.name, version: manifest.version, tarball: `.cache/release/${packed[0].filename}`, sha256: createHash("sha256").update(readFileSync(tarball)).digest("hex"), ...before, codexLifecycle };
  writeFileSync(`${tarball}.sha256`, `${receipt.sha256}  ${packed[0].filename}\n`);
  if (record) writeFileSync(releaseReceiptPath(root), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`Verified release tarball: ${receipt.tarball} (sha256 ${receipt.sha256})`);
  return receipt;
}
