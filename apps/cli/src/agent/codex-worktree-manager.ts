import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  lstat,
  mkdir,
  readFile,
  realpath,
  rename,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { acquireCodexWorktreeLeaseLock } from "./codex-worktree-lock.js";

const execFileAsync = promisify(execFile);
const identifierPattern = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const windowsReservedIdentifierPattern = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const terminalAgentStates = new Set<CodexAgentState>(["completed", "failed", "interrupted"]);

export type CodexAgentTerminalState = "completed" | "failed" | "interrupted";
export type CodexAgentState =
  | CodexAgentTerminalState
  | "running"
  | "blocked"
  | "missing";
export type CodexAgentWorktreeState =
  | "allocating"
  | "ready"
  | "cleanup-blocked"
  | "released-with-branch"
  | "orphaned";

export interface CodexAgentWorktreeLease {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly taskId: string;
  readonly repoRoot: string;
  readonly commonGitDir: string;
  readonly path: string;
  readonly branch: string;
  readonly baseCommit: string;
  readonly headCommit: string;
  readonly sourceDirty: boolean;
  readonly sourceChanges: readonly string[];
  readonly dirtySourceAcknowledged: boolean;
  readonly state: CodexAgentWorktreeState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly receiptPath: string;
}

export interface CodexAgentWorktreeCleanupPlan {
  readonly runId: string;
  readonly taskId: string;
  readonly status: "ready" | "blocked" | "orphaned";
  readonly blockers: readonly string[];
  readonly agentState: CodexAgentState;
  readonly fanInCollected: boolean;
  readonly headCommit: string;
  readonly baseCommit: string;
  readonly branch: string;
  readonly path: string;
  readonly receiptPath: string;
  readonly fingerprint: string;
}

export interface CodexAgentWorktreePreparePlan {
  readonly status: "ready" | "blocked";
  readonly blockers: readonly string[];
  readonly dryRun: true;
  readonly runId: string;
  readonly taskId: string;
  readonly repoRoot: string;
  readonly path: string;
  readonly branch: string;
  readonly baseCommit: string;
  readonly sourceDirty: boolean;
  readonly sourceChanges: readonly string[];
  readonly dirtySourceAcknowledged: boolean;
  readonly receiptPath: string;
}

export interface CodexAgentWorktreeCleanupResult {
  readonly status: "released" | "released-with-branch";
  readonly path: string;
  readonly branch: string;
  readonly branchPreserved: boolean;
  readonly receiptPath: string;
}

export type CodexAgentWorktreeRecoveryAction =
  | "promote-ready"
  | "release-metadata"
  | "delete-merged-branch"
  | "none";

export interface CodexAgentWorktreeRecoveryPlan {
  readonly runId: string;
  readonly taskId: string;
  readonly status: "ready" | "blocked";
  readonly action: CodexAgentWorktreeRecoveryAction;
  readonly blockers: readonly string[];
  readonly state: CodexAgentWorktreeState;
  readonly path: string;
  readonly branch: string;
  readonly receiptPath: string;
  readonly fingerprint: string;
}

export interface CodexAgentWorktreeRecoveryResult {
  readonly status: "ready" | "released";
  readonly action: Exclude<CodexAgentWorktreeRecoveryAction, "none">;
  readonly path: string;
  readonly branch: string;
  readonly receiptPath: string;
}

interface CodexAgentWorktreeReceipt extends Omit<CodexAgentWorktreeLease, "receiptPath"> {}

interface GitWorktreeEntry {
  readonly path: string;
  readonly head?: string;
  readonly branch?: string;
}

interface RepositoryContext {
  readonly repoRoot: string;
  readonly commonGitDir: string;
  readonly tempRoot: string;
  readonly managedRoot: string;
  readonly repoWorktreeRoot: string;
  readonly receiptRoot: string;
}

interface LeasePaths {
  readonly path: string;
  readonly receiptPath: string;
  readonly lockPath: string;
}

export interface CodexAgentWorktreeManagerOptions {
  readonly repoRoot: string;
  readonly tempRoot?: string;
  readonly codexHome?: string;
  readonly lockStaleAfterMs?: number;
  readonly now?: () => Date;
}

function validateIdentifier(value: string, fieldName: string): void {
  if (
    !identifierPattern.test(value)
    || windowsReservedIdentifierPattern.test(value)
    || isAbsolute(value)
  ) {
    throw new Error(`${fieldName} must be a safe worktree identifier`);
  }
}

