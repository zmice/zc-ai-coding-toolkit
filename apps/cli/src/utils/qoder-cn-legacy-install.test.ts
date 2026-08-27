import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  inspectQoderCnLegacyInstall,
  migrateQoderCnLegacyInstall,
  resolveQoderCnLegacyInstallRoot,
} from "./qoder-cn-legacy-install.js";

const temporaryRoots: string[] = [];

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function createLegacyReceipt(options: {
  legacyRoot: string;
  artifacts: Array<{ path: string; content?: string; receiptContent?: string }>;
  installMethod?: "filesystem" | "qoder-cn-cli";
}): Promise<string> {
  const receiptPath = join(options.legacyRoot, ".zc", "platform-state", "qoder-cn.install-receipt.json");

  for (const artifact of options.artifacts) {
    if (artifact.content === undefined) continue;
    await mkdir(dirname(artifact.path), { recursive: true });
    await writeFile(artifact.path, artifact.content, "utf8");
  }

  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify({
    schemaVersion: 1,
    platform: "qoder-cn",
    destinationRoot: options.legacyRoot,
    manifestSource: "toolkit-manifest",
    overwrite: "error",
    installedAt: "2026-08-27T00:00:00.000Z",
    ...(options.installMethod ? { installMethod: options.installMethod } : {}),
    artifacts: options.artifacts.map((artifact) => {
      const receiptContent = artifact.receiptContent ?? artifact.content ?? "";
      return {
        path: artifact.path,
        sha256: sha256(receiptContent),
        bytes: Buffer.byteLength(receiptContent, "utf8"),
      };
    }),
  }, null, 2)}\n`, "utf8");

  return receiptPath;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Qoder CN legacy filesystem migration", () => {
  it("moves only receipt-owned legacy artifacts and preserves unrelated Qoder data", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "zc-qoder-legacy-"));
    temporaryRoots.push(homeRoot);
    const legacyRoot = join(homeRoot, ".qoder");
    const managedPath = join(legacyRoot, "commands", "zc", "start.md");
    const userSettingsPath = join(legacyRoot, "settings.json");
    const receiptPath = await createLegacyReceipt({
      legacyRoot,
      artifacts: [{ path: managedPath, content: "# managed\n" }],
      installMethod: "filesystem",
    });
    await writeFile(userSettingsPath, "{}\n", "utf8");

    const inspection = await inspectQoderCnLegacyInstall({ legacyRoot });

    expect(inspection).toEqual(expect.objectContaining({
      status: "ready",
      legacyRoot: resolve(legacyRoot),
      receiptPath,
      trackedArtifacts: 1,
      driftedArtifacts: 0,
      missingArtifacts: 0,
    }));

    const migration = await migrateQoderCnLegacyInstall(inspection);

    expect(migration).toEqual(expect.objectContaining({
      status: "migrated",
      removedArtifacts: 1,
      missingArtifacts: 0,
      receiptRemoved: true,
    }));
    expect(existsSync(managedPath)).toBe(false);
    expect(existsSync(receiptPath)).toBe(false);
    expect(await readFile(userSettingsPath, "utf8")).toBe("{}\n");
  });

  it("does not touch legacy files when no valid receipt exists", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "zc-qoder-manual-"));
    temporaryRoots.push(homeRoot);
    const legacyRoot = join(homeRoot, ".qoder");
    const manualPath = join(legacyRoot, "commands", "zc", "manual.md");
    await mkdir(dirname(manualPath), { recursive: true });
    await writeFile(manualPath, "# manual\n", "utf8");

    const inspection = await inspectQoderCnLegacyInstall({ legacyRoot });
    const migration = await migrateQoderCnLegacyInstall(inspection);

    expect(inspection.status).toBe("not-found");
    expect(migration.status).toBe("not-found");
    expect(await readFile(manualPath, "utf8")).toBe("# manual\n");
  });

  it("retains drifted legacy artifacts unless force is explicit", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "zc-qoder-drifted-"));
    temporaryRoots.push(homeRoot);
    const legacyRoot = join(homeRoot, ".qoder");
    const managedPath = join(legacyRoot, "skills", "zc-start", "SKILL.md");
    const receiptPath = await createLegacyReceipt({
      legacyRoot,
      artifacts: [{
        path: managedPath,
        content: "# locally edited\n",
        receiptContent: "# originally installed\n",
      }],
      installMethod: "filesystem",
    });

    const inspection = await inspectQoderCnLegacyInstall({ legacyRoot });
    const retained = await migrateQoderCnLegacyInstall(inspection);

    expect(inspection.status).toBe("drifted");
    expect(retained).toEqual(expect.objectContaining({
      status: "retained",
      removedArtifacts: 0,
      receiptRemoved: false,
    }));
    expect(existsSync(managedPath)).toBe(true);
    expect(existsSync(receiptPath)).toBe(true);

    const forced = await migrateQoderCnLegacyInstall(inspection, { force: true });

    expect(forced.status).toBe("migrated");
    expect(existsSync(managedPath)).toBe(false);
    expect(existsSync(receiptPath)).toBe(false);
  });

  it("rejects receipts that claim artifacts outside the legacy root", async () => {
    const homeRoot = await mkdtemp(join(tmpdir(), "zc-qoder-unsafe-"));
    temporaryRoots.push(homeRoot);
    const legacyRoot = join(homeRoot, ".qoder");
    const outsidePath = join(homeRoot, "outside.md");
    await writeFile(outsidePath, "# keep\n", "utf8");
    const receiptPath = await createLegacyReceipt({
      legacyRoot,
      artifacts: [{ path: outsidePath, receiptContent: "# keep\n" }],
      installMethod: "filesystem",
    });

    const inspection = await inspectQoderCnLegacyInstall({ legacyRoot });
    const migration = await migrateQoderCnLegacyInstall(inspection, { force: true });

    expect(inspection.status).toBe("invalid");
    expect(migration.status).toBe("retained");
    expect(await readFile(outsidePath, "utf8")).toBe("# keep\n");
    expect(existsSync(receiptPath)).toBe(true);
  });

  it("resolves the historical sibling root only for the standard Qoder CN config directory", () => {
    expect(resolveQoderCnLegacyInstallRoot(resolve("/home/test/.qoder-cn"))).toBe(resolve("/home/test/.qoder"));
    expect(resolveQoderCnLegacyInstallRoot(resolve("/home/test/custom-qoder"))).toBeNull();
  });
});
