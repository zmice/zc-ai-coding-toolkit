import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

type ParentSnapshot = {
  readonly resolved: string;
  readonly anchor: string;
  readonly dev: number;
  readonly ino: number;
};
type Snapshot = { readonly path: string; readonly content: Buffer | null; readonly parent: ParentSnapshot };

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

/** The lock covers inspection and preflight as well as mutation and rollback. */
export async function withCodexTargetLock<T>(
  root: string,
  work: () => Promise<T>,
  options: { readonly createRoot?: boolean } = {},
): Promise<T> {
  if (options.createRoot) await mkdir(resolve(root), { recursive: true });
  const canonicalRoot = await realpath(resolve(root));
  const lockDir = join(canonicalRoot, ".zc-codex-config.lock");
  const ownerPath = join(lockDir, "owner.json");
  const nonce = randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(lockDir);
      acquired = true;
      break;
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      await new Promise<void>((done) => setTimeout(done, 50));
    }
  }
  if (!acquired) {
    let owner = "owner unavailable";
    try { owner = (await readFile(ownerPath, "utf8")).replace(/[\r\n\t]/gu, " ").slice(0, 400); }
    catch { /* A missing owner file is itself an uncertain lock state. */ }
    throw new Error(`Codex 配置锁仍被占用：${lockDir}；${owner}。未执行本次操作；请核对 owner 进程与目标目录后手动恢复，程序不会自动抢锁。`);
  }
  let workError: unknown;
  try {
    await writeFile(ownerPath, JSON.stringify({ pid: process.pid, nonce, target: canonicalRoot, acquiredAt: new Date().toISOString() }), { flag: "wx" });
    return await work();
  } catch (error) {
    workError = error;
    throw error;
  } finally {
    try {
      const owner = JSON.parse(await readFile(ownerPath, "utf8")) as { nonce?: string };
      if (owner.nonce !== nonce) throw new Error(`Codex 配置锁 owner 已改变：${ownerPath}`);
      await rm(ownerPath);
      await rmdir(lockDir);
    } catch (cleanupError) {
      if (workError) throw new AggregateError([workError, cleanupError], `Codex 操作失败且配置锁未能安全释放：${lockDir}`);
      throw cleanupError;
    }
  }
}

async function snapshot(path: string): Promise<Snapshot> {
  const parent = await resolvedParent(path);
  try {
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new Error(`Codex agent transaction target is not a regular file: ${path}`);
    }
    return { path, content: await readFile(path), parent };
  } catch (error) {
    if (isMissing(error)) return { path, content: null, parent };
    throw error;
  }
}

async function resolvedParent(path: string): Promise<ParentSnapshot> {
  let candidate = dirname(resolve(path));
  const missing: string[] = [];
  while (true) {
    try {
      const resolved = await realpath(candidate);
      const identity = await stat(candidate);
      return {
        resolved: resolve(resolved, ...missing),
        anchor: candidate,
        dev: identity.dev,
        ino: identity.ino,
      };
    } catch (error) {
      if (!isMissing(error)) throw error;
      const above = dirname(candidate);
      if (above === candidate) throw error;
      missing.unshift(basename(candidate));
      candidate = above;
    }
  }
}

function samePath(a: string, b: string): boolean {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

async function restore(saved: Snapshot): Promise<void> {
  const currentParent = await resolvedParent(saved.path);
  const originalAnchor = await stat(saved.parent.anchor);
  if (
    !samePath(saved.parent.resolved, currentParent.resolved)
    || originalAnchor.dev !== saved.parent.dev
    || originalAnchor.ino !== saved.parent.ino
  ) {
    throw new Error(`Rollback verification failed: ${saved.path} parent was redirected.`);
  }
  const current = await snapshot(saved.path);
  if (
    (saved.content === null && current.content === null)
    || (saved.content !== null && current.content !== null && current.content.equals(saved.content))
  ) {
    return;
  }
  if (saved.content === null) {
    await rm(saved.path, { force: true });
    try {
      await readFile(saved.path);
      throw new Error(`Rollback verification failed: ${saved.path} still exists.`);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return;
  }
  await writeFile(saved.path, saved.content);
  if (!(await readFile(saved.path)).equals(saved.content)) {
    throw new Error(`Rollback verification failed: ${saved.path} differs from its snapshot.`);
  }
}

// Covers ordinary write failures only. An interrupted process may require manual recovery.
export async function withCodexAgentConfigReceiptRollback<T>(
  artifactPaths: readonly string[],
  receiptPath: string,
  write: () => Promise<T>,
): Promise<T> {
  const paths = [...new Set([...artifactPaths, receiptPath])];
  const before = await Promise.all(paths.map(snapshot));
  try {
    return await write();
  } catch (writeError) {
    const restoreErrors: unknown[] = [];
    for (const saved of before) {
      try {
        await restore(saved);
      } catch (error) {
        restoreErrors.push(error);
      }
    }
    if (restoreErrors.length > 0) {
      const reason = writeError instanceof Error
        ? writeError.message.replace(/[\r\n\t]/g, " ").slice(0, 300)
        : "unknown write error";
      throw new AggregateError(
        [writeError, ...restoreErrors],
        `Codex agent sync failed (${reason}) and artifact/receipt rollback could not be verified: ${paths.join(", ")}`,
      );
    }
    throw writeError;
  }
}
