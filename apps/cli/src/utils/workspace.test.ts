import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, describe, it } from "vitest";

import { ArtifactConflictError, resolveWorkspaceRoot, writeArtifacts } from "./workspace.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-coding-workspace-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map(async (dir) => {
      const fs = await import("node:fs/promises");
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("writeArtifacts", () => {
  it("fails before writing any files when overwrite mode is error and conflicts exist", async () => {
    const root = await createTempDir();
    const conflictPath = join(root, "AGENTS.md");
    const newPath = join(root, "QWEN.md");

    await writeFile(conflictPath, "old-content", "utf8");

    await assert.rejects(
      writeArtifacts(
        [
          { path: conflictPath, content: "new-content" },
          { path: newPath, content: "generated-content" },
        ],
        { overwrite: "error" },
      ),
      (error: unknown) => error instanceof ArtifactConflictError && error.conflicts.length === 1,
    );

    assert.equal(await readFile(conflictPath, "utf8"), "old-content");
    await assert.rejects(stat(newPath));
  });
});

describe("resolveWorkspaceRoot", () => {
  it("falls back to vendored runtime root when monorepo markers are absent", async () => {
    const root = await createTempDir();
    const packageRoot = join(root, "pkg");
    const modulePath = join(packageRoot, "dist", "utils", "workspace.js");
    const vendorRoot = join(packageRoot, "vendor");

    await mkdir(join(vendorRoot, "packages", "toolkit"), { recursive: true });
    await mkdir(join(vendorRoot, "packages", "platform-qwen"), { recursive: true });
    await mkdir(join(vendorRoot, "references"), { recursive: true });
    await writeFile(join(vendorRoot, "references", "upstreams.yaml"), "upstreams:\n", "utf8");
    await mkdir(join(packageRoot, "dist", "utils"), { recursive: true });
    await writeFile(modulePath, "", "utf8");

    const resolved = resolveWorkspaceRoot(pathToFileURL(modulePath).href);
    assert.equal(resolved, vendorRoot);
  });
});
