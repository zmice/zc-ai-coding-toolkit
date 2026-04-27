import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorktreeManager, WorktreeSafetyError } from "../worktree-manager.js";

describe("WorktreeManager", () => {
  it("creates an instance with the expected methods", () => {
    const manager = new WorktreeManager("/tmp/repo");
    expect(typeof manager.create).toBe("function");
    expect(typeof manager.remove).toBe("function");
    expect(typeof manager.list).toBe("function");
  });

  it("prefers .worktrees over worktrees", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "zc-worktree-root-"));
    await mkdir(join(repoRoot, ".worktrees"));
    await mkdir(join(repoRoot, "worktrees"));
    const manager = new WorktreeManager(repoRoot, async () => ({ stdout: "", stderr: "" }));

    await expect(manager.resolveWorktreeRoot()).resolves.toBe(join(repoRoot, ".worktrees"));

    await rm(repoRoot, { recursive: true, force: true });
  });

  it("rejects project-local worktree roots that are not ignored", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "zc-worktree-root-"));
    const manager = new WorktreeManager(repoRoot, async (file, args) => {
      if (file === "git" && args[0] === "check-ignore") {
        throw new Error("not ignored");
      }
      return { stdout: "", stderr: "" };
    });

    await expect(manager.assertProjectLocalWorktreeIgnored(join(repoRoot, ".worktrees")))
      .rejects
      .toBeInstanceOf(WorktreeSafetyError);

    await rm(repoRoot, { recursive: true, force: true });
  });

  it("checks project-local worktree roots as directories before they exist", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "zc-worktree-root-"));
    const checked: string[] = [];
    const manager = new WorktreeManager(repoRoot, async (file, args) => {
      if (file === "git" && args[0] === "check-ignore") {
        checked.push(String(args[2]));
      }
      return { stdout: "", stderr: "" };
    });

    await manager.assertProjectLocalWorktreeIgnored(join(repoRoot, ".worktrees"));

    expect(checked).toEqual([".worktrees/"]);

    await rm(repoRoot, { recursive: true, force: true });
  });

  it("reports ahead as unknown for branches without upstream tracking", async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), "zc-worktree-root-"));
    const worktreePath = join(repoRoot, ".worktrees", "team-a-w1");
    const manager = new WorktreeManager(repoRoot, async (file, args) => {
      if (file === "git" && args[0] === "worktree" && args[1] === "list") {
        return {
          stdout: `worktree ${worktreePath}\nHEAD 0000000\nbranch refs/heads/zc/team-a-w1\n`,
          stderr: "",
        };
      }
      if (file === "git" && args[0] === "-C" && args[2] === "branch") {
        return { stdout: "zc/team-a-w1\n", stderr: "" };
      }
      if (file === "git" && args[0] === "-C" && args[2] === "status") {
        return { stdout: "## zc/team-a-w1\n", stderr: "" };
      }
      if (file === "git" && args[0] === "branch" && args[1] === "--merged") {
        return { stdout: "", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    });

    const [status] = await manager.inspectTeam("team-a");

    expect(status?.ahead).toBeNull();

    await rm(repoRoot, { recursive: true, force: true });
  });
});
