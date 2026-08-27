import { lstat, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

import { hashPlatformArtifactContent } from "../platform-state/receipt.js";
import type { PlatformInstallReceipt } from "../platform-state/types.js";
import { pathExists, removeManagedPaths } from "./platform-install-cleanup.js";
import {
  deletePlatformInstallReceipt,
  readPlatformInstallReceipt,
  resolvePlatformInstallReceiptPath,
} from "./platform-install-receipt.js";

export type QoderCnLegacyInstallStatus =
  | "not-found"
  | "ready"
  | "drifted"
  | "unsupported"
  | "invalid";

export interface QoderCnLegacyInstallInspection {
  readonly status: QoderCnLegacyInstallStatus;
  readonly legacyRoot: string;
  readonly receiptPath: string;
  readonly trackedArtifacts: number;
  readonly driftedArtifacts: number;
  readonly missingArtifacts: number;
  readonly artifactPaths: readonly string[];
  readonly reason?: string;
}

export interface QoderCnLegacyInstallMigrationResult {
  readonly status: "not-found" | "migrated" | "retained";
  readonly legacyRoot: string;
  readonly receiptPath: string;
  readonly trackedArtifacts: number;
  readonly driftedArtifacts: number;
  readonly removedArtifacts: number;
  readonly missingArtifacts: number;
  readonly receiptRemoved: boolean;
  readonly reason?: string;
}

interface InspectQoderCnLegacyInstallOptions {
  readonly legacyRoot: string;
}

interface MigrateQoderCnLegacyInstallOptions {
  readonly force?: boolean;
}

function normalizePathForComparison(path: string): string {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isSamePath(left: string, right: string): boolean {
  return normalizePathForComparison(left) === normalizePathForComparison(right);
}

function isPathInsideRoot(root: string, path: string): boolean {
  const relativePath = relative(resolve(root), resolve(path));
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function isEnoentError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function pathUsesSymbolicLink(root: string, path: string): Promise<boolean> {
  const resolvedRoot = resolve(root);
  let current = dirname(resolve(path));
  const directories = [resolvedRoot];

  while (!isSamePath(current, resolvedRoot)) {
    if (!isPathInsideRoot(resolvedRoot, current)) return true;
    directories.push(current);
    current = dirname(current);
  }

  for (const directory of directories) {
    try {
      if ((await lstat(directory)).isSymbolicLink()) return true;
    } catch (error) {
      if (!isEnoentError(error)) throw error;
    }
  }

  return false;
}

function emptyInspection(
  status: QoderCnLegacyInstallStatus,
  legacyRoot: string,
  receiptPath: string,
  reason?: string,
): QoderCnLegacyInstallInspection {
  return {
    status,
    legacyRoot,
    receiptPath,
    trackedArtifacts: 0,
    driftedArtifacts: 0,
    missingArtifacts: 0,
    artifactPaths: [],
    ...(reason ? { reason } : {}),
  };
}

function validateLegacyReceipt(
  receipt: PlatformInstallReceipt,
  legacyRoot: string,
): string | null {
  if (!isSamePath(receipt.destinationRoot, legacyRoot)) {
    return "旧安装回执的 destinationRoot 与历史 Qoder 目录不一致。";
  }

  if (receipt.installMethod && receipt.installMethod !== "filesystem") {
    return "旧安装回执并非直接文件系统安装，不执行自动清理。";
  }

  const unsafePath = receipt.artifacts.find((artifact) => !isPathInsideRoot(legacyRoot, artifact.path));
  if (unsafePath) {
    return `旧安装回执包含历史 Qoder 目录之外的路径：${unsafePath.path}`;
  }

  return null;
}

export function resolveQoderCnLegacyInstallRoot(destinationRoot: string): string | null {
  const resolvedRoot = resolve(destinationRoot);
  if (basename(resolvedRoot).toLowerCase() !== ".qoder-cn") return null;
  return resolve(dirname(resolvedRoot), ".qoder");
}

export async function inspectQoderCnLegacyInstall(
  options: InspectQoderCnLegacyInstallOptions,
): Promise<QoderCnLegacyInstallInspection> {
  const legacyRoot = resolve(options.legacyRoot);
  const receiptPath = resolvePlatformInstallReceiptPath({
    platform: "qoder-cn",
    destinationRoot: legacyRoot,
  });

  let receipt: PlatformInstallReceipt | null;
  try {
    receipt = await readPlatformInstallReceipt(receiptPath);
  } catch (error) {
    return emptyInspection(
      "invalid",
      legacyRoot,
      receiptPath,
      error instanceof Error ? error.message : "旧安装回执无法读取。",
    );
  }

  if (!receipt) return emptyInspection("not-found", legacyRoot, receiptPath);

  const validationError = validateLegacyReceipt(receipt, legacyRoot);
  if (validationError) {
    const status = receipt.installMethod && receipt.installMethod !== "filesystem"
      ? "unsupported"
      : "invalid";
    return {
      ...emptyInspection(status, legacyRoot, receiptPath, validationError),
      trackedArtifacts: receipt.artifacts.length,
      artifactPaths: receipt.artifacts.map((artifact) => artifact.path),
    };
  }

  if (await pathUsesSymbolicLink(legacyRoot, receiptPath)) {
    return {
      ...emptyInspection("invalid", legacyRoot, receiptPath, "旧安装目录或回执目录包含符号链接，拒绝自动清理。"),
      trackedArtifacts: receipt.artifacts.length,
      artifactPaths: receipt.artifacts.map((artifact) => artifact.path),
    };
  }

  let driftedArtifacts = 0;
  let missingArtifacts = 0;

  for (const artifact of receipt.artifacts) {
    if (await pathUsesSymbolicLink(legacyRoot, artifact.path)) {
      return {
        ...emptyInspection("invalid", legacyRoot, receiptPath, `旧安装产物路径包含符号链接：${artifact.path}`),
        trackedArtifacts: receipt.artifacts.length,
        artifactPaths: receipt.artifacts.map((candidate) => candidate.path),
      };
    }

    try {
      const content = await readFile(artifact.path, "utf8");
      if (hashPlatformArtifactContent(content) !== artifact.sha256) driftedArtifacts += 1;
    } catch (error) {
      if (isEnoentError(error)) {
        missingArtifacts += 1;
        continue;
      }

      return {
        ...emptyInspection("invalid", legacyRoot, receiptPath, `无法检查旧安装产物：${artifact.path}`),
        trackedArtifacts: receipt.artifacts.length,
        artifactPaths: receipt.artifacts.map((candidate) => candidate.path),
      };
    }
  }

  return {
    status: driftedArtifacts > 0 ? "drifted" : "ready",
    legacyRoot,
    receiptPath,
    trackedArtifacts: receipt.artifacts.length,
    driftedArtifacts,
    missingArtifacts,
    artifactPaths: receipt.artifacts.map((artifact) => artifact.path),
    ...(driftedArtifacts > 0
      ? { reason: "旧安装产物包含本地修改；默认保留，确认后可使用 --force 迁移。" }
      : {}),
  };
}

export async function migrateQoderCnLegacyInstall(
  inspection: QoderCnLegacyInstallInspection,
  options: MigrateQoderCnLegacyInstallOptions = {},
): Promise<QoderCnLegacyInstallMigrationResult> {
  if (inspection.status === "not-found") {
    return {
      status: "not-found",
      legacyRoot: inspection.legacyRoot,
      receiptPath: inspection.receiptPath,
      trackedArtifacts: 0,
      driftedArtifacts: 0,
      removedArtifacts: 0,
      missingArtifacts: 0,
      receiptRemoved: false,
    };
  }

  const canMigrate = inspection.status === "ready"
    || (inspection.status === "drifted" && options.force === true);
  if (!canMigrate) {
    return {
      status: "retained",
      legacyRoot: inspection.legacyRoot,
      receiptPath: inspection.receiptPath,
      trackedArtifacts: inspection.trackedArtifacts,
      driftedArtifacts: inspection.driftedArtifacts,
      removedArtifacts: 0,
      missingArtifacts: inspection.missingArtifacts,
      receiptRemoved: false,
      reason: inspection.reason ?? "旧安装不满足自动迁移的安全条件。",
    };
  }

  const cleanup = await removeManagedPaths(inspection.artifactPaths);
  const receiptExisted = await pathExists(inspection.receiptPath);
  if (receiptExisted) await deletePlatformInstallReceipt(inspection.receiptPath);

  return {
    status: "migrated",
    legacyRoot: inspection.legacyRoot,
    receiptPath: inspection.receiptPath,
    trackedArtifacts: inspection.trackedArtifacts,
    driftedArtifacts: inspection.driftedArtifacts,
    removedArtifacts: cleanup.removed,
    missingArtifacts: cleanup.missing,
    receiptRemoved: receiptExisted,
  };
}
