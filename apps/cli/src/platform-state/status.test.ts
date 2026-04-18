import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, it } from "vitest";

import { hashPlatformArtifactContent } from "./receipt.js";
import { resolvePlatformInstallStatus } from "./status.js";
import { writePlatformInstallReceiptForPlan } from "../utils/platform-install-receipt.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-coding-platform-status-"));
  tempDirs.push(dir);
  return dir;
}

async function writeArtifact(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("resolvePlatformInstallStatus", () => {
  it("reports not-installed when no receipt exists even if files happen to be present", async () => {
    const root = await createTempDir();
    const plan = {
      platform: "codex" as const,
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error" as const,
      artifacts: [{ path: join(root, "AGENTS.md"), content: "# agents\n" }],
    };
    await writeArtifact(plan.artifacts[0]!.path, plan.artifacts[0]!.content);

    const status = await resolvePlatformInstallStatus(plan);

    assert.equal(status.kind, "not-installed");
    assert.equal(status.receipt, null);
    assert.equal(status.receiptPath, join(root, ".zc", "platform-state", "codex.install-receipt.json"));
  });

  it("reports up-to-date when disk content and current plan both match the receipt", async () => {
    const root = await createTempDir();
    const artifactContent = "# agents\n";
    const expectedDigest = hashPlatformArtifactContent(artifactContent);
    const plan = {
      platform: "codex" as const,
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error" as const,
      artifacts: [{ path: join(root, "AGENTS.md"), content: artifactContent }],
    };
    await writeArtifact(plan.artifacts[0]!.path, plan.artifacts[0]!.content);
    await writePlatformInstallReceiptForPlan(plan, { installedAt: "2026-04-19T10:11:12.000Z" });

    const status = await resolvePlatformInstallStatus(plan);

    assert.equal(status.kind, "up-to-date");
    assert.deepEqual(status.summary, {
      trackedArtifacts: 1,
      driftedArtifacts: 0,
      missingArtifacts: 0,
      plannedChanges: 0,
    });
    assert.deepEqual(status.artifacts, [
      {
        path: join(root, "AGENTS.md"),
        receiptSha256: expectedDigest,
        actualSha256: expectedDigest,
        plannedSha256: expectedDigest,
        matchesReceiptOnDisk: true,
        differsFromPlan: false,
      },
    ]);
  });

  it("reports update-available when the installed files still match the receipt but the current plan changed", async () => {
    const root = await createTempDir();
    const installedPlan = {
      platform: "codex" as const,
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error" as const,
      artifacts: [{ path: join(root, "AGENTS.md"), content: "# agents\n" }],
    };
    await writeArtifact(installedPlan.artifacts[0]!.path, installedPlan.artifacts[0]!.content);
    await writePlatformInstallReceiptForPlan(installedPlan, { installedAt: "2026-04-19T10:11:12.000Z" });

    const updatedPlan = {
      ...installedPlan,
      artifacts: [{ path: join(root, "AGENTS.md"), content: "# agents v2\n" }],
    };

    const status = await resolvePlatformInstallStatus(updatedPlan);

    assert.equal(status.kind, "update-available");
    assert.deepEqual(status.summary, {
      trackedArtifacts: 1,
      driftedArtifacts: 0,
      missingArtifacts: 0,
      plannedChanges: 1,
    });
    assert.equal(status.artifacts[0]?.matchesReceiptOnDisk, true);
    assert.equal(status.artifacts[0]?.differsFromPlan, true);
  });

  it("reports drifted when disk content diverges from the recorded receipt", async () => {
    const root = await createTempDir();
    const plan = {
      platform: "codex" as const,
      destinationRoot: root,
      manifestSource: "packages/toolkit/src/content",
      overwrite: "error" as const,
      artifacts: [{ path: join(root, "AGENTS.md"), content: "# agents\n" }],
    };
    await writeArtifact(plan.artifacts[0]!.path, plan.artifacts[0]!.content);
    await writePlatformInstallReceiptForPlan(plan, { installedAt: "2026-04-19T10:11:12.000Z" });
    await writeArtifact(plan.artifacts[0]!.path, "# manually changed\n");

    const status = await resolvePlatformInstallStatus(plan);

    assert.equal(status.kind, "drifted");
    assert.deepEqual(status.summary, {
      trackedArtifacts: 1,
      driftedArtifacts: 1,
      missingArtifacts: 0,
      plannedChanges: 0,
    });
    assert.equal(status.artifacts[0]?.matchesReceiptOnDisk, false);
    assert.equal(status.artifacts[0]?.differsFromPlan, false);
  });
});
