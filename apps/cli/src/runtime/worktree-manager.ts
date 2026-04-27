import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ExecFileAsync = (
  file: string,
  args: readonly string[],
  options: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export interface WorktreeInfo {
  name: string;
  path: string;
}

export interface WorktreeBranchStatus {
  name: string;
  path: string;
  branch: string | null;
  status: "clean" | "dirty" | "unknown";
  ahead: number | null;
  merged: boolean | null;
}

export class WorktreeSafetyError extends Error {
  constructor(
    message: string,
    readonly directory: string,
  ) {
    super(message);
    this.name = "WorktreeSafetyError";
  }
}

export class WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly run: ExecFileAsync = execFileAsync as ExecFileAsync,
  ) {}

  async create(name: string): Promise<string> {
    const root = await this.resolveWorktreeRoot();
    await this.assertProjectLocalWorktreeIgnored(root);
    await mkdir(root, { recursive: true });

    const path = join(root, name);
    await this.run("git", ["worktree", "add", path, "-b", `zc/${name}`], {
      cwd: this.repoRoot,
    });
    return path;
  }

  async remove(name: string): Promise<void> {
    const root = await this.resolveWorktreeRoot();
    const path = join(root, name);
    try {
      await this.run("git", ["worktree", "remove", "--force", path], {
        cwd: this.repoRoot,
      });
    } catch {
      // worktree may already be gone
    }
  }

  async list(): Promise<WorktreeInfo[]> {
    const { stdout } = await this.run("git", ["worktree", "list", "--porcelain"], {
      cwd: this.repoRoot,
    });
    const lines = stdout.trim().split("\n").filter(Boolean);
    const worktrees: WorktreeInfo[] = [];
    for (const line of lines) {
      if (!line.startsWith("worktree ")) {
        continue;
      }
      const path = line.replace(/^worktree /, "");
      const name = path.split("/").pop() ?? path;
      worktrees.push({ name, path });
    }
    return worktrees;
  }

  async mergeTo(_name: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: "" };
  }

  async cleanup(name: string): Promise<void> {
    const worktrees = await this.list().catch(() => []);
    const teamWorktrees = worktrees.filter((worktree) => worktree.name.startsWith(`${name}-`));
    if (teamWorktrees.length === 0) {
      await this.remove(name);
      return;
    }

    for (const worktree of teamWorktrees) {
      await this.remove(worktree.name);
    }
  }

  async prune(): Promise<void> {
    try {
      await this.run("git", ["worktree", "prune"], {
        cwd: this.repoRoot,
      });
    } catch {
      // ignore
    }
  }

  async inspectTeam(name: string): Promise<WorktreeBranchStatus[]> {
    const worktrees = await this.list().catch(() => []);
    const teamWorktrees = worktrees.filter((worktree) => worktree.name.startsWith(`${name}-`));
    return Promise.all(teamWorktrees.map((worktree) => this.inspect(worktree)));
  }

  async resolveWorktreeRoot(): Promise<string> {
    const preferred = join(this.repoRoot, ".worktrees");
    if (await pathExists(preferred)) {
      return preferred;
    }

    const fallback = join(this.repoRoot, "worktrees");
    if (await pathExists(fallback)) {
      return fallback;
    }

    return preferred;
  }

  async assertProjectLocalWorktreeIgnored(root: string): Promise<void> {
    const relativeRoot = relative(this.repoRoot, root) || ".";
    if (relativeRoot.startsWith("..")) {
      return;
    }
    const ignoreProbe = relativeRoot.endsWith("/") ? relativeRoot : `${relativeRoot}/`;

    try {
      await this.run("git", ["check-ignore", "-q", ignoreProbe], {
        cwd: this.repoRoot,
      });
    } catch {
      throw new WorktreeSafetyError(
        `Worktree directory "${relativeRoot}" is not ignored. Add "${relativeRoot}/" to .gitignore before starting team worktrees.`,
        relativeRoot,
      );
    }
  }

  private async inspect(worktree: WorktreeInfo): Promise<WorktreeBranchStatus> {
    try {
      const [{ stdout: branchStdout }, { stdout: statusStdout }] = await Promise.all([
        this.run("git", ["-C", worktree.path, "branch", "--show-current"], { cwd: this.repoRoot }),
        this.run("git", ["-C", worktree.path, "status", "--porcelain", "--branch"], { cwd: this.repoRoot }),
      ]);
      const branch = branchStdout.trim() || null;
      const statusLines = statusStdout.trim().split("\n").filter(Boolean);
      const dirty = statusLines.some((line) => !line.startsWith("## "));
      const header = statusLines.find((line) => line.startsWith("## ")) ?? "";
      const ahead = parseAhead(header);
      const merged = branch ? await this.isMerged(branch) : null;

      return {
        ...worktree,
        branch,
        status: dirty ? "dirty" : "clean",
        ahead,
        merged,
      };
    } catch {
      return {
        ...worktree,
        branch: null,
        status: "unknown",
        ahead: null,
        merged: null,
      };
    }
  }

  private async isMerged(branch: string): Promise<boolean | null> {
    try {
      const { stdout } = await this.run("git", ["branch", "--merged"], { cwd: this.repoRoot });
      return stdout
        .split("\n")
        .map((line) => line.replace(/^\*\s*/, "").trim())
        .includes(branch);
    } catch {
      return null;
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parseAhead(header: string): number | null {
  if (!header.includes("...")) {
    return null;
  }
  const match = /ahead (\d+)/.exec(header);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}
