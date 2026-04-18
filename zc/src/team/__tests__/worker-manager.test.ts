import { describe, it, expect, beforeEach, vi } from "vitest";
import { WorkerManager } from "../worker-manager.js";
import type { SessionManager } from "../../runtime/session-manager.js";
import type { WorktreeManager } from "../../runtime/worktree-manager.js";

// We need to mock the adapter registry
vi.mock("../../adapters/types.js", () => {
  const fakeAdapter = {
    name: "codex",
    detect: vi.fn().mockResolvedValue(true),
    version: vi.fn().mockResolvedValue("1.0.0"),
    spawn: vi.fn(),
    injectContext: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
  const adapters = new Map([
    ["codex", fakeAdapter],
    ["qwen-code", { ...fakeAdapter, name: "qwen-code" }],
  ]);
  return {
    getAdapter: (name: string) => adapters.get(name),
    registerAdapter: vi.fn(),
    listAdapters: () => Array.from(adapters.keys()),
  };
});

function createMockSessionManager(): SessionManager {
  return {
    createSession: vi.fn().mockResolvedValue("zc-test-team"),
    createPane: vi.fn().mockResolvedValue("zc-test-team:1"),
    sendKeys: vi.fn().mockResolvedValue(undefined),
    captureOutput: vi.fn().mockResolvedValue("some output"),
    killPane: vi.fn().mockResolvedValue(undefined),
    killSession: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([]),
    isAvailable: vi.fn().mockResolvedValue(true),
  } as unknown as SessionManager;
}

function createMockWorktreeManager(): WorktreeManager {
  return {
    create: vi.fn().mockImplementation((workerName: string) =>
      Promise.resolve(`/tmp/repo-zc-${workerName}`),
    ),
    remove: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    mergeTo: vi.fn().mockResolvedValue({ success: true, message: "" }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    prune: vi.fn().mockResolvedValue(undefined),
  } as unknown as WorktreeManager;
}

describe("WorkerManager", () => {
  let manager: WorkerManager;
  let session: ReturnType<typeof createMockSessionManager>;
  let worktree: ReturnType<typeof createMockWorktreeManager>;

  beforeEach(() => {
    session = createMockSessionManager();
    worktree = createMockWorktreeManager();
    manager = new WorkerManager("test-team", session as SessionManager, worktree as WorktreeManager);
  });

  describe("spawnWorker", () => {
    it("should create worktree and tmux pane", async () => {
      const info = await manager.spawnWorker("w1", "codex");

      expect(worktree.create).toHaveBeenCalledWith("w1", "test-team");
      expect(session.createPane).toHaveBeenCalledWith(
        "zc-test-team",
        'cd "/tmp/repo-zc-w1"',
      );
      expect(info.id).toBe("w1");
      expect(info.cli).toBe("codex");
      expect(info.status).toBe("idle");
      expect(info.worktree).toBe("/tmp/repo-zc-w1");
      expect(info.branch).toBe("zc/test-team/w1");
      expect(info.paneId).toBe("zc-test-team:1");
    });

    it("should throw if worker already exists", async () => {
      await manager.spawnWorker("w1", "codex");
      await expect(manager.spawnWorker("w1", "codex")).rejects.toThrow(
        'Worker "w1" already exists',
      );
    });

    it("should throw for unknown CLI adapter", async () => {
      await expect(manager.spawnWorker("w1", "unknown-cli")).rejects.toThrow(
        'Unknown CLI adapter: "unknown-cli"',
      );
    });
  });

  describe("assignTask", () => {
    it("should send CLI command to worker pane and mark busy", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.assignTask("w1", "task-1", "implement feature X");

      expect(session.sendKeys).toHaveBeenCalledWith(
        "zc-test-team:1",
        expect.stringContaining("codex"),
      );
      expect(session.sendKeys).toHaveBeenCalledWith(
        "zc-test-team:1",
        expect.stringContaining("implement feature X"),
      );

      const workers = manager.listWorkers();
      expect(workers[0].status).toBe("busy");
      expect(workers[0].currentTask).toBe("task-1");
    });

    it("should include model flag when provided", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.assignTask("w1", "t1", "do stuff", "gpt-4o");

      expect(session.sendKeys).toHaveBeenCalledWith(
        "zc-test-team:1",
        expect.stringContaining("--model gpt-4o"),
      );
    });

    it("should build qwen-code command correctly", async () => {
      await manager.spawnWorker("w1", "qwen-code");
      await manager.assignTask("w1", "t1", "fix bug");

      expect(session.sendKeys).toHaveBeenCalledWith(
        "zc-test-team:1",
        expect.stringContaining("qwen"),
      );
      expect(session.sendKeys).toHaveBeenCalledWith(
        "zc-test-team:1",
        expect.stringContaining("-p"),
      );
    });

    it("should throw if worker is dead", async () => {
      await manager.spawnWorker("w1", "codex");
      // Force worker to dead state via failed health check
      vi.mocked(session.captureOutput).mockRejectedValueOnce(new Error("pane dead"));
      await manager.healthCheck("w1");

      await expect(
        manager.assignTask("w1", "t1", "prompt"),
      ).rejects.toThrow('Worker "w1" is dead');
    });

    it("should throw if worker is already busy", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.assignTask("w1", "t1", "first task");

      await expect(
        manager.assignTask("w1", "t2", "second task"),
      ).rejects.toThrow('Worker "w1" is already busy');
    });

    it("should throw for non-existent worker", async () => {
      await expect(
        manager.assignTask("nope", "t1", "prompt"),
      ).rejects.toThrow('Worker "nope" not found');
    });
  });

  describe("getOutput", () => {
    it("should return tmux captured output", async () => {
      await manager.spawnWorker("w1", "codex");
      const output = await manager.getOutput("w1");

      expect(session.captureOutput).toHaveBeenCalledWith("zc-test-team:1");
      expect(output).toBe("some output");
    });
  });

  describe("healthCheck", () => {
    it("should return true when pane is alive", async () => {
      await manager.spawnWorker("w1", "codex");
      const healthy = await manager.healthCheck("w1");

      expect(healthy).toBe(true);
      expect(manager.listWorkers()[0].status).toBe("idle");
    });

    it("should mark worker dead when pane fails", async () => {
      await manager.spawnWorker("w1", "codex");
      vi.mocked(session.captureOutput).mockRejectedValueOnce(new Error("dead"));

      const healthy = await manager.healthCheck("w1");
      expect(healthy).toBe(false);
      expect(manager.listWorkers()[0].status).toBe("dead");
    });
  });

  describe("killWorker", () => {
    it("should kill pane and remove worktree", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.killWorker("w1");

      expect(session.killPane).toHaveBeenCalledWith("zc-test-team:1");
      expect(worktree.remove).toHaveBeenCalledWith("/tmp/repo-zc-w1");
      expect(manager.listWorkers()).toHaveLength(0);
    });

    it("should be safe to call on non-existent worker", async () => {
      await expect(manager.killWorker("nope")).resolves.toBeUndefined();
    });

    it("should tolerate worktree removal failure", async () => {
      vi.mocked(worktree.remove).mockRejectedValueOnce(new Error("fail"));
      await manager.spawnWorker("w1", "codex");
      await expect(manager.killWorker("w1")).resolves.toBeUndefined();
      expect(manager.listWorkers()).toHaveLength(0);
    });
  });

  describe("shutdownAll", () => {
    it("should kill all workers and session", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.spawnWorker("w2", "qwen-code");

      await manager.shutdownAll();

      expect(session.killPane).toHaveBeenCalledTimes(2);
      expect(worktree.remove).toHaveBeenCalledTimes(2);
      expect(session.killSession).toHaveBeenCalledWith("zc-test-team");
      expect(manager.listWorkers()).toHaveLength(0);
    });

    it("should kill session even with no workers", async () => {
      await manager.shutdownAll();
      expect(session.killSession).toHaveBeenCalledWith("zc-test-team");
    });
  });

  describe("listWorkers / getIdleWorkers", () => {
    it("should return copies of worker info", async () => {
      await manager.spawnWorker("w1", "codex");
      const list = manager.listWorkers();

      // Mutating returned object should not affect internal state
      list[0].status = "dead";
      expect(manager.listWorkers()[0].status).toBe("idle");
    });

    it("getIdleWorkers should filter out busy and dead workers", async () => {
      await manager.spawnWorker("w1", "codex");
      await manager.spawnWorker("w2", "codex");
      await manager.spawnWorker("w3", "codex");

      // Make w2 busy
      await manager.assignTask("w2", "t1", "task");

      // Make w3 dead
      vi.mocked(session.captureOutput).mockRejectedValueOnce(new Error("dead"));
      await manager.healthCheck("w3");

      const idle = manager.getIdleWorkers();
      expect(idle).toHaveLength(1);
      expect(idle[0].id).toBe("w1");
    });
  });
});
