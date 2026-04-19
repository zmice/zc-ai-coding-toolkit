import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { hashPlatformArtifactContent } from "../platform-state/receipt.js";
import {
  readPlatformInstallReceipt,
  resolvePlatformInstallReceiptPath,
  writePlatformInstallReceiptForPlan,
} from "./platform-install-receipt.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-coding-platform-receipt-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("platform install receipt store", () => {
  it("stores receipts under a hidden per-platform path beneath the destination root", async () => {
    const root = await createTempDir();

    const receiptPath = resolvePlatformInstallReceiptPath({
      platform: "codex",
      destinationRoot: root,
    });

    assert.equal(receiptPath, join(root, ".zc", "platform-state", "codex.install-receipt.json"));
  });

  it("writes and reads a receipt generated from an install plan", async () => {
    const root = await createTempDir();
    const artifactContent = "# agents\n";
    const plan = {
      platform: "codex" as const,
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error" as const,
      artifacts: [
        {
          path: join(root, "AGENTS.md"),
          content: artifactContent,
        },
      ],
    };

    const receiptPath = resolvePlatformInstallReceiptPath(plan);
    const written = await writePlatformInstallReceiptForPlan(plan, {
      installedAt: "2026-04-19T10:11:12.000Z",
    });

    const raw = JSON.parse(await readFile(receiptPath, "utf8")) as Record<string, unknown>;
    const receipt = await readPlatformInstallReceipt(receiptPath);

    assert.equal(raw.schemaVersion, 1);
    assert.deepEqual(receipt, written);
    assert.deepEqual(receipt, {
      schemaVersion: 1,
      platform: "codex",
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error",
      installedAt: "2026-04-19T10:11:12.000Z",
      artifacts: [
        {
          path: join(root, "AGENTS.md"),
          sha256: hashPlatformArtifactContent(artifactContent),
          bytes: 9,
        },
      ],
    });
  });

  it("returns null when a receipt has not been written yet", async () => {
    const root = await createTempDir();
    const receipt = await readPlatformInstallReceipt(
      resolvePlatformInstallReceiptPath({
        platform: "claude",
        destinationRoot: root,
      }),
    );

    assert.equal(receipt, null);
  });
});
