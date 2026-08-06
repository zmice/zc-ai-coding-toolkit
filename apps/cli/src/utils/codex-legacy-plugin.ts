import { constants } from "node:fs";
import { cp, copyFile, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { posix, win32 } from "node:path";

export interface CodexLegacyPersonalMarketplaceBackup {
  readonly originalPath: string;
  readonly backupPath: string;
  readonly legacyEntryCount: number;
}

export interface CodexLegacyPluginBackup {
  readonly originalPath: string;
  readonly backupPath: string | null;
  readonly copied: boolean;
  readonly personalMarketplace?: CodexLegacyPersonalMarketplaceBackup;
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

export function resolveCodexLegacyPersonalMarketplacePath(pluginPath: string): string {
  const paths = pathApi(pluginPath);
  const codexHome = paths.dirname(paths.dirname(pluginPath));
  const userHome = paths.dirname(codexHome);
  return paths.join(userHome, ".agents", "plugins", "marketplace.json");
}

function isOwnedBackupPath(originalPath: string, backupPath: string): boolean {
  const paths = pathApi(originalPath);
  return paths.dirname(backupPath).toLowerCase() === resolveBackupRoot(originalPath).toLowerCase()
    && paths.basename(backupPath).toLowerCase().startsWith("zc-toolkit-");
}

function isOwnedPersonalMarketplaceBackup(
  pluginBackup: CodexLegacyPluginBackup,
  marketplaceBackup: CodexLegacyPersonalMarketplaceBackup,
): boolean {
  if (!pluginBackup.backupPath) {
    return false;
  }
  const paths = pathApi(pluginBackup.originalPath);
  const normalize = (path: string): string => (
    paths === win32 ? path.toLowerCase() : path
  );
  return normalize(marketplaceBackup.originalPath)
      === normalize(resolveCodexLegacyPersonalMarketplacePath(pluginBackup.originalPath))
    && normalize(marketplaceBackup.backupPath)
      === normalize(`${pluginBackup.backupPath}.personal-marketplace.json`)
    && Number.isSafeInteger(marketplaceBackup.legacyEntryCount)
    && marketplaceBackup.legacyEntryCount > 0;
}

async function assertDirectory(path: string, label: string): Promise<void> {
  const stats = await lstat(path);
  if (!stats.isDirectory()) {
    throw new Error(`${label}不是目录：${path}`);
  }
}

function isLegacyPersonalMarketplaceEntry(value: unknown): boolean {
  if (!isRecord(value) || value.name !== "zc-toolkit" || !isRecord(value.source)) {
    return false;
  }
  const sourcePath = typeof value.source.path === "string"
    ? value.source.path.replaceAll("\\", "/")
    : null;
  return value.source.source === "local"
    && sourcePath === "./.codex/plugins/zc-toolkit";
}

function parsePersonalMarketplace(content: string, path: string): Record<string, unknown> & {
  plugins: unknown[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知 JSON 错误";
    throw new Error(`Codex personal marketplace 格式无效：${path}（${reason}）`);
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.plugins)) {
    throw new Error(`Codex personal marketplace 格式无效：${path}`);
  }
  return parsed as Record<string, unknown> & { plugins: unknown[] };
}

function renderMarketplaceWithoutLegacyEntries(content: string, path: string): string | null {
  const marketplace = parsePersonalMarketplace(content, path);
  if (marketplace.name !== "zc-toolkit") {
    throw new Error(`Codex personal marketplace 名称不匹配：${path}`);
  }
  const plugins = marketplace.plugins.filter((plugin) => !isLegacyPersonalMarketplaceEntry(plugin));
  if (plugins.length === marketplace.plugins.length) {
    throw new Error(`Codex personal marketplace 不再包含受管旧插件条目：${path}`);
  }
  if (plugins.length === 0) {
    return null;
  }
  return `${JSON.stringify({ ...marketplace, plugins }, null, 2)}\n`;
}

async function writeFileAtomically(path: string, content: string): Promise<void> {
  const temporaryPath = `${path}.zc-migration-${process.pid}-${Date.now()}.tmp`;
  try {
    await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function backupPersonalMarketplace(
  pluginPath: string,
  pluginBackupPath: string,
): Promise<CodexLegacyPersonalMarketplaceBackup | undefined> {
  const originalPath = resolveCodexLegacyPersonalMarketplacePath(pluginPath);
  if (!(await pathExists(originalPath))) {
    return undefined;
  }
  const content = await readFile(originalPath, "utf8");
  const marketplace = parsePersonalMarketplace(content, originalPath);
  if (marketplace.name !== "zc-toolkit") {
    return undefined;
  }
  const legacyEntryCount = marketplace.plugins.filter(isLegacyPersonalMarketplaceEntry).length;
  if (legacyEntryCount === 0) {
    return undefined;
  }
  const backupPath = `${pluginBackupPath}.personal-marketplace.json`;
  await copyFile(originalPath, backupPath, constants.COPYFILE_EXCL);
  return {
    originalPath,
    backupPath,
    legacyEntryCount,
  };
}

async function detachPersonalMarketplace(
  backup: CodexLegacyPersonalMarketplaceBackup,
): Promise<void> {
  const [currentContent, backupContent] = await Promise.all([
    readFile(backup.originalPath, "utf8"),
    readFile(backup.backupPath, "utf8"),
  ]);
  if (currentContent !== backupContent) {
    throw new Error(`拒绝迁移已发生变化的 Codex personal marketplace：${backup.originalPath}`);
  }
  const detachedContent = renderMarketplaceWithoutLegacyEntries(backupContent, backup.originalPath);
  if (detachedContent === null) {
    await rm(backup.originalPath, { force: false });
    return;
  }
  await writeFileAtomically(backup.originalPath, detachedContent);
}

async function restorePersonalMarketplace(
  backup: CodexLegacyPersonalMarketplaceBackup,
): Promise<void> {
  const backupContent = await readFile(backup.backupPath, "utf8");
  const detachedContent = renderMarketplaceWithoutLegacyEntries(backupContent, backup.originalPath);
  if (detachedContent === null) {
    if (await pathExists(backup.originalPath)) {
      throw new Error(`无法恢复 Codex personal marketplace：目标文件已重新出现 ${backup.originalPath}`);
    }
  } else {
    const currentContent = await readFile(backup.originalPath, "utf8");
    if (currentContent !== detachedContent) {
      throw new Error(`无法恢复已发生变化的 Codex personal marketplace：${backup.originalPath}`);
    }
  }
  await mkdir(pathApi(backup.originalPath).dirname(backup.originalPath), { recursive: true });
  await writeFileAtomically(backup.originalPath, backupContent);
  await rm(backup.backupPath, { force: false });
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
  const personalMarketplace = await backupPersonalMarketplace(pluginPath, backupPath);
  return {
    originalPath: pluginPath,
    backupPath,
    copied: true,
    ...(personalMarketplace ? { personalMarketplace } : {}),
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
  if (
    backup.personalMarketplace
    && !isOwnedPersonalMarketplaceBackup(backup, backup.personalMarketplace)
  ) {
    throw new Error(
      `拒绝使用非受管 Codex personal marketplace 备份：${backup.personalMarketplace.backupPath}`,
    );
  }
  if (!(await pathExists(backup.backupPath))) {
    throw new Error(`拒绝移除 Codex 旧插件：备份目录不存在 ${backup.backupPath}`);
  }
  await assertDirectory(backup.backupPath, "Codex 旧插件备份路径");
  let pluginDetached = false;
  if (await pathExists(backup.originalPath)) {
    await assertDirectory(backup.originalPath, "Codex 旧插件路径");
    await rm(backup.originalPath, { recursive: true, force: false });
    pluginDetached = true;
  }
  if (backup.personalMarketplace) {
    await detachPersonalMarketplace(backup.personalMarketplace);
  }
  return pluginDetached || Boolean(backup.personalMarketplace);
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
  if (
    backup.personalMarketplace
    && !isOwnedPersonalMarketplaceBackup(backup, backup.personalMarketplace)
  ) {
    throw new Error(
      `拒绝使用非受管 Codex personal marketplace 备份：${backup.personalMarketplace.backupPath}`,
    );
  }
  if (!(await pathExists(backup.backupPath))) {
    throw new Error(`无法恢复 Codex 旧插件：备份目录不存在 ${backup.backupPath}`);
  }
  await assertDirectory(backup.backupPath, "Codex 旧插件备份路径");
  if (await pathExists(backup.originalPath)) {
    throw new Error(`无法恢复 Codex 旧插件：原目录已重新出现 ${backup.originalPath}`);
  }

  await rename(backup.backupPath, backup.originalPath);
  if (backup.personalMarketplace) {
    await restorePersonalMarketplace(backup.personalMarketplace);
  }
}
