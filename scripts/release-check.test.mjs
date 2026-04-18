import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  classifyDirtyPaths,
  findUnexpectedDirtyPaths,
  loadPublishablePackages,
  parseGitStatus
} from "./release-check-lib.mjs";

const fixturePackages = [
  ["apps/cli/package.json", { name: "@zmice/zc", version: "0.1.2" }],
  ["packages/toolkit/package.json", { name: "@zmice/toolkit", version: "0.1.0" }],
  ["packages/platform-core/package.json", { name: "@zmice/platform-core", version: "0.1.0" }],
  ["packages/platform-qwen/package.json", { name: "@zmice/platform-qwen", version: "0.1.0" }],
  ["packages/platform-codex/package.json", { name: "@zmice/platform-codex", version: "0.1.0" }],
  ["packages/platform-qoder/package.json", { name: "@zmice/platform-qoder", version: "0.1.0" }]
];

function writeFixtureFile(root, relativePath, content) {
  mkdirSync(join(root, relativePath, ".."), { recursive: true });
  writeFileSync(join(root, relativePath), content);
}

function makeFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), "ai-coding-release-check-"));

  for (const [relativePath, manifest] of fixturePackages) {
    writeFixtureFile(root, relativePath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  writeFixtureFile(root, ".changeset/demo.md", "---\n'@zmice/zc': minor\n---\n\nrelease intent\n");
  spawnSync("git", ["init"], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["config", "user.name", "Release Check Test"], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["config", "user.email", "release-check@example.com"], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
  spawnSync("git", ["commit", "-m", "init"], { cwd: root, stdio: "ignore" });

  return root;
}

test("parseGitStatus extracts paths from porcelain output", () => {
  const paths = parseGitStatus(" M docs/release-guide.md\nR  old.md -> new.md\n?? .changeset/demo.md\n");
  assert.deepEqual(paths, ["docs/release-guide.md", "new.md", ".changeset/demo.md"]);
});

test("findUnexpectedDirtyPaths honors mode-specific allow lists", () => {
  assert.deepEqual(
    findUnexpectedDirtyPaths([".changeset/demo.md"], "pre-version"),
    []
  );
  assert.deepEqual(
    findUnexpectedDirtyPaths(["docs/release-guide.md"], "pre-version"),
    ["docs/release-guide.md"]
  );
  assert.deepEqual(
    findUnexpectedDirtyPaths(["apps/cli/package.json", "pnpm-lock.yaml"], "post-version"),
    []
  );
  assert.deepEqual(
    findUnexpectedDirtyPaths(["packages/platform-core/package.json"], "post-version"),
    []
  );
  assert.deepEqual(
    findUnexpectedDirtyPaths(["package.json"], "post-version"),
    ["package.json"]
  );
  assert.deepEqual(
    findUnexpectedDirtyPaths(["packages/internal-only/package.json"], "post-version"),
    ["packages/internal-only/package.json"]
  );
});

test("classifyDirtyPaths groups allowed and unexpected entries", () => {
  assert.deepEqual(
    classifyDirtyPaths(
      ["packages/platform-core/package.json", "packages/internal-only/package.json", "pnpm-lock.yaml"],
      "post-version"
    ),
    {
      allowedPaths: ["packages/platform-core/package.json", "pnpm-lock.yaml"],
      unexpectedPaths: ["packages/internal-only/package.json"]
    }
  );
});

test("loadPublishablePackages reads the release matrix from manifests", () => {
  const root = makeFixtureRepo();
  const packages = loadPublishablePackages(root);
  assert.equal(packages.length, 6);
  assert.equal(packages[0].name, "@zmice/zc");
  assert.equal(packages[5].manifestPath, "packages/platform-qoder/package.json");
  assert.equal(packages[2].name, "@zmice/platform-core");
});

test("release-check pre-version accepts changeset-only dirtiness", () => {
  const root = makeFixtureRepo();
  writeFixtureFile(root, ".changeset/demo.md", "---\n'@zmice/zc': patch\n---\n\nupdated intent\n");

  const result = spawnSync(
    "node",
    [resolve("scripts/release-check.mjs"), "pre-version", "--root", root, "--skip-commands"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 0, readFileSync(resolve("scripts/release-check.mjs"), "utf8"));
});

test("release-check pre-version blocks non-changeset dirty paths", () => {
  const root = makeFixtureRepo();
  writeFixtureFile(root, "docs/release-guide.md", "# dirty\n");

  const result = spawnSync(
    "node",
    [resolve("scripts/release-check.mjs"), "pre-version", "--root", root, "--skip-commands"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /未预期的脏文件 \(Unexpected dirty paths\):/);
  assert.match(result.stderr, /docs\/release-guide\.md/);
});

test("release-check post-version accepts versioned manifests and lockfile", () => {
  const root = makeFixtureRepo();
  writeFixtureFile(root, "apps/cli/package.json", `${JSON.stringify({ name: "@zmice/zc", version: "0.2.0" }, null, 2)}\n`);
  writeFixtureFile(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");

  const result = spawnSync(
    "node",
    [resolve("scripts/release-check.mjs"), "post-version", "--root", root, "--skip-commands"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.equal(result.status, 0);
});

test("release-check post-version blocks non-publishable manifests", () => {
  const root = makeFixtureRepo();
  writeFixtureFile(root, "packages/platform-core/package.json", `${JSON.stringify({ name: "@zmice/platform-core", version: "0.2.0" }, null, 2)}\n`);
  writeFixtureFile(root, "packages/internal-only/package.json", `${JSON.stringify({ name: "@zmice/internal-only", version: "0.1.0" }, null, 2)}\n`);

  const result = spawnSync(
    "node",
    [resolve("scripts/release-check.mjs"), "post-version", "--root", root, "--skip-commands"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /允许的脏文件 \(Allowed dirty paths\):/);
  assert.match(result.stderr, /packages\/platform-core\/package\.json/);
  assert.match(result.stderr, /未预期的脏文件 \(Unexpected dirty paths\):/);
  assert.match(result.stderr, /packages\/internal-only\/package\.json/);
});
