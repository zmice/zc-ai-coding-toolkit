import { lstat, mkdir, rename } from "node:fs/promises";
import { posix, win32 } from "node:path";

export interface CodexLegacyPluginQuarantine {
  readonly originalPath: string;
  readonly backupPath: string | null;
  readonly moved: boolean;
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

export function isCodexLegacyDirectPluginPath(pluginPath: string): boolean {
  return pluginPath
    .replaceAll("\\", "/")
    .replace(/\/+$/, "")
    .toLowerCase()
    .endsWith("/.codex/plugins/zc-toolkit");
}

export async function quarantineCodexLegacyDirectPlugin(
  pluginPath: string,
  version: string | null,
  now = new Date(),
): Promise<CodexLegacyPluginQuarantine> {
  if (!isCodexLegacyDirectPluginPath(pluginPath)) {
    throw new Error(`拒绝迁移非 Codex 旧直装目录：${pluginPath}`);
  }

  if (!(await pathExists(pluginPath))) {
    return {
      originalPath: pluginPath,
      backupPath: null,
      moved: false,
    };
  }

  const paths = pathApi(pluginPath);
  const codexHome = paths.dirname(paths.dirname(pluginPath));
  const backupRoot = paths.join(codexHome, "platform-state", "legacy-plugin-backups");
  const backupBaseName = `zc-toolkit-${sanitizeVersion(version)}-${formatBackupTimestamp(now)}`;
  await mkdir(backupRoot, { recursive: true });

  let backupPath = paths.join(backupRoot, backupBaseName);
  let suffix = 1;
  while (await pathExists(backupPath)) {
    backupPath = paths.join(backupRoot, `${backupBaseName}-${suffix}`);
    suffix += 1;
  }

  await rename(pluginPath, backupPath);
  return {
    originalPath: pluginPath,
    backupPath,
    moved: true,
  };
}

export async function restoreCodexLegacyDirectPlugin(
  quarantine: CodexLegacyPluginQuarantine,
): Promise<void> {
  if (!quarantine.moved || !quarantine.backupPath) {
    return;
  }
  if (!(await pathExists(quarantine.backupPath))) {
    throw new Error(`无法恢复 Codex 旧插件：备份目录不存在 ${quarantine.backupPath}`);
  }
  if (await pathExists(quarantine.originalPath)) {
    throw new Error(`无法恢复 Codex 旧插件：原目录已重新出现 ${quarantine.originalPath}`);
  }

  await rename(quarantine.backupPath, quarantine.originalPath);
}
