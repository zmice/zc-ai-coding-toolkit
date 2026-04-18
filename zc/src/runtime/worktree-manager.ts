import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Validate that a name contains only safe characters to prevent injection.
 */
function validateName(name: string, label: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(
      `Invalid ${label}: "${name}". Only alphanumeric, underscore and hyphen allowed.`,
    );
  }
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

export class WorktreeManager {
  constructor(private readonly repoRoot: string) {}

  /**
   * 创建一个新的 git worktree + 分支
   * @returns worktree 绝对路径
   */
  async create(workerName: string, teamName: string): Promise<string> {
    validateName(teamName, "team name");
    validateName(workerName, "worker name");

    const branch = `zc/${teamName}/${workerName}`;
    const parentDir = dirname(this.repoRoot);
    const worktreePath = resolve(parentDir, `${this.getRepoName()}-zc-${workerName}`);

    // Get current branch as base
    const { stdout: currentBranch } = await execFileAsync(
      "git", ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: this.repoRoot },
    );

    // Create worktree with new branch
    await execFileAsync(
      "git", ["worktree", "add", "-b", branch, worktreePath, currentBranch.trim()],
      { cwd: this.repoRoot },
    );

    return worktreePath;
  }

  /**
   * 移除一个 worktree
   */
  async remove(worktreePath: string): Promise<void> {
    await execFileAsync("git", ["worktree", "remove", worktreePath, "--force"], {
      cwd: this.repoRoot,
    });
  }

  /**
   * 列出所有 worktree
   */
  async list(): Promise<WorktreeInfo[]> {
    const { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
      cwd: this.repoRoot,
    });

    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of stdout.split("\n")) {
      if (line.startsWith("worktree ")) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.slice(9) };
      } else if (line.startsWith("HEAD ")) {
        current.head = line.slice(5);
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice(7).replace("refs/heads/", "");
      }
    }
    if (current.path) worktrees.push(current as WorktreeInfo);

    return worktrees;
  }

  /**
   * 将 worktree 分支合并到目标分支
   */
  async mergeTo(worktreePath: string, targetBranch: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the branch name of the worktree
      const { stdout: branch } = await execFileAsync(
        "git", ["rev-parse", "--abbrev-ref", "HEAD"],
        { cwd: worktreePath },
      );

      // Switch to target branch in main repo and merge
      await execFileAsync("git", ["checkout", targetBranch], { cwd: this.repoRoot });
      await execFileAsync("git", ["merge", branch.trim(), "--no-edit"], { cwd: this.repoRoot });

      return { success: true, message: `Merged ${branch.trim()} into ${targetBranch}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  /**
   * 清理团队的所有 worktree 和分支
   */
  async cleanup(teamName: string): Promise<void> {
    validateName(teamName, "team name");

    const worktrees = await this.list();
    const teamWorktrees = worktrees.filter((wt) => wt.branch?.includes(`zc/${teamName}/`));

    for (const wt of teamWorktrees) {
      try {
        await this.remove(wt.path);
      } catch {
        // continue cleanup even if one fails
      }
    }

    // Clean up branches
    try {
      const { stdout } = await execFileAsync(
        "git", ["branch", "--list", `zc/${teamName}/*`],
        { cwd: this.repoRoot },
      );
      const branches = stdout.trim().split("\n").filter(Boolean).map((b) => b.trim());
      for (const branch of branches) {
        try {
          await execFileAsync("git", ["branch", "-D", branch], { cwd: this.repoRoot });
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  /**
   * 剪枝已失效的 worktree 引用
   */
  async prune(): Promise<void> {
    await execFileAsync("git", ["worktree", "prune"], { cwd: this.repoRoot });
  }

  private getRepoName(): string {
    return this.repoRoot.split(/[/\\]/).pop() ?? "repo";
  }
}