function assertOwnedPath(parent: string, candidate: string, label: string): void {
  const pathFromParent = relative(parent, candidate);

  if (pathFromParent.length === 0 || pathFromParent.startsWith("..") || isAbsolute(pathFromParent)) {
    throw new Error(`${label} is outside the managed root`);
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

async function canonicalizePotentialPath(path: string): Promise<string> {
  let current = resolve(path);
  const missingSegments: string[] = [];

  while (!(await pathExists(current))) {
    const parent = dirname(current);
    if (parent === current) break;
    missingSegments.unshift(basename(current));
    current = parent;
  }

  return join(await realpath(current), ...missingSegments);
}

async function assertSymlinkFreeOwnedPath(
  anchor: string,
  ownedRoot: string,
  candidate: string,
  label: string,
): Promise<void> {
  const canonicalAnchor = await realpath(anchor);
  const resolvedOwnedRoot = resolve(ownedRoot);
  const resolvedCandidate = resolve(candidate);
  const ownedRootFromAnchor = relative(canonicalAnchor, resolvedOwnedRoot);

  if (
    ownedRootFromAnchor.startsWith("..")
    || isAbsolute(ownedRootFromAnchor)
  ) {
    throw new Error(`${label} root is outside its trusted anchor`);
  }
  assertOwnedPath(resolvedOwnedRoot, resolvedCandidate, label);

  const candidateFromAnchor = relative(canonicalAnchor, resolvedCandidate);
  if (
    candidateFromAnchor.length === 0
    || candidateFromAnchor.startsWith("..")
    || isAbsolute(candidateFromAnchor)
  ) {
    throw new Error(`${label} is outside its trusted anchor`);
  }

  let current = canonicalAnchor;
  for (const segment of candidateFromAnchor.split(/[\\/]+/u)) {
    current = join(current, segment);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) {
        throw new Error(`${label} contains a symlink: ${current}`);
      }
    } catch (error) {
      if (isNodeError(error, "ENOENT")) break;
      throw error;
    }
  }

  const [canonicalOwnedRoot, canonicalCandidate] = await Promise.all([
    canonicalizePotentialPath(resolvedOwnedRoot),
    canonicalizePotentialPath(resolvedCandidate),
  ]);
  assertOwnedPath(canonicalOwnedRoot, canonicalCandidate, label);
}

async function runGit(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout.trim();
}

async function gitSucceeds(cwd: string, args: readonly string[]): Promise<boolean> {
  try {
    await runGit(cwd, args);
    return true;
  } catch {
    return false;
  }
}

async function readSourceChanges(repoRoot: string): Promise<readonly string[]> {
  const sourceStatus = await runGit(repoRoot, [
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ".",
    ":(exclude).codex/work/agent-runs/**",
  ]);
  return sourceStatus.length > 0 ? sourceStatus.split("\n") : [];
}

