import { cp, lstat, mkdir, rename, rm } from "node:fs/promises";
import { posix, win32 } from "node:path";

export interface CodexLegacyPluginBackup {
  readonly originalPath: string;
  readonly backupPath: string | null;
  readonly copied: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function pathApi(path: string): typeof posix | typeof win32 {
  return path.includes("\\") ? win32 : posix;
}

function formatBackupTimestamp(now: Date): string {
  return now.toISOString().replace(/[-:.]/g, "");
}

function sanitizeVersion(version: string | null): string {
  const normalized = version?.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized || "unknown";
}

function resolveBackupRoot(pluginPath: string): string {
  const paths = pathApi(pluginPath);
  const codexHome = paths.dirname(paths.dirname(pluginPath));
  return paths.join(codexHome, "platform-state", "legacy-plugin-backups");
}

function isOwnedBackupPath(originalPath: string, backupPath: string): boolean {
  const paths = pathApi(originalPath);
  return paths.dirname(backupPath).toLowerCase() === resolveBackupRoot(originalPath).toLowerCase()
    && paths.basename(backupPath).toLowerCase().startsWith("zc-toolkit-");
}

async function assertDirectory(path: string, label: string): Promise<void> {
  const stats = await lstat(path);
  if (!stats.isDirectory()) {
    throw new Error(`${label}不是目录：${path}`);
  }
}

export function isCodexLegacyDirectPluginPath(pluginPath: string): boolean {
  return pluginPath
    .replaceAll("\\", "/")
    .replace(/\/+$/, "")
    .toLowerCase()
    .endsWith("/.codex/plugins/zc-toolkit");
}

export async function backupCodexLegacyDirectPlugin(
  pluginPath: string,
  version: string | null,
  now = new Date(),
): Promise<CodexLegacyPluginBackup> {
  if (!isCodexLegacyDirectPluginPath(pluginPath)) {
    throw new Error(`拒绝迁移非 Codex 旧直装目录：${pluginPath}`);
  }

  if (!(await pathExists(pluginPath))) {
    return {
      originalPath: pluginPath,
      backupPath: null,
      copied: false,
    };
  }

  await assertDirectory(pluginPath, "Codex 旧插件路径");
  const paths = pathApi(pluginPath);
  const backupRoot = resolveBackupRoot(pluginPath);
  const backupBaseName = `zc-toolkit-${sanitizeVersion(version)}-${formatBackupTimestamp(now)}`;
  await mkdir(backupRoot, { recursive: true });

  let backupPath = paths.join(backupRoot, backupBaseName);
  let suffix = 1;
  while (await pathExists(backupPath)) {
    backupPath = paths.join(backupRoot, `${backupBaseName}-${suffix}`);
    suffix += 1;
  }

  await cp(pluginPath, backupPath, {
    errorOnExist: true,
    force: false,
    recursive: true,
  });
  await assertDirectory(backupPath, "Codex 旧插件备份路径");
  return {
    originalPath: pluginPath,
    backupPath,
    copied: true,
  };
}

export async function detachCodexLegacyDirectPlugin(
  backup: CodexLegacyPluginBackup,
): Promise<boolean> {
  if (!backup.copied || !backup.backupPath) {
    return false;
  }
  if (!isCodexLegacyDirectPluginPath(backup.originalPath)) {
    throw new Error(`拒绝移除非 Codex 旧直装目录：${backup.originalPath}`);
  }
  if (!isOwnedBackupPath(backup.originalPath, backup.backupPath)) {
    throw new Error(`拒绝使用非受管 Codex 旧插件备份：${backup.backupPath}`);
  }
  if (!(await pathExists(backup.backupPath))) {
    throw new Error(`拒绝移除 Codex 旧插件：备份目录不存在 ${backup.backupPath}`);
  }
  await assertDirectory(backup.backupPath, "Codex 旧插件备份路径");
  if (!(await pathExists(backup.originalPath))) {
    return false;
  }
  await assertDirectory(backup.originalPath, "Codex 旧插件路径");
  await rm(backup.originalPath, { recursive: true, force: false });
  return true;
}

export async function restoreCodexLegacyDirectPlugin(
  backup: CodexLegacyPluginBackup,
): Promise<void> {
  if (!backup.copied || !backup.backupPath) {
    return;
  }
  if (!isCodexLegacyDirectPluginPath(backup.originalPath)) {
    throw new Error(`拒绝恢复到非 Codex 旧直装目录：${backup.originalPath}`);
  }
  if (!isOwnedBackupPath(backup.originalPath, backup.backupPath)) {
    throw new Error(`拒绝使用非受管 Codex 旧插件备份：${backup.backupPath}`);
  }
  if (!(await pathExists(backup.backupPath))) {
    throw new Error(`无法恢复 Codex 旧插件：备份目录不存在 ${backup.backupPath}`);
  }
  await assertDirectory(backup.backupPath, "Codex 旧插件备份路径");
  if (await pathExists(backup.originalPath)) {
    throw new Error(`无法恢复 Codex 旧插件：原目录已重新出现 ${backup.originalPath}`);
  }

  await rename(backup.backupPath, backup.originalPath);
}
