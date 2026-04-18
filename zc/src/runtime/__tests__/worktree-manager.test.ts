import { describe, it, expect } from "vitest";
import { WorktreeManager } from "../worktree-manager.js";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Find the repo root for testing
async function getRepoRoot(): Promise<string> {
  const { stdout } = await execAsync("git rev-parse --show-toplevel");
  return stdout.trim();
}

describe("WorktreeManager", () => {
  it("should be constructable with a repo root", () => {
    const mgr = new WorktreeManager("/some/path");
    expect(mgr).toBeInstanceOf(WorktreeManager);
  });

  describe("list", () => {
    it("should return at least the main worktree", async () => {
      const root = await getRepoRoot();
      const mgr = new WorktreeManager(root);
      const worktrees = await mgr.list();

      expect(Array.isArray(worktrees)).toBe(true);
      expect(worktrees.length).toBeGreaterThanOrEqual(1);

      // The first worktree should be the main one
      const main = worktrees[0];
      expect(main).toHaveProperty("path");
      expect(main).toHaveProperty("head");
    });
  });

  describe("input validation", () => {
    const mgr = new WorktreeManager("/some/path");

    it("should reject teamName with special characters in create()", async () => {
      await expect(mgr.create("worker1", "team;rm -rf")).rejects.toThrow(
        /Invalid team name/,
      );
    });

    it("should reject workerName with special characters in create()", async () => {
      await expect(mgr.create("worker$(cmd)", "team1")).rejects.toThrow(
        /Invalid worker name/,
      );
    });

    it("should reject teamName with spaces in create()", async () => {
      await expect(mgr.create("worker1", "team name")).rejects.toThrow(
        /Invalid team name/,
      );
    });

    it("should reject teamName with special characters in cleanup()", async () => {
      await expect(mgr.cleanup("team;drop")).rejects.toThrow(
        /Invalid team name/,
      );
    });

    it("should accept valid alphanumeric names with hyphens and underscores", async () => {
      // These should NOT throw validation errors (they will fail on git commands, but that's fine)
      await expect(mgr.create("valid-worker_1", "valid-team_2")).rejects.not.toThrow(
        /Invalid/,
      );
    });
  });

  describe("prune", () => {
    it("should run without error", async () => {
      const root = await getRepoRoot();
      const mgr = new WorktreeManager(root);
      // prune is safe to run — it only cleans stale references
      await expect(mgr.prune()).resolves.toBeUndefined();
    });
  });
});
