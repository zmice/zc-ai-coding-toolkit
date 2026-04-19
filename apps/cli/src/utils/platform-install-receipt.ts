import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OverwriteMode, PlatformName } from "@zmice/platform-core";

import {
  createPlatformInstallReceipt,
  platformInstallReceiptSchemaVersion,
  type CreatePlatformInstallReceiptOptions,
} from "../platform-state/receipt.js";
import type { PlatformInstallPlanLike, PlatformInstallReceipt } from "../platform-state/types.js";

const platformNames = ["qwen", "codex", "claude", "opencode"] as const satisfies readonly PlatformName[];
const overwriteModes = ["error", "force"] as const satisfies readonly OverwriteMode[];
const receiptDirectorySegments = [".zc", "platform-state"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlatformName(value: unknown): value is PlatformName {
  return typeof value === "string" && platformNames.includes(value as PlatformName);
}

function isOverwriteMode(value: unknown): value is OverwriteMode {
  return typeof value === "string" && overwriteModes.includes(value as OverwriteMode);
}

function isPlatformInstallReceiptArtifact(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.path === "string" &&
    typeof value.sha256 === "string" &&
    typeof value.bytes === "number"
  );
}

function isPlatformInstallReceipt(value: unknown): value is PlatformInstallReceipt {
  return (
    isRecord(value) &&
    value.schemaVersion === platformInstallReceiptSchemaVersion &&
    isPlatformName(value.platform) &&
    typeof value.destinationRoot === "string" &&
    typeof value.manifestSource === "string" &&
    isOverwriteMode(value.overwrite) &&
    typeof value.installedAt === "string" &&
    (value.zcVersion === undefined || typeof value.zcVersion === "string") &&
    (value.contentFingerprint === undefined || typeof value.contentFingerprint === "string") &&
    (value.installMethod === undefined || value.installMethod === "filesystem" || value.installMethod === "qwen-cli") &&
    (value.bundleType === undefined || value.bundleType === "source-bundle" || value.bundleType === "release-bundle") &&
    (value.bundlePath === undefined || typeof value.bundlePath === "string") &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every((artifact) => isPlatformInstallReceiptArtifact(artifact))
  );
}

export function resolvePlatformInstallReceiptPath(input: {
  readonly platform: PlatformName;
  readonly destinationRoot: string;
}): string {
  return join(input.destinationRoot, ...receiptDirectorySegments, `${input.platform}.install-receipt.json`);
}

export async function readPlatformInstallReceipt(receiptPath: string): Promise<PlatformInstallReceipt | null> {
  try {
    const raw = JSON.parse(await readFile(receiptPath, "utf8")) as unknown;
    if (!isPlatformInstallReceipt(raw)) {
      throw new Error(`Invalid platform install receipt at ${receiptPath}.`);
    }

    return raw;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writePlatformInstallReceipt(
  receiptPath: string,
  receipt: PlatformInstallReceipt,
): Promise<void> {
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

export async function deletePlatformInstallReceipt(receiptPath: string): Promise<void> {
  await rm(receiptPath, { force: true });
}

export async function writePlatformInstallReceiptForPlan(
  plan: PlatformInstallPlanLike,
  options: CreatePlatformInstallReceiptOptions = {},
): Promise<PlatformInstallReceipt> {
  const receipt = createPlatformInstallReceipt(plan, options);
  await writePlatformInstallReceipt(resolvePlatformInstallReceiptPath(plan), receipt);
  return receipt;
}
