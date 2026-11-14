import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdtemp, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const maxSnapshotBytes = 128 * 1024 * 1024;
const maxSnapshotEntries = 5000;

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function within(root: string, path: string): boolean {
  const suffix = relative(root, path);
  return suffix.length > 0 && suffix !== ".." && !suffix.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(suffix);
}

type Fingerprint = { readonly digest: string; readonly bytes: number; readonly entries: number } | null;

async function fingerprint(path: string): Promise<Fingerprint> {
  try { await lstat(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
  const hash = createHash("sha256");
  let bytes = 0;
  let entries = 0;
  async function visit(current: string, name: string): Promise<void> {
    const info = await lstat(current);
    if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
      throw new Error(`Codex 卸载目标包含链接或特殊文件：${current}`);
    }
    entries += 1;
    if (entries > maxSnapshotEntries) throw new Error(`Codex 卸载快照超过 ${maxSnapshotEntries} 个条目：${path}`);
    const nameBytes = Buffer.byteLength(name);
    hash.update(`${info.isDirectory() ? "d" : "f"}:${nameBytes}:${name}:`);
    if (info.isDirectory()) {
      for (const child of (await readdir(current)).sort()) await visit(join(current, child), `${name}/${child}`);
      return;
    }
    bytes += info.size;
    if (bytes > maxSnapshotBytes) throw new Error(`Codex 卸载快照超过 ${maxSnapshotBytes} 字节：${path}`);
    const content = await readFile(current);
    if (content.length !== info.size) throw new Error(`Codex 卸载目标在读取期间发生变化：${current}`);
    hash.update(`${content.length}:`);
    hash.update(content);
  }
  await visit(path, "");
  return { digest: hash.digest("hex"), bytes, entries };
}

function same(a: Fingerprint, b: Fingerprint): boolean { return a?.digest === b?.digest; }

interface ParentIdentity { readonly path: string; readonly real: string; readonly dev: number; readonly ino: number }
interface SavedTarget {
  readonly path: string;
  readonly backup: string | null;
  readonly before: Fingerprint;
  readonly parent: ParentIdentity;
  after?: Fingerprint;
}

async function checkRestoreParent(target: SavedTarget, lexicalRoot: string, canonicalRoot: string): Promise<void> {
  if ((await realpath(lexicalRoot)) !== canonicalRoot) throw new Error(`Codex 卸载根目录已改变：${lexicalRoot}`);
  const parentPath = target.parent.path;
  const real = await realpath(parentPath);
  const info = await lstat(parentPath);
  if (info.isSymbolicLink() || !within(canonicalRoot, real) && real !== canonicalRoot
    || real !== target.parent.real || info.dev !== target.parent.dev || info.ino !== target.parent.ino) {
    throw new Error(`Codex 卸载恢复目标父目录已改变：${parentPath}`);
  }
  let candidate = dirname(target.path);
  while (candidate !== parentPath && within(parentPath, candidate)) {
    try {
      const entry = await lstat(candidate);
      if (entry.isSymbolicLink()) throw new Error(`Codex 卸载恢复目标父目录是链接：${candidate}`);
    } catch (error) { if (!isMissing(error)) throw error; }
    candidate = dirname(candidate);
  }
}

interface ManifestTarget { readonly path: string; readonly index: number | null; readonly digest: string | null; readonly bytes: number }
interface BackupIdentity {
  readonly dev: number;
  readonly ino: number;
  readonly transactionId: string;
  readonly root: string;
  readonly targets: readonly ManifestTarget[];
}

async function checkBackup(backupRoot: string, canonicalRoot: string, identity: BackupIdentity): Promise<void> {
  if (!within(canonicalRoot, backupRoot)) throw new Error(`Codex 卸载恢复目录越界：${backupRoot}`);
  const info = await lstat(backupRoot);
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(backupRoot) !== backupRoot
    || info.dev !== identity.dev || info.ino !== identity.ino) {
    throw new Error(`Codex 卸载恢复目录已改变：${backupRoot}`);
  }
  const manifestPath = join(backupRoot, "manifest.json");
  if ((await lstat(manifestPath)).isSymbolicLink()) throw new Error(`Codex 卸载恢复清单是链接：${manifestPath}`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    transactionId?: string; root?: string; targets?: unknown;
  };
  if (manifest.transactionId !== identity.transactionId || manifest.root !== identity.root
    || JSON.stringify(manifest.targets) !== JSON.stringify(identity.targets)) {
    throw new Error(`Codex 卸载恢复清单已改变：${backupRoot}`);
  }
}

