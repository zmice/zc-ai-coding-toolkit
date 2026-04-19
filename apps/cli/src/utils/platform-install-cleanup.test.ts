import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { pathExists, removeManagedPaths } from "./platform-install-cleanup.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-coding-platform-cleanup-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("platform install cleanup helpers", () => {
  it("removes existing managed paths and reports missing ones", async () => {
    const root = await createTempDir();
    const file = join(root, "AGENTS.md");
    const missing = join(root, "missing.md");
    await writeFile(file, "# agents\n", "utf8");

    const result = await removeManagedPaths([file, missing]);

    assert.deepEqual(result, {
      removed: 1,
      missing: 1,
    });
    assert.equal(await pathExists(file), false);
  });
});