function parseWorktreeList(output: string): readonly GitWorktreeEntry[] {
  if (output.trim().length === 0) {
    return [];
  }

  return output.trim().split(/\n\n+/u).map((block) => {
    const entry: { path?: string; head?: string; branch?: string } = {};

    for (const line of block.split("\n")) {
      const separator = line.indexOf(" ");
      const key = separator < 0 ? line : line.slice(0, separator);
      const value = separator < 0 ? "" : line.slice(separator + 1);

      if (key === "worktree") entry.path = value;
      if (key === "HEAD") entry.head = value;
      if (key === "branch") entry.branch = value;
    }

    if (!entry.path) {
      throw new Error("git worktree list returned an entry without a path");
    }

    return {
      path: resolve(entry.path),
      ...(entry.head ? { head: entry.head } : {}),
      ...(entry.branch ? { branch: entry.branch } : {}),
    };
  });
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function parseReceipt(source: string, receiptPath: string): CodexAgentWorktreeReceipt {
  const parsed = JSON.parse(source) as Partial<CodexAgentWorktreeReceipt>;
  const validStates = new Set<CodexAgentWorktreeState>([
    "allocating",
    "ready",
    "cleanup-blocked",
    "released-with-branch",
    "orphaned",
  ]);

  if (
    parsed.schemaVersion !== 1
    || typeof parsed.runId !== "string"
    || typeof parsed.taskId !== "string"
    || typeof parsed.repoRoot !== "string"
    || typeof parsed.commonGitDir !== "string"
    || typeof parsed.path !== "string"
    || typeof parsed.branch !== "string"
    || typeof parsed.baseCommit !== "string"
    || typeof parsed.headCommit !== "string"
    || typeof parsed.sourceDirty !== "boolean"
    || !Array.isArray(parsed.sourceChanges)
    || !parsed.sourceChanges.every((change) => typeof change === "string")
    || typeof parsed.dirtySourceAcknowledged !== "boolean"
    || typeof parsed.state !== "string"
    || !validStates.has(parsed.state as CodexAgentWorktreeState)
    || typeof parsed.createdAt !== "string"
    || typeof parsed.updatedAt !== "string"
  ) {
    throw new Error(`Invalid Codex worktree receipt: ${receiptPath}`);
  }

  return parsed as CodexAgentWorktreeReceipt;
}

export class CodexAgentWorktreeManager {
  readonly #requestedRepoRoot: string;
  readonly #tempRoot: string;
  readonly #codexHome: string;
  readonly #lockStaleAfterMs: number;
  readonly #now: () => Date;

  constructor(options: CodexAgentWorktreeManagerOptions) {
    this.#requestedRepoRoot = resolve(options.repoRoot);
    this.#tempRoot = resolve(options.tempRoot ?? tmpdir());
    this.#codexHome = resolve(options.codexHome ?? process.env.CODEX_HOME ?? join(homedir(), ".codex"));
    this.#lockStaleAfterMs = options.lockStaleAfterMs ?? 5 * 60 * 1000;
    if (!Number.isFinite(this.#lockStaleAfterMs) || this.#lockStaleAfterMs < 0) {
      throw new Error("lockStaleAfterMs must be a non-negative finite number");
    }
    this.#now = options.now ?? (() => new Date());
  }

  async planPrepare(input: {
    readonly runId: string;
    readonly taskId: string;
    readonly allowDirtySource?: boolean;
  }): Promise<CodexAgentWorktreePreparePlan> {
    validateIdentifier(input.runId, "runId identifier");
    validateIdentifier(input.taskId, "taskId identifier");
    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, input.runId, input.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const baseCommit = await runGit(context.repoRoot, ["rev-parse", "HEAD"]);
    const branch = `codex/agent/${input.runId}/${input.taskId}`;
    const branchValid = await gitSucceeds(context.repoRoot, ["check-ref-format", "--branch", branch]);
    const sourceChanges = await readSourceChanges(context.repoRoot);
    const sourceDirty = sourceChanges.length > 0;
    const dirtySourceAcknowledged = input.allowDirtySource === true;
    const blockers = [
      ...(!branchValid ? ["invalid-worktree-branch"] : []),
      ...(sourceDirty && !dirtySourceAcknowledged ? ["dirty-source-unacknowledged"] : []),
      ...(await pathExists(paths.path) ? ["worktree-path-exists"] : []),
      ...(await pathExists(paths.receiptPath) ? ["worktree-receipt-exists"] : []),
      ...(await gitSucceeds(context.repoRoot, ["show-ref", "--verify", `refs/heads/${branch}`])
        ? ["worktree-branch-exists"]
        : []),
    ];

    return {
      status: blockers.length > 0 ? "blocked" : "ready",
      blockers,
      dryRun: true,
      runId: input.runId,
      taskId: input.taskId,
      repoRoot: context.repoRoot,
      path: paths.path,
      branch,
      baseCommit,
      sourceDirty,
      sourceChanges,
      dirtySourceAcknowledged,
      receiptPath: paths.receiptPath,
    };
  }

  async prepare(input: {
    readonly runId: string;
    readonly taskId: string;
    readonly allowDirtySource?: boolean;
  }): Promise<CodexAgentWorktreeLease> {
    validateIdentifier(input.runId, "runId identifier");
    validateIdentifier(input.taskId, "taskId identifier");

    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, input.runId, input.taskId);
    await this.#assertLeasePathSafety(context, paths);
    await mkdir(dirname(paths.receiptPath), { recursive: true });
    await this.#assertLeasePathSafety(context, paths);
    const lock = await this.#acquireLock(context.repoRoot, paths.lockPath);

    try {
      await this.#assertLeasePathSafety(context, paths);
      const existing = await this.#readReceiptIfPresent(paths.receiptPath);

      if (existing) {
        await this.#assertReceiptOwnership(existing, context, paths.path, input);
        if (existing.state === "ready" && await pathExists(existing.path)) {
          const registered = await this.#findRegisteredWorktree(context, existing.path);
          if (!registered) {
            throw new Error("Codex worktree lease path exists but is not registered");
          }
          if (registered.branch !== `refs/heads/${existing.branch}`) {
            throw new Error("Codex worktree lease branch does not match its receipt");
          }
          const currentHead = await runGit(existing.path, ["rev-parse", "HEAD"]);
          const refreshed = currentHead === existing.headCommit
            ? existing
            : {
                ...existing,
                headCommit: currentHead,
                updatedAt: this.#now().toISOString(),
              };
          if (refreshed !== existing) await this.#writeReceipt(paths.receiptPath, refreshed);
          return { ...refreshed, receiptPath: paths.receiptPath };
        }
        throw new Error(`Codex worktree lease already exists in state ${existing.state}`);
      }

      const baseCommit = await runGit(context.repoRoot, ["rev-parse", "HEAD"]);
      const branch = `codex/agent/${input.runId}/${input.taskId}`;
      if (!(await gitSucceeds(context.repoRoot, ["check-ref-format", "--branch", branch]))) {
        throw new Error(`Codex worktree has an invalid Git branch name: ${branch}`);
      }
      const sourceChanges = await readSourceChanges(context.repoRoot);
      const sourceDirty = sourceChanges.length > 0;
      const dirtySourceAcknowledged = input.allowDirtySource === true;
      if (sourceDirty && !dirtySourceAcknowledged) {
        throw new Error(
          "Codex worktree has a dirty source; acknowledge the HEAD-only baseline with allowDirtySource",
        );
      }
      if (await gitSucceeds(context.repoRoot, ["show-ref", "--verify", `refs/heads/${branch}`])) {
        throw new Error(`Codex worktree branch already exists: ${branch}`);
      }
      if (await pathExists(paths.path)) {
        throw new Error(`Codex worktree path already exists: ${paths.path}`);
      }
      const timestamp = this.#now().toISOString();
      const allocating: CodexAgentWorktreeReceipt = {
        schemaVersion: 1,
        runId: input.runId,
        taskId: input.taskId,
        repoRoot: context.repoRoot,
        commonGitDir: context.commonGitDir,
        path: paths.path,
        branch,
        baseCommit,
        headCommit: baseCommit,
        sourceDirty,
        sourceChanges,
        dirtySourceAcknowledged,
        state: "allocating",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await this.#writeReceipt(paths.receiptPath, allocating);
      await mkdir(dirname(paths.path), { recursive: true });
      await this.#assertLeasePathSafety(context, paths);

      try {
        await runGit(context.repoRoot, ["worktree", "add", "-b", branch, paths.path, baseCommit]);
        await this.#assertLeasePathSafety(context, paths);
      } catch (error) {
        const orphaned = {
          ...allocating,
          state: "orphaned" as const,
          updatedAt: this.#now().toISOString(),
        };
        await this.#writeReceipt(paths.receiptPath, orphaned);
        if (await pathExists(paths.path)) {
          await rmdir(paths.path).catch((cleanupError: unknown) => {
            if (
              !isNodeError(cleanupError, "ENOENT")
              && !isNodeError(cleanupError, "ENOTEMPTY")
            ) {
              throw cleanupError;
            }
          });
        }
        if (!(await pathExists(paths.path))) {
          await this.#cleanupEmptyTempDirectories(context.managedRoot, paths.path);
        }
        throw error;
      }

      const ready: CodexAgentWorktreeReceipt = {
        ...allocating,
        state: "ready",
        updatedAt: this.#now().toISOString(),
      };
      await this.#writeReceipt(paths.receiptPath, ready);
      return { ...ready, receiptPath: paths.receiptPath };
    } finally {
      await lock.release();
      if (!(await pathExists(paths.receiptPath))) {
        await this.#cleanupEmptyReceiptDirectories(context.repoRoot, paths.receiptPath);
      }
    }
  }

  async inspect(input: { readonly runId: string; readonly taskId: string }): Promise<CodexAgentWorktreeLease> {
    validateIdentifier(input.runId, "runId identifier");
    validateIdentifier(input.taskId, "taskId identifier");
    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, input.runId, input.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const receipt = await this.#readReceipt(paths.receiptPath);
    await this.#assertReceiptOwnership(receipt, context, paths.path, input);
    return { ...receipt, receiptPath: paths.receiptPath };
  }

  async planCleanup(input: {
    readonly runId: string;
    readonly taskId: string;
    readonly agentState: CodexAgentState;
    readonly fanInCollected: boolean;
  }): Promise<CodexAgentWorktreeCleanupPlan> {
    validateIdentifier(input.runId, "runId identifier");
    validateIdentifier(input.taskId, "taskId identifier");
    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, input.runId, input.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const receipt = await this.#readReceipt(paths.receiptPath);
    await this.#assertReceiptOwnership(receipt, context, paths.path, input);

    const blockers: string[] = [];
    const exists = await pathExists(receipt.path);
    let headCommit = receipt.headCommit;
    let worktreeStatus = "missing";
    let registryEntry: GitWorktreeEntry | undefined;

    if (!exists) {
      blockers.push("missing-worktree");
    } else {
      registryEntry = await this.#findRegisteredWorktree(context, receipt.path);

      if (!registryEntry) {
        blockers.push("worktree-not-registered");
      } else {
        if (registryEntry.branch !== `refs/heads/${receipt.branch}`) blockers.push("branch-mismatch");
        headCommit = await runGit(receipt.path, ["rev-parse", "HEAD"]);
        worktreeStatus = await runGit(receipt.path, ["status", "--porcelain", "--untracked-files=all"]);
        if (worktreeStatus.length > 0) blockers.push("dirty-worktree");
      }
    }

    if (receipt.state !== "ready") blockers.push(`lease-state:${receipt.state}`);
    if (!terminalAgentStates.has(input.agentState)) blockers.push("agent-not-terminal");
    if (!input.fanInCollected) blockers.push("fan-in-not-collected");

    const planFingerprint = fingerprint({
      receipt,
      headCommit,
      worktreeStatus,
      registryEntry,
      agentState: input.agentState,
      fanInCollected: input.fanInCollected,
    });

    return {
      runId: input.runId,
      taskId: input.taskId,
      status: !exists ? "orphaned" : blockers.length > 0 ? "blocked" : "ready",
      blockers,
      agentState: input.agentState,
      fanInCollected: input.fanInCollected,
      headCommit,
      baseCommit: receipt.baseCommit,
      branch: receipt.branch,
      path: receipt.path,
      receiptPath: paths.receiptPath,
      fingerprint: planFingerprint,
    };
  }

  async cleanup(plan: CodexAgentWorktreeCleanupPlan): Promise<CodexAgentWorktreeCleanupResult> {
    if (plan.status !== "ready") {
      throw new Error(`Codex worktree cleanup is blocked: ${plan.blockers.join(", ") || plan.status}`);
    }

    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, plan.runId, plan.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const lock = await this.#acquireLock(context.repoRoot, paths.lockPath);
    let receiptDeleted = false;

    try {
      const current = await this.planCleanup({
        runId: plan.runId,
        taskId: plan.taskId,
        agentState: plan.agentState,
        fanInCollected: plan.fanInCollected,
      });

      if (
        current.fingerprint !== plan.fingerprint
        || current.status !== "ready"
        || current.path !== plan.path
        || current.branch !== plan.branch
        || current.receiptPath !== plan.receiptPath
        || current.headCommit !== plan.headCommit
        || current.baseCommit !== plan.baseCommit
      ) {
        throw new Error("Codex worktree changed after cleanup planning or the plan was tampered with");
      }

      const receipt = await this.#readReceipt(current.receiptPath);
      await this.#assertReceiptOwnership(receipt, context, current.path, current);
      const branchCanBeDeleted = current.headCommit === current.baseCommit
        || await gitSucceeds(
          context.repoRoot,
          ["merge-base", "--is-ancestor", current.headCommit, "HEAD"],
        );

      await runGit(context.repoRoot, ["worktree", "remove", current.path]);
      let branchPreserved = await gitSucceeds(
        context.repoRoot,
        ["show-ref", "--verify", `refs/heads/${current.branch}`],
      );

      if (branchCanBeDeleted && branchPreserved) {
        await gitSucceeds(context.repoRoot, ["branch", "-d", current.branch]);
        branchPreserved = await gitSucceeds(
          context.repoRoot,
          ["show-ref", "--verify", `refs/heads/${current.branch}`],
        );
      }

      await this.#cleanupEmptyTempDirectories(context.managedRoot, current.path);

      if (!branchPreserved) {
        await unlink(current.receiptPath);
        receiptDeleted = true;
        return {
          status: "released",
          path: current.path,
          branch: current.branch,
          branchPreserved: false,
          receiptPath: current.receiptPath,
        };
      }

      const preservedHead = await runGit(context.repoRoot, ["rev-parse", current.branch]);
      await this.#writeReceipt(current.receiptPath, {
        ...receipt,
        state: "released-with-branch",
        headCommit: preservedHead,
        updatedAt: this.#now().toISOString(),
      });

      return {
        status: "released-with-branch",
        path: current.path,
        branch: current.branch,
        branchPreserved: true,
        receiptPath: current.receiptPath,
      };
    } finally {
      await lock.release();
      if (receiptDeleted || !(await pathExists(paths.receiptPath))) {
        await this.#cleanupEmptyReceiptDirectories(context.repoRoot, paths.receiptPath);
      }
    }
  }

  async planRecovery(input: {
    readonly runId: string;
    readonly taskId: string;
  }): Promise<CodexAgentWorktreeRecoveryPlan> {
    validateIdentifier(input.runId, "runId identifier");
    validateIdentifier(input.taskId, "taskId identifier");
    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, input.runId, input.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const receipt = await this.#readReceipt(paths.receiptPath);
    await this.#assertReceiptOwnership(receipt, context, paths.path, input);

    const blockers: string[] = [];
    const exists = await pathExists(receipt.path);
    const worktrees = parseWorktreeList(
      await runGit(context.repoRoot, ["worktree", "list", "--porcelain"]),
    );
    const registryEntry = worktrees.find((entry) => resolve(entry.path) === resolve(receipt.path));
    const branchExists = await gitSucceeds(
      context.repoRoot,
      ["show-ref", "--verify", `refs/heads/${receipt.branch}`],
    );
    const branchHead = branchExists
      ? await runGit(context.repoRoot, ["rev-parse", receipt.branch])
      : undefined;
    let action: CodexAgentWorktreeRecoveryAction = "none";

    if (!["allocating", "orphaned", "released-with-branch"].includes(receipt.state)) {
      blockers.push(`lease-state-not-recoverable:${receipt.state}`);
    } else if (exists) {
      if (!registryEntry) blockers.push("worktree-not-registered");
      if (registryEntry && registryEntry.branch !== `refs/heads/${receipt.branch}`) {
        blockers.push("branch-mismatch");
      }
      if (receipt.state === "released-with-branch") {
        blockers.push("released-worktree-reappeared");
      }
      if (blockers.length === 0) action = "promote-ready";
    } else if (registryEntry) {
      blockers.push("missing-registered-worktree");
    } else if (!branchExists) {
      action = "release-metadata";
    } else {
      const branchMerged = branchHead === receipt.baseCommit
        || await gitSucceeds(
          context.repoRoot,
          ["merge-base", "--is-ancestor", branchHead!, "HEAD"],
        );
      if (branchMerged) {
        action = "delete-merged-branch";
      } else {
        blockers.push("unmerged-recovery-branch");
      }
    }

    const recoveryFingerprint = fingerprint({
      receipt,
      exists,
      registryEntry,
      branchExists,
      branchHead,
      action,
      blockers,
    });

    return {
      runId: input.runId,
      taskId: input.taskId,
      status: blockers.length === 0 && action !== "none" ? "ready" : "blocked",
      action,
      blockers,
      state: receipt.state,
      path: receipt.path,
      branch: receipt.branch,
      receiptPath: paths.receiptPath,
      fingerprint: recoveryFingerprint,
    };
  }

  async recover(
    plan: CodexAgentWorktreeRecoveryPlan,
  ): Promise<CodexAgentWorktreeRecoveryResult> {
    if (plan.status !== "ready" || plan.action === "none") {
      throw new Error(`Codex worktree recovery is blocked: ${plan.blockers.join(", ") || plan.status}`);
    }

    const context = await this.#repositoryContext();
    const paths = this.#leasePaths(context, plan.runId, plan.taskId);
    await this.#assertLeasePathSafety(context, paths);
    const lock = await this.#acquireLock(context.repoRoot, paths.lockPath);

    try {
      const current = await this.planRecovery({ runId: plan.runId, taskId: plan.taskId });
      if (
        current.status !== "ready"
        || current.fingerprint !== plan.fingerprint
        || current.action !== plan.action
        || current.path !== plan.path
        || current.branch !== plan.branch
        || current.receiptPath !== plan.receiptPath
      ) {
        throw new Error("Codex worktree changed after recovery planning or the plan was tampered with");
      }

      const receipt = await this.#readReceipt(current.receiptPath);
      await this.#assertReceiptOwnership(receipt, context, current.path, current);

      if (current.action === "promote-ready") {
        const currentHead = await runGit(current.path, ["rev-parse", "HEAD"]);
        await this.#writeReceipt(current.receiptPath, {
          ...receipt,
          state: "ready",
          headCommit: currentHead,
          updatedAt: this.#now().toISOString(),
        });
        return {
          status: "ready",
          action: current.action,
          path: current.path,
          branch: current.branch,
          receiptPath: current.receiptPath,
        };
      }

      if (current.action === "delete-merged-branch") {
        if (!(await gitSucceeds(context.repoRoot, ["branch", "-d", current.branch]))) {
          throw new Error(`Codex recovery branch could not be deleted safely: ${current.branch}`);
        }
        if (await gitSucceeds(
          context.repoRoot,
          ["show-ref", "--verify", `refs/heads/${current.branch}`],
        )) {
          throw new Error(`Codex recovery branch still exists after deletion: ${current.branch}`);
        }
      }

      await unlink(current.receiptPath);
      await this.#cleanupEmptyTempDirectories(context.managedRoot, current.path);
      return {
        status: "released",
        action: current.action,
        path: current.path,
        branch: current.branch,
        receiptPath: current.receiptPath,
      };
    } finally {
      await lock.release();
      if (!(await pathExists(paths.receiptPath))) {
        await this.#cleanupEmptyReceiptDirectories(context.repoRoot, paths.receiptPath);
      }
    }
  }

  async #findRegisteredWorktree(
    context: RepositoryContext,
    worktreePath: string,
  ): Promise<GitWorktreeEntry | undefined> {
    const canonicalPath = await realpath(worktreePath);
    const worktrees = parseWorktreeList(
      await runGit(context.repoRoot, ["worktree", "list", "--porcelain"]),
    );
    return worktrees.find((entry) => resolve(entry.path) === canonicalPath);
  }

  async #repositoryContext(): Promise<RepositoryContext> {
    const repoRoot = await realpath(await runGit(this.#requestedRepoRoot, ["rev-parse", "--show-toplevel"]));
    const commonGitDirRaw = await runGit(repoRoot, ["rev-parse", "--git-common-dir"]);
    const commonGitDir = await realpath(isAbsolute(commonGitDirRaw)
      ? commonGitDirRaw
      : resolve(repoRoot, commonGitDirRaw));
    const canonicalTempRoot = await realpath(this.#tempRoot);
    const managedRoot = join(canonicalTempRoot, "zc-codex-worktrees");
    const pathFromRepo = relative(repoRoot, managedRoot);
    if (pathFromRepo.length === 0 || (!pathFromRepo.startsWith("..") && !isAbsolute(pathFromRepo))) {
      throw new Error("Codex agent worktrees must not be created inside the repository");
    }
    const nativeWorktreeRoot = await canonicalizePotentialPath(join(this.#codexHome, "worktrees"));
    const pathFromNativeRoot = relative(nativeWorktreeRoot, managedRoot);
    if (
      pathFromNativeRoot.length === 0
      || (!pathFromNativeRoot.startsWith("..") && !isAbsolute(pathFromNativeRoot))
    ) {
      throw new Error("Codex agent worktrees must not use the Codex Desktop worktree namespace");
    }
    const repoHash = createHash("sha256").update(repoRoot, "utf8").digest("hex").slice(0, 12);
    const repoWorktreeRoot = join(managedRoot, `${basename(repoRoot)}-${repoHash}`);
    const receiptRoot = join(repoRoot, ".codex", "work", "agent-runs");
    assertOwnedPath(managedRoot, repoWorktreeRoot, "repository worktree root");
    return {
      repoRoot,
      commonGitDir,
      tempRoot: canonicalTempRoot,
      managedRoot,
      repoWorktreeRoot,
      receiptRoot,
    };
  }

  #leasePaths(context: RepositoryContext, runId: string, taskId: string): LeasePaths {
    const path = join(context.repoWorktreeRoot, runId, taskId);
    const receiptPath = join(
      context.receiptRoot,
      runId,
      "worktrees",
      `${taskId}.json`,
    );
    assertOwnedPath(context.repoWorktreeRoot, path, "worktree path");
    return { path, receiptPath, lockPath: `${receiptPath}.lock` };
  }

  async #assertLeasePathSafety(
    context: RepositoryContext,
    paths: LeasePaths,
  ): Promise<void> {
    await Promise.all([
      assertSymlinkFreeOwnedPath(
        context.tempRoot,
        context.repoWorktreeRoot,
        paths.path,
        "worktree path",
      ),
      assertSymlinkFreeOwnedPath(
        context.repoRoot,
        context.receiptRoot,
        paths.receiptPath,
        "receipt path",
      ),
      assertSymlinkFreeOwnedPath(
        context.repoRoot,
        context.receiptRoot,
        paths.lockPath,
        "lease lock path",
      ),
    ]);
  }

  async #assertReceiptOwnership(
    receipt: CodexAgentWorktreeReceipt,
    context: RepositoryContext,
    expectedPath: string,
    input: { readonly runId: string; readonly taskId: string },
  ): Promise<void> {
    if (
      receipt.runId !== input.runId
      || receipt.taskId !== input.taskId
      || resolve(receipt.repoRoot) !== context.repoRoot
      || resolve(receipt.commonGitDir) !== context.commonGitDir
      || resolve(receipt.path) !== expectedPath
      || receipt.branch !== `codex/agent/${input.runId}/${input.taskId}`
    ) {
      throw new Error("Codex worktree receipt does not own the requested path");
    }
    assertOwnedPath(context.managedRoot, resolve(receipt.path), "receipt worktree path");
    await assertSymlinkFreeOwnedPath(
      context.tempRoot,
      context.repoWorktreeRoot,
      receipt.path,
      "receipt worktree path",
    );
  }

  async #readReceipt(receiptPath: string): Promise<CodexAgentWorktreeReceipt> {
    return parseReceipt(await readFile(receiptPath, "utf8"), receiptPath);
  }

  async #readReceiptIfPresent(receiptPath: string): Promise<CodexAgentWorktreeReceipt | undefined> {
    try {
      return await this.#readReceipt(receiptPath);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) return undefined;
      throw error;
    }
  }

  async #writeReceipt(receiptPath: string, receipt: CodexAgentWorktreeReceipt): Promise<void> {
    await mkdir(dirname(receiptPath), { recursive: true });
    const temporaryPath = join(dirname(receiptPath), `.${basename(receiptPath)}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporaryPath, receiptPath);
  }

  async #acquireLock(
    repoRoot: string,
    lockPath: string,
  ): ReturnType<typeof acquireCodexWorktreeLeaseLock> {
    return acquireCodexWorktreeLeaseLock({
      repoRoot,
      lockPath,
      staleAfterMs: this.#lockStaleAfterMs,
      now: this.#now,
      runGit,
    });
  }

  async #cleanupEmptyTempDirectories(managedRoot: string, worktreePath: string): Promise<void> {
    let current = dirname(worktreePath);

    while (current === managedRoot || relative(managedRoot, current).startsWith("..") === false) {
      try {
        await rmdir(current);
      } catch (error) {
        if (isNodeError(error, "ENOENT")) {
          // Continue upward after an already-cleaned directory.
        } else if (isNodeError(error, "ENOTEMPTY")) {
          break;
        } else {
          throw error;
        }
      }

      if (current === managedRoot) break;
      current = dirname(current);
    }
  }

  async #cleanupEmptyReceiptDirectories(repoRoot: string, receiptPath: string): Promise<void> {
    const codexRoot = join(repoRoot, ".codex");
    let current = dirname(receiptPath);

    while (current !== repoRoot) {
      try {
        await rmdir(current);
      } catch (error) {
        if (isNodeError(error, "ENOENT")) {
          // Continue upward after an already-cleaned directory.
        } else if (isNodeError(error, "ENOTEMPTY")) {
          break;
        } else {
          throw error;
        }
      }

      if (current === codexRoot) break;
      current = dirname(current);
    }
  }
}
