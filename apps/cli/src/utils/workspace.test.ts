import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { ArtifactConflictError, writeArtifacts } from "./workspace.js";

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
