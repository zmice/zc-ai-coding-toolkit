import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { CodexAgentWorktreeManager } from "../codex-worktree-manager.js";

const execFileAsync = promisify(execFile);
const cleanupPaths = new Set<string>();

async function createDirectoryLink(target: string, path: string): Promise<void> {
  await symlink(target, path, process.platform === "win32" ? "junction" : "dir");
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return result.stdout.trim();
}

async function countLooseGitObjects(repoRoot: string): Promise<number> {
  const output = await git(repoRoot, "count-objects", "-v");
  const count = output.match(/^count: (\d+)$/mu)?.[1];
  if (!count) throw new Error(`git count-objects did not report a loose object count: ${output}`);
  return Number(count);
}

async function createRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zc-codex-worktree-repo-"));
  cleanupPaths.add(root);
  await git(root, "init", "-b", "main");
  await git(root, "config", "user.name", "zc test");
  await git(root, "config", "user.email", "zc-test@example.invalid");
  await writeFile(join(root, "README.md"), "# fixture\n", "utf8");
  await git(root, "add", "README.md");
  await git(root, "commit", "-m", "test: init");
  return root;
}

async function createManager(): Promise<{
  manager: CodexAgentWorktreeManager;
  repoRoot: string;
  tempRoot: string;
}> {
  const repoRoot = await createRepository();
  const tempRoot = await mkdtemp(join(tmpdir(), "zc-codex-worktree-temp-"));
  cleanupPaths.add(tempRoot);
  return {
    manager: new CodexAgentWorktreeManager({ repoRoot, tempRoot }),
    repoRoot,
    tempRoot,
  };
}