async function removeBackup(backupRoot: string, canonicalRoot: string, identity: BackupIdentity): Promise<void> {
  await checkBackup(backupRoot, canonicalRoot, identity);
  await rm(backupRoot, { recursive: true });
}

export type ExpectedUninstallState = { readonly kind: "absent" } | { readonly kind: "file-content"; readonly content: string };

/** Covers ordinary failures. Backup is retained if rollback cannot safely prove ownership. */
export async function withCodexPluginUninstallRollback<T>(
  root: string,
  paths: readonly string[],
  work: (acknowledge: (path: string, expected: ExpectedUninstallState) => Promise<void>) => Promise<T>,
): Promise<T> {
  const lexicalRoot = resolve(root);
  const canonicalRoot = await realpath(lexicalRoot);
  const unique = [...new Set(paths.map((path) => resolve(path)))];
  const targets: SavedTarget[] = [];
  let snapshotBytes = 0;
  let snapshotEntries = 0;
  for (const path of unique) {
    if (!within(lexicalRoot, path)) throw new Error(`Codex 卸载目标不在选定目录内：${path}`);
    let parent = dirname(path);
    while (parent !== lexicalRoot && within(lexicalRoot, parent)) {
      try {
        const info = await lstat(parent);
        if (info.isSymbolicLink()) throw new Error(`Codex 卸载目标的父目录是链接：${parent}`);
      } catch (error) { if (!isMissing(error)) throw error; }
      parent = dirname(parent);
    }
    const before = await fingerprint(path);
    snapshotBytes += before?.bytes ?? 0;
    snapshotEntries += before?.entries ?? 0;
    if (snapshotBytes > maxSnapshotBytes || snapshotEntries > maxSnapshotEntries) {
      throw new Error(`Codex 卸载快照总量超过上限：${snapshotBytes} 字节、${snapshotEntries} 个条目`);
    }
    let anchor = dirname(path);
    while (true) {
      try { await lstat(anchor); break; }
      catch (error) { if (!isMissing(error)) throw error; }
      if (anchor === lexicalRoot) throw new Error(`Codex 卸载根目录不存在：${lexicalRoot}`);
      anchor = dirname(anchor);
    }
    const resolvedParent = await realpath(anchor);
    const parentInfo = await lstat(anchor);
    if (parentInfo.isSymbolicLink() || !within(canonicalRoot, resolvedParent) && resolvedParent !== canonicalRoot) {
      throw new Error(`Codex 卸载目标父目录越界：${path}`);
    }
    const parentIdentity: ParentIdentity = { path: anchor, real: resolvedParent, dev: parentInfo.dev, ino: parentInfo.ino };
    targets.push({ path, before, backup: null, parent: parentIdentity });
  }
  // A parent and child must never be restored independently.
  for (const left of unique) for (const right of unique) {
    if (left !== right && within(left, right)) throw new Error(`Codex 卸载目标重叠：${left}、${right}`);
  }
  const backupRoot = await mkdtemp(join(canonicalRoot, ".zc-plugin-uninstall-"));
  const backupInfo = await lstat(backupRoot);
  const backupIdentity: BackupIdentity = {
    dev: backupInfo.dev, ino: backupInfo.ino, transactionId: randomUUID(), root: canonicalRoot,
    targets: targets.map((target, index) => ({
      path: target.path, index: target.before ? index : null,
      digest: target.before?.digest ?? null, bytes: target.before?.bytes ?? 0,
    })),
  };
  const manifestPath = join(backupRoot, "manifest.json");
  const writeManifest = async (phase: string): Promise<void> => {
    const info = await lstat(backupRoot);
    if (!info.isDirectory() || info.isSymbolicLink() || info.dev !== backupIdentity.dev || info.ino !== backupIdentity.ino) {
      throw new Error(`Codex 卸载恢复目录已改变：${backupRoot}`);
    }
    const temporary = join(backupRoot, `.manifest-${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify({
      schemaVersion: 1, transactionId: backupIdentity.transactionId, root: canonicalRoot,
      phase, targets: backupIdentity.targets,
    }, null, 2), { flag: "wx" });
    await rename(temporary, manifestPath);
  };
  await writeManifest("snapshotting");
  try {
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      if (!target.before) continue;
      const backup = join(backupRoot, String(index));
      await checkRestoreParent(target, lexicalRoot, canonicalRoot);
      await cp(target.path, backup, { recursive: true, force: false, errorOnExist: true, dereference: false });
      if (!same(target.before, await fingerprint(backup)) || !same(target.before, await fingerprint(target.path))) {
        throw new Error(`Codex 卸载目标在备份期间发生变化：${target.path}`);
      }
      targets[index] = { ...target, backup };
    }
    await writeManifest("prepared");
  } catch (error) {
    try { await removeBackup(backupRoot, canonicalRoot, backupIdentity); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], `Codex 卸载未开始，预检快照清理失败：${backupRoot}`); }
    throw error;
  }
  let result: T;
  try {
    await writeManifest("mutating");
    result = await work(async (path, expected) => {
      const target = targets.find((item) => item.path === resolve(path));
      if (!target) throw new Error(`Codex 卸载未登记变更目标：${path}`);
      await checkRestoreParent(target, lexicalRoot, canonicalRoot);
      const actual = await fingerprint(target.path);
      if (expected.kind === "absent") {
        if (actual !== null) throw new Error(`Codex 卸载目标仍存在或被重新创建：${path}`);
      } else {
        if (actual === null || await readFile(target.path, "utf8") !== expected.content) {
          throw new Error(`Codex 卸载配置与预期写入不一致：${path}`);
        }
      }
      target.after = actual;
    });
  } catch (cause) {
    try { await checkBackup(backupRoot, canonicalRoot, backupIdentity); await writeManifest("restoring"); }
    catch (error) { throw new AggregateError([cause, error], `Codex 卸载失败，恢复目录已改变；保留现场：${backupRoot}`); }
    const restoreErrors: unknown[] = [];
    for (const target of targets) {
      try {
        await checkRestoreParent(target, lexicalRoot, canonicalRoot);
        const current = await fingerprint(target.path);
        if (same(current, target.before)) continue;
        if (target.after === undefined || !same(current, target.after)) {
          throw new Error(`卸载后目标出现其他改动，保留恢复副本：${target.path}`);
        }
        await checkRestoreParent(target, lexicalRoot, canonicalRoot);
        if (current) await rm(target.path, { recursive: true });
        await checkRestoreParent(target, lexicalRoot, canonicalRoot);
        if (target.backup) {
          await checkBackup(backupRoot, canonicalRoot, backupIdentity);
          if (!same(target.before, await fingerprint(target.backup))) throw new Error(`Codex 卸载恢复副本已改变：${target.backup}`);
          await cp(target.backup, target.path, { recursive: true, force: false, errorOnExist: true, dereference: false });
        }
        if (!same(target.before, await fingerprint(target.path))) throw new Error(`Codex 卸载恢复校验失败：${target.path}`);
      } catch (error) { restoreErrors.push(error); }
    }
    if (restoreErrors.length === 0) {
      try { await removeBackup(backupRoot, canonicalRoot, backupIdentity); }
      catch (error) { restoreErrors.push(error); }
    }
    if (restoreErrors.length > 0) {
      try { await writeManifest("recovery-required"); } catch { /* Preserve original restore evidence. */ }
      throw new AggregateError([cause, ...restoreErrors], `Codex 卸载失败且自动恢复不完整；恢复副本保留在 ${backupRoot}，请人工核对。`);
    }
    throw cause;
  }
  // Commit has already happened. Backup cleanup errors must never trigger rollback.
  try { await writeManifest("committed"); await removeBackup(backupRoot, canonicalRoot, backupIdentity); }
  catch (error) { throw new Error(`Codex 卸载已完成，但恢复副本清理失败：${backupRoot}`, { cause: error }); }
  return result;
}
