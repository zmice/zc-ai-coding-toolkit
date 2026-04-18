import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { resolveInstallTarget } from "./install-target.js";

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
  it("prefers the explicit output directory when provided", async () => {
    const result = await resolveInstallTarget("codex", {
      out: "/tmp/codex-out",
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
});
