import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OverwriteMode, PlatformName } from "@zmice/platform-core";

import {
  createPlatformInstallReceipt,
  platformInstallReceiptSchemaVersion,
  type CreatePlatformInstallReceiptOptions,
} from "../platform-state/receipt.js";
import type { PlatformInstallPlanLike, PlatformInstallReceipt } from "../platform-state/types.js";

const platformNames = ["qwen", "codex", "claude", "opencode", "qoder-cn"] as const satisfies readonly PlatformName[];
const overwriteModes = ["error", "force"] as const satisfies readonly OverwriteMode[];
function getReceiptDirectorySegments(platform: PlatformName): readonly string[] {
  if (platform === "codex") {
    return [".codex", "platform-state"];
  }

  return [".zc", "platform-state"];
}

function isCodexHomeRoot(destinationRoot: string): boolean {
  const normalizedRoot = destinationRoot.replace(/[\\/]+$/, "");
  return normalizedRoot.split(/[\\/]/).at(-1)?.toLowerCase() === ".codex";
}

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
    (value.installMethod === undefined || value.installMethod === "filesystem" || value.installMethod === "qwen-cli" || value.installMethod === "qoder-cn-cli") &&
    (value.installSource === undefined || value.installSource === "github-repo" || value.installSource === "local-bundle") &&
    (value.sourceRef === undefined || typeof value.sourceRef === "string") &&
    (value.bundleType === undefined || value.bundleType === "source-bundle" || value.bundleType === "release-bundle" || value.bundleType === "qoder-cn-plugin") &&
    (value.bundlePath === undefined || typeof value.bundlePath === "string") &&
    Array.isArray(value.artifacts) &&
    value.artifacts.every((artifact) => isPlatformInstallReceiptArtifact(artifact))
  );
}

export function resolvePlatformInstallReceiptPath(input: {
  readonly platform: PlatformName;
  readonly destinationRoot: string;
}): string {
  if (input.platform === "codex" && isCodexHomeRoot(input.destinationRoot)) {
    return join(input.destinationRoot, "platform-state", `${input.platform}.install-receipt.json`);
  }

  return join(input.destinationRoot, ...getReceiptDirectorySegments(input.platform), `${input.platform}.install-receipt.json`);
}

export function resolveLegacyPlatformInstallReceiptPath(input: {
  readonly platform: PlatformName;
  readonly destinationRoot: string;
}): string | null {
  if (input.platform !== "codex" || !isCodexHomeRoot(input.destinationRoot)) {
    return null;
  }

  return join(
    input.destinationRoot,
    ".codex",
    "platform-state",
    `${input.platform}.install-receipt.json`,
  );
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
  const receiptPath = resolvePlatformInstallReceiptPath(plan);
  await writePlatformInstallReceipt(receiptPath, receipt);
  const legacyReceiptPath = resolveLegacyPlatformInstallReceiptPath(plan);
  if (legacyReceiptPath && legacyReceiptPath !== receiptPath) {
    await deletePlatformInstallReceipt(legacyReceiptPath);
  }
  return receipt;
}
