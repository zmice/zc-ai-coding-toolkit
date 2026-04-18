import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  name: string;
  path: string;
}

export class WorktreeManager {
  constructor(private readonly repoRoot: string) {}

  async create(name: string): Promise<string> {
    const path = `${this.repoRoot}/.worktrees/${name}`;
    await execFileAsync("git", ["worktree", "add", path, "-b", `zc/${name}`], {
      cwd: this.repoRoot,
    });
    return path;
  }

  async remove(name: string): Promise<void> {
    const path = `${this.repoRoot}/.worktrees/${name}`;
    try {
      await execFileAsync("git", ["worktree", "remove", "--force", path], {
        cwd: this.repoRoot,
      });
    } catch {
      // worktree may already be gone
    }
  }

  async list(): Promise<WorktreeInfo[]> {
    const { stdout } = await execFileAsync("git", ["worktree", "list", "--porcelain"], {
      cwd: this.repoRoot,
    });
    const lines = stdout.trim().split("\n");
    const worktrees: WorktreeInfo[] = [];
    for (let i = 0; i < lines.length; i += 3) {
      const path = lines[i]?.replace(/^worktree /, "");
      if (!path) continue;
      const name = path.split("/").pop() ?? path;
      worktrees.push({ name, path });
    }
    return worktrees;
  }

  async mergeTo(_name: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "" };
  }

  async cleanup(name: string): Promise<void> {
    await this.remove(name);
  }

  async prune(): Promise<void> {
    try {
      await execFileAsync("git", ["worktree", "prune"], {
        cwd: this.repoRoot,
      });
    } catch {
      // ignore
    }
  }
}
