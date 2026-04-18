import { readFile } from "node:fs/promises";

import { hashPlatformArtifactContent } from "./receipt.js";
import type {
  PlatformInstallArtifactStatus,
  PlatformInstallPlanLike,
  PlatformInstallStatusResult,
} from "./types.js";
import {
  readPlatformInstallReceipt,
  resolvePlatformInstallReceiptPath,
} from "../utils/platform-install-receipt.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readArtifactDigest(path: string): Promise<string | null> {
  try {
    const content = await readFile(path, "utf8");
    return hashPlatformArtifactContent(content);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function resolvePlatformInstallStatus(
  plan: PlatformInstallPlanLike,
): Promise<PlatformInstallStatusResult> {
  const receiptPath = resolvePlatformInstallReceiptPath(plan);
  const receipt = await readPlatformInstallReceipt(receiptPath);

  if (!receipt) {
    const artifacts = await Promise.all(
      plan.artifacts.map(async (artifact): Promise<PlatformInstallArtifactStatus> => ({
        path: artifact.path,
        receiptSha256: null,
        actualSha256: await readArtifactDigest(artifact.path),
        plannedSha256: hashPlatformArtifactContent(artifact.content),
        matchesReceiptOnDisk: null,
        differsFromPlan: false,
      })),
    );

    return {
      kind: "not-installed",
      platform: plan.platform,
      receiptPath,
      receipt: null,
      contentFingerprint: plan.metadata?.fingerprint.value,
      summary: {
        trackedArtifacts: 0,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts,
    };
  }

  const plannedDigests = new Map(
    plan.artifacts.map((artifact) => [artifact.path, hashPlatformArtifactContent(artifact.content)]),
  );
  const receiptDigests = new Map(receipt.artifacts.map((artifact) => [artifact.path, artifact.sha256]));
  const paths = [...new Set([...receiptDigests.keys(), ...plannedDigests.keys()])].sort();

  const artifacts = await Promise.all(
    paths.map(async (path): Promise<PlatformInstallArtifactStatus> => {
      const receiptSha256 = receiptDigests.get(path) ?? null;
      const plannedSha256 = plannedDigests.get(path) ?? null;
      const actualSha256 = await readArtifactDigest(path);

      return {
        path,
        receiptSha256,
        actualSha256,
        plannedSha256,
        matchesReceiptOnDisk: receiptSha256 === null ? null : actualSha256 === receiptSha256,
        differsFromPlan: receiptSha256 !== plannedSha256,
      };
    }),
  );

  const driftedArtifacts = artifacts.filter((artifact) => artifact.matchesReceiptOnDisk === false).length;
  const missingArtifacts = artifacts.filter(
    (artifact) => artifact.receiptSha256 !== null && artifact.actualSha256 === null,
  ).length;
  const plannedChanges = artifacts.filter((artifact) => artifact.differsFromPlan).length;

  return {
    kind: driftedArtifacts > 0 ? "drifted" : plannedChanges > 0 ? "update-available" : "up-to-date",
    platform: plan.platform,
    receiptPath,
    receipt,
    installedZcVersion: receipt.zcVersion,
    contentFingerprint: plan.metadata?.fingerprint.value,
    installedContentFingerprint: receipt.contentFingerprint,
    summary: {
      trackedArtifacts: receipt.artifacts.length,
      driftedArtifacts,
      missingArtifacts,
      plannedChanges,
    },
    artifacts,
  };
}
