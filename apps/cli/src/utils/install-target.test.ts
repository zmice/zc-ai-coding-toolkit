import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { normalizeInstallSelector, resolveInstallTarget } from "./install-target.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-coding-install-target-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("resolveInstallTarget", () => {
  it("normalizes new target flags into a global selector", () => {
    const result = normalizeInstallSelector({ global: true });

    assert.equal(result.mode, "global");
    assert.equal(result.dir, undefined);
  });

  it("normalizes --dir and legacy --out to the same explicit directory", () => {
    const result = normalizeInstallSelector({ dir: "/tmp/custom", out: "/tmp/custom" });

    assert.equal(result.mode, "project");
    assert.equal(result.dir, "/tmp/custom");
  });

  it("rejects conflicting target flags", async () => {
    assert.throws(
      () => normalizeInstallSelector({ project: true, global: true }),
      /`--project` 与 `--global` 不能同时使用/,
    );

    assert.throws(
      () => normalizeInstallSelector({ dir: "/tmp/custom", global: true }),
      /显式目录 `--dir` 不能与 `--project` 或 `--global` 同时使用/,
    );
  });

  it("prefers the explicit output directory when provided", async () => {
    const result = await resolveInstallTarget("codex", {
      dir: "/tmp/codex-out",
      cwd: "/tmp/ignored",
    });

    assert.equal(result.root, "/tmp/codex-out");
    assert.equal(result.source, "explicit");
  });

  it("walks upward to the nearest project root marker", async () => {
    const root = await createTempDir();
    const nested = join(root, "apps", "cli");
    await mkdir(nested, { recursive: true });
    await writeFile(join(root, "package.json"), "{}\n", "utf8");

    const result = await resolveInstallTarget("codex", { cwd: nested });

    assert.equal(result.root, root);
    assert.equal(result.source, "project-root");
    assert.equal(result.marker, "package.json");
  });

  it("falls back to cwd when no project root markers exist", async () => {
    const cwd = await createTempDir();

    const result = await resolveInstallTarget("qoder", { cwd });

    assert.equal(result.root, cwd);
    assert.equal(result.source, "cwd");
  });

  it("resolves Codex global scope to the user home directory", async () => {
    const result = await resolveInstallTarget("codex", { scope: "global" });

    assert.equal(result.source, "official-global");
    assert.ok(result.root.length > 0);
    assert.ok(result.hint?.includes("Codex"));
  });

  it("resolves Qoder global scope to ~/.qoder", async () => {
    const result = await resolveInstallTarget("qoder", { scope: "global" });

    assert.equal(result.source, "official-global");
    assert.ok(result.root.endsWith(`${join(".qoder")}`));
    assert.ok(result.hint?.includes("~/.qoder/AGENTS.md"));
  });

  it("rejects Qwen global scope when no official default QWEN.md path exists", async () => {
    await assert.rejects(
      () => resolveInstallTarget("qwen", { scope: "global" }),
      /未给出全局 `QWEN\.md` 默认位置/,
    );
  });

  it("rejects unknown install scopes", async () => {
    await assert.rejects(
      () => resolveInstallTarget("codex", { scope: "workspace" }),
      /不支持的安装范围：workspace/,
    );
  });

  it("rejects inconsistent legacy scope and new global flag", async () => {
    await assert.rejects(
      () => resolveInstallTarget("codex", { global: true, scope: "project" }),
      /兼容参数 `--scope` 与新的安装目标参数不一致/,
    );
  });
});
