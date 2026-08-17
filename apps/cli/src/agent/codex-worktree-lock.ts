import { createHash, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { open, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

interface GitRecoveryClaim {
  readonly ref: string;
  readonly token: string;
}

interface CodexWorktreeLeaseLockOptions {
  readonly repoRoot: string;
  readonly lockPath: string;
  readonly staleAfterMs: number;
  readonly now: () => Date;
  readonly runGit: (cwd: string, args: readonly string[]) => Promise<string>;
}

export interface CodexWorktreeLeaseLock {
  release(): Promise<void>;
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isNodeError(error, "ESRCH");
  }
}

function isRecoverableLockSnapshot(
  snapshot: string,
  snapshotStat: Stats,
  now: Date,
  staleAfterMs: number,
): boolean {
  if (now.getTime() - snapshotStat.mtimeMs < staleAfterMs) return false;

  let parsed: { schemaVersion?: unknown; pid?: unknown; createdAt?: unknown };
  try {
    parsed = JSON.parse(snapshot) as typeof parsed;
  } catch {
    return true;
  }

  const hasUsablePid = typeof parsed.pid === "number"
    && Number.isSafeInteger(parsed.pid)
    && parsed.pid > 0;
  if (hasUsablePid && isProcessAlive(parsed.pid as number)) return false;

  if (
    parsed.schemaVersion !== 1
    || !hasUsablePid
    || typeof parsed.createdAt !== "string"
    || !Number.isFinite(Date.parse(parsed.createdAt))
  ) {
    return true;
  }

  return true;
}

async function gitSucceeds(
  options: CodexWorktreeLeaseLockOptions,
  args: readonly string[],
): Promise<boolean> {
  try {
    await options.runGit(options.repoRoot, args);
    return true;
  } catch {
    return false;
  }
}

async function inspectLockDisposition(
  options: CodexWorktreeLeaseLockOptions,
): Promise<"active" | "stale" | "missing"> {
  try {
    const [snapshot, snapshotStat] = await Promise.all([
      readFile(options.lockPath, "utf8"),
      stat(options.lockPath),
    ]);
    return isRecoverableLockSnapshot(
      snapshot,
      snapshotStat,
      options.now(),
      options.staleAfterMs,
    ) ? "stale" : "active";
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return "missing";
    throw error;
  }
}

async function createRecoveryClaimToken(
  options: CodexWorktreeLeaseLockOptions,
): Promise<string> {
  const candidatePath = join(
    dirname(options.lockPath),
    `.recovery-claim.${randomUUID()}.json`,
  );
  const payload = {
    schemaVersion: 1,
    pid: process.pid,
    createdAt: options.now().toISOString(),
    nonce: randomUUID(),
    lockFingerprint: createHash("sha256").update(options.lockPath, "utf8").digest("hex"),
  };

  await writeFile(candidatePath, `${JSON.stringify(payload)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    return await options.runGit(options.repoRoot, ["hash-object", "-w", candidatePath]);
  } finally {
    await unlink(candidatePath).catch((error: unknown) => {
      if (!isNodeError(error, "ENOENT")) throw error;
    });
  }
}

async function acquireRecoveryClaim(
  options: CodexWorktreeLeaseLockOptions,
): Promise<GitRecoveryClaim | undefined> {
  const claimRef = `refs/zc/agent-lock-recovery/${createHash("sha256")
    .update(options.lockPath, "utf8")
    .digest("hex")}`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let existingToken: string | undefined;
    try {
      existingToken = await options.runGit(options.repoRoot, ["rev-parse", "--verify", claimRef]);
    } catch {
      // No claim is currently published.
    }

    if (existingToken) {
      let existingClaim: { pid?: unknown; createdAt?: unknown } | undefined;
      try {
        existingClaim = JSON.parse(
          await options.runGit(options.repoRoot, ["cat-file", "blob", existingToken]),
        ) as typeof existingClaim;
      } catch {
        // A malformed internal claim is safe to remove with update-ref CAS.
      }
      const createdAt = typeof existingClaim?.createdAt === "string"
        ? Date.parse(existingClaim.createdAt)
        : Number.NaN;
      const pid = existingClaim?.pid;
      const claimIsStale = !Number.isFinite(createdAt)
        || typeof pid !== "number"
        || !Number.isSafeInteger(pid)
        || pid <= 0
        || (
          options.now().getTime() - createdAt >= options.staleAfterMs
          && !isProcessAlive(pid)
        );

      if (!claimIsStale) return undefined;
      if (await gitSucceeds(options, ["update-ref", "-d", claimRef, existingToken])) continue;
      return undefined;
    }

    const token = await createRecoveryClaimToken(options);
    if (await gitSucceeds(options, ["update-ref", claimRef, token, ""])) {
      return { ref: claimRef, token };
    }
  }

  return undefined;
}

async function unlinkLockSnapshotIfUnchanged(
  lockPath: string,
  snapshot: string,
  snapshotStat: Stats,
): Promise<boolean> {
  try {
    const [current, currentStat] = await Promise.all([
      readFile(lockPath, "utf8"),
      stat(lockPath),
    ]);
    if (
      current !== snapshot
      || currentStat.dev !== snapshotStat.dev
      || currentStat.ino !== snapshotStat.ino
      || currentStat.mtimeMs !== snapshotStat.mtimeMs
      || currentStat.size !== snapshotStat.size
    ) {
      return false;
    }
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return true;
    throw error;
  }
}

async function recoverStaleLockUnderClaim(
  options: CodexWorktreeLeaseLockOptions,
): Promise<boolean> {
  let snapshot: string;
  let snapshotStat: Stats;
  try {
    [snapshot, snapshotStat] = await Promise.all([
      readFile(options.lockPath, "utf8"),
      stat(options.lockPath),
    ]);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return true;
    throw error;
  }

  if (!isRecoverableLockSnapshot(
    snapshot,
    snapshotStat,
    options.now(),
    options.staleAfterMs,
  )) return false;

  return unlinkLockSnapshotIfUnchanged(options.lockPath, snapshot, snapshotStat);
}

async function recoverStaleLock(
  options: CodexWorktreeLeaseLockOptions,
): Promise<boolean> {
  const disposition = await inspectLockDisposition(options);
  if (disposition === "missing") return true;
  if (disposition === "active") return false;
  const claim = await acquireRecoveryClaim(options);
  if (!claim) return false;

  try {
    return await recoverStaleLockUnderClaim(options);
  } finally {
    await gitSucceeds(options, ["update-ref", "-d", claim.ref, claim.token]);
  }
}

export async function acquireCodexWorktreeLeaseLock(
  options: CodexWorktreeLeaseLockOptions,
): Promise<CodexWorktreeLeaseLock> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const handle = await open(options.lockPath, "wx");
      try {
        await handle.writeFile(`${JSON.stringify({
          schemaVersion: 1,
          pid: process.pid,
          createdAt: options.now().toISOString(),
        })}\n`, "utf8");
      } catch (error) {
        await handle.close();
        await unlink(options.lockPath).catch(() => {});
        throw error;
      }

      let released = false;
      return {
        async release(): Promise<void> {
          if (released) return;
          released = true;
          await handle.close();
          await unlink(options.lockPath).catch((error: unknown) => {
            if (!isNodeError(error, "ENOENT")) throw error;
          });
        },
      };
    } catch (error) {
      if (!isNodeError(error, "EEXIST")) throw error;
      if (await recoverStaleLock(options)) continue;
      await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    }
  }

  throw new Error(`Timed out waiting for Codex worktree lease lock: ${options.lockPath}`);
}
