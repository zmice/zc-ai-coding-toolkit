import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPublishReady, assertSnapshotStable, buildOutputs, recordBuildReceipt, releaseReceiptPath, sourceSnapshot, sourceInputs, verifyBuildReceipt, verifyReleaseReceipt } from "./release-tarball.mjs";

function git(root, ...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

test("release receipt accepts only the tested version and tarball bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "zc-release-receipt-"));
  try {
  mkdirSync(join(root, "apps", "cli"), { recursive: true });
  mkdirSync(join(root, ".cache", "release"), { recursive: true });
  for (const relative of sourceInputs) {
    const target = join(root, relative);
    if (relative.endsWith("/src") || relative.endsWith("/templates")) {
      mkdirSync(target, { recursive: true });
    } else {
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, "fixture");
    }
  }
  const bytes = Buffer.from("test-tarball");
  writeFileSync(join(root, "apps", "cli", "package.json"), JSON.stringify({ name: "@zmice/zc", version: "1.0.0" }));
  git(root, "init");
  git(root, "config", "user.name", "Release Test");
  git(root, "config", "user.email", "release-test@example.com");
  git(root, "add", ".");
  git(root, "commit", "-m", "version");
  const before = sourceSnapshot(root);
  for (const relative of buildOutputs) {
    mkdirSync(join(root, relative), { recursive: true });
    writeFileSync(join(root, relative, "index.js"), "built");
  }
  assert.throws(() => verifyBuildReceipt(root), /ENOENT/);
  recordBuildReceipt(root, before);
  assert.doesNotThrow(() => verifyBuildReceipt(root));
  writeFileSync(join(root, ".cache", "release", "zc.tgz"), bytes);
  writeFileSync(releaseReceiptPath(root), JSON.stringify({ name: "@zmice/zc", version: "1.0.0", tarball: ".cache/release/zc.tgz", sha256: createHash("sha256").update(bytes).digest("hex"), ...before }));
  const receipt = verifyReleaseReceipt(root);
  assert.equal(receipt.version, "1.0.0");
  assert.doesNotThrow(() => assertPublishReady(root, receipt));
  writeFileSync(join(root, ".cache", "release", "zc.tgz"), "changed");
  assert.throws(() => verifyReleaseReceipt(root), /changed after verification/);
  writeFileSync(join(root, "apps", "cli", "README.md"), "changed source");
  assert.throws(() => verifyReleaseReceipt(root), /source changed after verification/);
  assert.throws(() => assertSnapshotStable(root, before), /changed during pack\/smoke/);
  assert.throws(() => recordBuildReceipt(root, before), /changed during pack\/smoke/);
  assert.throws(() => assertPublishReady(root, receipt), /uncommitted changes/);
  assert.throws(() => verifyBuildReceipt(root), /current source or HEAD/);
  writeFileSync(join(root, "apps", "cli", "README.md"), "fixture");
  writeFileSync(join(root, "apps", "cli", "dist", "index.js"), "changed output");
  assert.throws(() => verifyBuildReceipt(root), /Build output changed/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
