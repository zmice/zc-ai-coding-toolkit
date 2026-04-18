import { createHash } from "node:crypto";
import type { PlatformArtifact } from "@zmice/platform-core";

import type { PlatformInstallPlanLike, PlatformInstallReceipt, PlatformInstallReceiptArtifact } from "./types.js";

export const platformInstallReceiptSchemaVersion = 1 as const;

export interface CreatePlatformInstallReceiptOptions {
  readonly installedAt?: string | Date;
  readonly zcVersion?: string;
}

export function hashPlatformArtifactContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function createPlatformInstallReceiptArtifact(
  artifact: PlatformArtifact,
): PlatformInstallReceiptArtifact {
  return {
    path: artifact.path,
    sha256: hashPlatformArtifactContent(artifact.content),
    bytes: Buffer.byteLength(artifact.content, "utf8"),
  };
}

export function createPlatformInstallReceipt(
  plan: PlatformInstallPlanLike,
  options: CreatePlatformInstallReceiptOptions = {},
): PlatformInstallReceipt {
  const installedAt = options.installedAt ?? new Date().toISOString();

  return {
    schemaVersion: platformInstallReceiptSchemaVersion,
    platform: plan.platform,
    destinationRoot: plan.destinationRoot,
    manifestSource: plan.manifestSource,
    overwrite: plan.overwrite ?? "error",
    installedAt: typeof installedAt === "string" ? installedAt : installedAt.toISOString(),
    ...(options.zcVersion ? { zcVersion: options.zcVersion } : {}),
    ...(plan.metadata?.fingerprint.value ? { contentFingerprint: plan.metadata.fingerprint.value } : {}),
    artifacts: plan.artifacts.map((artifact) => createPlatformInstallReceiptArtifact(artifact)),
  };
}