describe("CodexAgentWorktreeManager", () => {
  afterEach(async () => {
    for (const path of cleanupPaths) {
      await rm(path, { recursive: true, force: true });
    }
    cleanupPaths.clear();
  });

  it("blocks dirty sources by default and records an explicit HEAD-only acknowledgement", async () => {
    const { manager, repoRoot, tempRoot } = await createManager();
    await writeFile(join(repoRoot, "local.txt"), "uncommitted\n", "utf8");

    const plan = await manager.planPrepare({ runId: "run-001", taskId: "task-001" });
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("dirty-source-unacknowledged");
    expect(plan.sourceChanges).toContain("?? local.txt");
    await expect(
      manager.prepare({ runId: "run-001", taskId: "task-001" }),
    ).rejects.toThrow(/dirty source/u);

    const lease = await manager.prepare({
      runId: "run-001",
      taskId: "task-001",
      allowDirtySource: true,
    });
    const receipt = JSON.parse(await readFile(lease.receiptPath, "utf8")) as {
      path: string;
      sourceDirty: boolean;
      sourceChanges: string[];
      dirtySourceAcknowledged: boolean;
      baseCommit: string;
    };

    expect(relative(await realpath(tempRoot), lease.path)).not.toMatch(/^\.\./u);
    expect(lease.path).toContain("zc-codex-worktrees");
    expect(relative(await realpath(repoRoot), lease.path)).toMatch(/^\.\./u);
    expect(receipt.path).toBe(lease.path);
    expect(receipt.sourceDirty).toBe(true);
    expect(receipt.sourceChanges).toContain("?? local.txt");
    expect(receipt.dirtySourceAcknowledged).toBe(true);
    expect(receipt.baseCommit).toBe(await git(repoRoot, "rev-parse", "HEAD"));
    await access(join(lease.path, "README.md"));
    await expect(access(join(lease.path, "local.txt"))).rejects.toThrow();
  });

  it("plans placement without creating a worktree or receipt", async () => {
    const { manager } = await createManager();

    const plan = await manager.planPrepare({ runId: "run-plan", taskId: "task-plan" });

    expect(plan.dryRun).toBe(true);
    await expect(access(plan.path)).rejects.toThrow();
    await expect(access(plan.receiptPath)).rejects.toThrow();
  });

  it("blocks an existing managed branch without leaving receipt directories", async () => {
    const { manager, repoRoot } = await createManager();
    await git(repoRoot, "branch", "codex/agent/run-branch/task-branch");

    const plan = await manager.planPrepare({ runId: "run-branch", taskId: "task-branch" });
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("worktree-branch-exists");
    await expect(
      manager.prepare({ runId: "run-branch", taskId: "task-branch" }),
    ).rejects.toThrow(/branch already exists/u);
    await expect(access(plan.receiptPath)).rejects.toThrow();
    await expect(access(join(repoRoot, ".codex", "work", "agent-runs", "run-branch"))).rejects.toThrow();
  });

  it("rejects traversal, separators, absolute paths and empty identifiers", async () => {
    const { manager } = await createManager();

    for (const [runId, taskId] of [
      ["../escape", "task"],
      ["run", "../escape"],
      ["run/child", "task"],
      ["run", "CON.txt"],
      ["", "task"],
    ]) {
      await expect(manager.prepare({ runId, taskId })).rejects.toThrow(/identifier/u);
    }
  });

  it("blocks identifiers that are safe paths but invalid Git branch components", async () => {
    const { manager, repoRoot } = await createManager();

    for (const taskId of ["task.", "task.lock"]) {
      const plan = await manager.planPrepare({ runId: "run-ref", taskId });
      expect(plan.status).toBe("blocked");
      expect(plan.blockers).toContain("invalid-worktree-branch");
      await expect(manager.prepare({ runId: "run-ref", taskId })).rejects.toThrow(
        /invalid Git branch/u,
      );
      await expect(access(plan.receiptPath)).rejects.toThrow();
    }

    await expect(access(join(repoRoot, ".codex", "work", "agent-runs", "run-ref"))).rejects.toThrow();
  });

  it("blocks cleanup for dirty worktrees without force removal", async () => {
    const { manager } = await createManager();
    const lease = await manager.prepare({ runId: "run-dirty", taskId: "task-dirty" });
    await writeFile(join(lease.path, "dirty.txt"), "keep me\n", "utf8");

    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("dirty-worktree");
    await expect(manager.cleanup(plan)).rejects.toThrow(/blocked/u);
    await access(lease.path);
  });

  it("removes a clean unchanged worktree, receipt and temporary branch", async () => {
    const { manager, repoRoot, tempRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-clean", taskId: "task-clean" });
    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });

    const result = await manager.cleanup(plan);

    expect(result.status).toBe("released");
    expect(result.branchPreserved).toBe(false);
    await expect(access(lease.path)).rejects.toThrow();
    await expect(access(lease.receiptPath)).rejects.toThrow();
    await expect(access(join(tempRoot, "zc-codex-worktrees"))).rejects.toThrow();
    await expect(access(join(repoRoot, ".codex", "work", "agent-runs", "run-clean"))).rejects.toThrow();
    await expect(git(repoRoot, "show-ref", "--verify", `refs/heads/${lease.branch}`)).rejects.toThrow();
  });

  it("rejects a temporary root located inside the source repository", async () => {
    const repoRoot = await createRepository();
    const manager = new CodexAgentWorktreeManager({ repoRoot, tempRoot: repoRoot });

    await expect(manager.planPrepare({ runId: "run", taskId: "task" })).rejects.toThrow(
      /must not be created inside the repository/u,
    );
  });

  it("rejects the Codex Desktop worktree namespace through a CODEX_HOME symlink", async () => {
    const repoRoot = await createRepository();
    const actualCodexHome = await mkdtemp(join(tmpdir(), "zc-codex-home-"));
    const linkParent = await mkdtemp(join(tmpdir(), "zc-codex-home-link-"));
    const codexHomeLink = join(linkParent, "codex-home");
    const nativeWorktreeRoot = join(actualCodexHome, "worktrees");
    cleanupPaths.add(actualCodexHome);
    cleanupPaths.add(linkParent);
    await mkdir(nativeWorktreeRoot, { recursive: true });
    await createDirectoryLink(actualCodexHome, codexHomeLink);
    const manager = new CodexAgentWorktreeManager({
      repoRoot,
      tempRoot: nativeWorktreeRoot,
      codexHome: codexHomeLink,
    });

    await expect(manager.planPrepare({ runId: "run", taskId: "task" })).rejects.toThrow(
      /Codex Desktop worktree namespace/u,
    );
  });

  it("rejects a symlinked ancestor that redirects a managed worktree outside the temp root", async () => {
    const { manager, tempRoot } = await createManager();
    const outsideRoot = await mkdtemp(join(tmpdir(), "zc-codex-worktree-outside-"));
    cleanupPaths.add(outsideRoot);
    const plan = await manager.planPrepare({ runId: "run-link", taskId: "task-link" });
    await mkdir(dirname(dirname(plan.path)), { recursive: true });
    await createDirectoryLink(outsideRoot, dirname(plan.path));

    await expect(
      manager.prepare({ runId: plan.runId, taskId: plan.taskId }),
    ).rejects.toThrow(/symlink|managed root/u);

    await expect(access(join(outsideRoot, plan.taskId))).rejects.toThrow();
    await expect(access(plan.receiptPath)).rejects.toThrow();
    expect(relative(await realpath(tempRoot), plan.path)).not.toMatch(/^\.\./u);
  });

  it("rejects a symlinked receipt ancestor that redirects controller metadata outside the repository", async () => {
    const repoRoot = await createRepository();
    const tempRoot = await mkdtemp(join(tmpdir(), "zc-codex-worktree-temp-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "zc-codex-receipt-outside-"));
    cleanupPaths.add(tempRoot);
    cleanupPaths.add(outsideRoot);
    await createDirectoryLink(outsideRoot, join(repoRoot, ".codex"));
    const manager = new CodexAgentWorktreeManager({ repoRoot, tempRoot });

    await expect(
      manager.prepare({ runId: "run-receipt-link", taskId: "task-receipt-link" }),
    ).rejects.toThrow(/symlink|repository/u);

    await expect(access(join(outsideRoot, "work"))).rejects.toThrow();
  });

  it("recovers a stale lease lock owned by a dead process", async () => {
    const { repoRoot, tempRoot } = await createManager();
    const manager = new CodexAgentWorktreeManager({
      repoRoot,
      tempRoot,
      lockStaleAfterMs: 0,
    });
    const plan = await manager.planPrepare({ runId: "run-stale-lock", taskId: "task-stale-lock" });
    const lockPath = `${plan.receiptPath}.lock`;
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, JSON.stringify({
      schemaVersion: 1,
      pid: 2147483647,
      createdAt: "2000-01-01T00:00:00.000Z",
    }), "utf8");

    const lease = await manager.prepare({ runId: plan.runId, taskId: plan.taskId });

    await access(lease.path);
    await expect(access(lockPath)).rejects.toThrow();
  });

  it("recovers stale malformed lease locks", async () => {
    const { repoRoot, tempRoot } = await createManager();
    const manager = new CodexAgentWorktreeManager({
      repoRoot,
      tempRoot,
      lockStaleAfterMs: 0,
    });

    for (const [suffix, contents] of [
      ["empty", ""],
      ["truncated", "{\"schemaVersion\":1"],
      ["invalid-metadata", "{}\n"],
    ]) {
      const plan = await manager.planPrepare({
        runId: `run-malformed-${suffix}`,
        taskId: `task-malformed-${suffix}`,
      });
      const lockPath = `${plan.receiptPath}.lock`;
      await mkdir(dirname(lockPath), { recursive: true });
      await writeFile(lockPath, contents, "utf8");

      const lease = await manager.prepare({ runId: plan.runId, taskId: plan.taskId });

      await access(lease.path);
      await expect(access(lockPath)).rejects.toThrow();
    }
  });

  it("waits for a healthy lease lock without writing recovery objects into Git", async () => {
    const { repoRoot, tempRoot } = await createManager();
    const manager = new CodexAgentWorktreeManager({ repoRoot, tempRoot });
    const plan = await manager.planPrepare({ runId: "run-held-lock", taskId: "task-held-lock" });
    const lockPath = `${plan.receiptPath}.lock`;
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, `${JSON.stringify({
      schemaVersion: 1,
      pid: process.pid,
      createdAt: new Date().toISOString(),
    })}\n`, "utf8");
    const looseObjectsBefore = await countLooseGitObjects(repoRoot);
    const releaseTimer = setTimeout(() => {
      void unlink(lockPath);
    }, 100);

    try {
      const lease = await manager.prepare({ runId: plan.runId, taskId: plan.taskId });
      expect(await countLooseGitObjects(repoRoot)).toBe(looseObjectsBefore);
      await access(lease.path);
    } finally {
      clearTimeout(releaseTimer);
    }
  });

  it("does not reclaim malformed lock metadata while its embedded owner PID is alive", async () => {
    const { repoRoot, tempRoot } = await createManager();
    const manager = new CodexAgentWorktreeManager({
      repoRoot,
      tempRoot,
      lockStaleAfterMs: 0,
    });
    const plan = await manager.planPrepare({ runId: "run-live-malformed", taskId: "task-live-malformed" });
    const lockPath = `${plan.receiptPath}.lock`;
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, `${JSON.stringify({
      schemaVersion: 0,
      pid: process.pid,
      createdAt: "invalid",
    })}\n`, "utf8");
    const looseObjectsBefore = await countLooseGitObjects(repoRoot);
    const releaseTimer = setTimeout(() => {
      void unlink(lockPath);
    }, 100);

    try {
      const lease = await manager.prepare({ runId: plan.runId, taskId: plan.taskId });
      expect(await countLooseGitObjects(repoRoot)).toBe(looseObjectsBefore);
      await access(lease.path);
    } finally {
      clearTimeout(releaseTimer);
    }
  });

  it("serializes concurrent stale-lock recovery with an atomic Git claim", async () => {
    const { repoRoot, tempRoot } = await createManager();
    const first = new CodexAgentWorktreeManager({ repoRoot, tempRoot, lockStaleAfterMs: 0 });
    const second = new CodexAgentWorktreeManager({ repoRoot, tempRoot, lockStaleAfterMs: 0 });
    const plan = await first.planPrepare({ runId: "run-lock-race", taskId: "task-lock-race" });
    const lockPath = `${plan.receiptPath}.lock`;
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, "", "utf8");

    const leases = await Promise.all([
      first.prepare({ runId: plan.runId, taskId: plan.taskId }),
      second.prepare({ runId: plan.runId, taskId: plan.taskId }),
    ]);
    const worktreeList = await git(repoRoot, "worktree", "list", "--porcelain");
    const recoveryClaims = await git(
      repoRoot,
      "for-each-ref",
      "--format=%(refname)",
      "refs/zc/agent-lock-recovery",
    );

    expect(leases[0].path).toBe(leases[1].path);
    expect(worktreeList.match(/^worktree /gmu)).toHaveLength(2);
    expect(recoveryClaims).toBe("");
    await expect(access(lockPath)).rejects.toThrow();
  });

  it("preserves a named branch and receipt when clean work contains unmerged commits", async () => {
    const { manager, repoRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-commit", taskId: "task-commit" });
    await git(lease.path, "config", "user.name", "zc test");
    await git(lease.path, "config", "user.email", "zc-test@example.invalid");
    await writeFile(join(lease.path, "result.txt"), "valuable\n", "utf8");
    await git(lease.path, "add", "result.txt");
    await git(lease.path, "commit", "-m", "feat: worker result");

    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });
    const result = await manager.cleanup(plan);
    const receipt = JSON.parse(await readFile(lease.receiptPath, "utf8")) as {
      state: string;
      headCommit: string;
    };

    expect(result.status).toBe("released-with-branch");
    expect(result.branchPreserved).toBe(true);
    expect(receipt.state).toBe("released-with-branch");
    expect(receipt.headCommit).toBe(await git(repoRoot, "rev-parse", lease.branch));
    await expect(access(lease.path)).rejects.toThrow();
  });

  it("rejects cleanup when the worktree changes after planning", async () => {
    const { manager } = await createManager();
    const lease = await manager.prepare({ runId: "run-race", taskId: "task-race" });
    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });
    await writeFile(join(lease.path, "late.txt"), "late change\n", "utf8");

    await expect(manager.cleanup(plan)).rejects.toThrow(/changed after cleanup planning/u);
    await access(lease.path);
  });

  it("rejects a cleanup plan whose owned paths were tampered with", async () => {
    const { manager } = await createManager();
    const owned = await manager.prepare({ runId: "run-owned", taskId: "task-owned" });
    const other = await manager.prepare({ runId: "run-other", taskId: "task-other" });
    const plan = await manager.planCleanup({
      runId: owned.runId,
      taskId: owned.taskId,
      agentState: "completed",
      fanInCollected: true,
    });

    await expect(manager.cleanup({
        ...plan,
        path: other.path,
        branch: other.branch,
        receiptPath: other.receiptPath,
      })).rejects.toThrow(/tampered/u);

    await access(owned.path);
    await access(owned.receiptPath);
    await access(other.path);
    await access(other.receiptPath);
  });

  it("does not reuse a ready receipt when its path is no longer a registered worktree", async () => {
    const { manager, repoRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-stale", taskId: "task-stale" });
    await git(repoRoot, "worktree", "remove", lease.path);
    await mkdir(lease.path, { recursive: true });

    await expect(
      manager.prepare({ runId: lease.runId, taskId: lease.taskId }),
    ).rejects.toThrow(/not registered/u);
  });

  it("refreshes an idempotently reused lease to the branch current head", async () => {
    const { manager } = await createManager();
    const lease = await manager.prepare({ runId: "run-reuse", taskId: "task-reuse" });
    await git(lease.path, "config", "user.name", "zc test");
    await git(lease.path, "config", "user.email", "zc-test@example.invalid");
    await writeFile(join(lease.path, "result.txt"), "result\n", "utf8");
    await git(lease.path, "add", "result.txt");
    await git(lease.path, "commit", "-m", "feat: worker result");

    const reused = await manager.prepare({ runId: lease.runId, taskId: lease.taskId });
    const currentHead = await git(lease.path, "rev-parse", "HEAD");
    const receipt = JSON.parse(await readFile(lease.receiptPath, "utf8")) as { headCommit: string };

    expect(reused.headCommit).toBe(currentHead);
    expect(receipt.headCommit).toBe(currentHead);
  });

  it("serializes concurrent cleanup attempts and leaves no empty receipt directories", async () => {
    const { manager, repoRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-concurrent", taskId: "task-concurrent" });
    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });

    const outcomes = await Promise.allSettled([manager.cleanup(plan), manager.cleanup(plan)]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    await expect(access(lease.path)).rejects.toThrow();
    await expect(access(lease.receiptPath)).rejects.toThrow();
    await expect(
      access(join(repoRoot, ".codex", "work", "agent-runs", "run-concurrent")),
    ).rejects.toThrow();
  });

  it("promotes an allocating receipt when its exact worktree registration completed", async () => {
    const { manager } = await createManager();
    const lease = await manager.prepare({ runId: "run-recover-ready", taskId: "task-recover-ready" });
    const receipt = JSON.parse(await readFile(lease.receiptPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      lease.receiptPath,
      `${JSON.stringify({ ...receipt, state: "allocating" }, null, 2)}\n`,
      "utf8",
    );

    const plan = await manager.planRecovery({ runId: lease.runId, taskId: lease.taskId });
    expect(plan.status).toBe("ready");
    expect(plan.action).toBe("promote-ready");

    const result = await manager.recover(plan);
    expect(result.status).toBe("ready");
    expect((await manager.inspect({ runId: lease.runId, taskId: lease.taskId })).state).toBe("ready");
  });

  it("removes an orphan receipt when neither worktree nor branch remains", async () => {
    const { manager, repoRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-recover-orphan", taskId: "task-recover-orphan" });
    await git(repoRoot, "worktree", "remove", lease.path);
    await git(repoRoot, "branch", "-d", lease.branch);
    const receipt = JSON.parse(await readFile(lease.receiptPath, "utf8")) as Record<string, unknown>;
    await writeFile(
      lease.receiptPath,
      `${JSON.stringify({ ...receipt, state: "orphaned" }, null, 2)}\n`,
      "utf8",
    );

    const plan = await manager.planRecovery({ runId: lease.runId, taskId: lease.taskId });
    expect(plan.status).toBe("ready");
    expect(plan.action).toBe("release-metadata");
    const result = await manager.recover(plan);

    expect(result.status).toBe("released");
    await expect(access(lease.receiptPath)).rejects.toThrow();
    await expect(
      access(join(repoRoot, ".codex", "work", "agent-runs", "run-recover-orphan")),
    ).rejects.toThrow();
  });

  it("finalizes a preserved recovery branch after it is merged", async () => {
    const { manager, repoRoot } = await createManager();
    const lease = await manager.prepare({ runId: "run-finalize", taskId: "task-finalize" });
    await git(lease.path, "config", "user.name", "zc test");
    await git(lease.path, "config", "user.email", "zc-test@example.invalid");
    await writeFile(join(lease.path, "merged.txt"), "merged\n", "utf8");
    await git(lease.path, "add", "merged.txt");
    await git(lease.path, "commit", "-m", "feat: merged worker result");
    const cleanup = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "completed",
      fanInCollected: true,
    });
    await manager.cleanup(cleanup);
    await git(repoRoot, "merge", "--ff-only", lease.branch);

    const plan = await manager.planRecovery({ runId: lease.runId, taskId: lease.taskId });
    expect(plan.status).toBe("ready");
    expect(plan.action).toBe("delete-merged-branch");
    const result = await manager.recover(plan);

    expect(result.status).toBe("released");
    await expect(git(repoRoot, "show-ref", "--verify", `refs/heads/${lease.branch}`)).rejects.toThrow();
    await expect(access(lease.receiptPath)).rejects.toThrow();
  });

  it("requires a terminal agent state and collected fan-in evidence", async () => {
    const { manager } = await createManager();
    const lease = await manager.prepare({ runId: "run-gates", taskId: "task-gates" });

    const plan = await manager.planCleanup({
      runId: lease.runId,
      taskId: lease.taskId,
      agentState: "running",
      fanInCollected: false,
    });

    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toEqual(expect.arrayContaining([
      "agent-not-terminal",
      "fan-in-not-collected",
    ]));
  });
});
