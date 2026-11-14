import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanPackageDist } from "./safe-dist.mjs";

test("rebuild removes JS left behind after a source file is deleted", () => {
  const root = mkdtempSync(join(tmpdir(), "zc-build-output-"));
  try {
    const pkg = join(root, "packages", "toolkit");
    mkdirSync(join(pkg, "src"), { recursive: true });
    mkdirSync(join(pkg, "dist"), { recursive: true });
    const source = join(pkg, "src", "old.ts");
    const output = join(pkg, "dist", "old.js");
    writeFileSync(source, "export const old = true;");
    writeFileSync(output, "export const old = true;");
    rmSync(source);
    cleanPackageDist(root, "packages/toolkit");
    assert.equal(existsSync(output), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("build output redirection is rejected before deletion", (t) => {
  const root = mkdtempSync(join(tmpdir(), "zc-build-output-"));
  try {
    const pkg = join(root, "apps", "cli");
    const external = join(root, "external");
    mkdirSync(pkg, { recursive: true });
    mkdirSync(external);
    writeFileSync(join(external, "keep.js"), "keep");
    try {
      symlinkSync(external, join(pkg, "dist"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error.code !== "EPERM") throw error;
      t.diagnostic("sandbox forbids symlink creation; checking non-directory output guard");
      writeFileSync(join(pkg, "dist"), "redirected");
    }
    assert.throws(() => cleanPackageDist(root, "apps/cli"), /redirected|escapes/);
    assert.equal(existsSync(join(external, "keep.js")), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
