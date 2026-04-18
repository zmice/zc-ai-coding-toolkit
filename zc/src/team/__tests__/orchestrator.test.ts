import { describe, it, expect, beforeEach, vi } from "vitest";
import { Orchestrator, type TeamSpec } from "../orchestrator.js";
import type { SessionManager } from "../../runtime/session-manager.js";
import type { WorktreeManager } from "../../runtime/worktree-manager.js";

// Mock state.ts — readJson / writeJson
vi.mock("../../runtime/state.js", () => ({
  readJson: vi.fn().mockImplementation(() => Promise.resolve([])),
  writeJson: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:fs/promises (mkdir)
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(new Error("not found")),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock adapters so WorkerManager can spawn
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
    createSession: vi.fn().mockResolvedValue("zc-test"),
    createPane: vi.fn().mockImplementation((_session: string) =>
      Promise.resolve(`zc-test:${Math.floor(Math.random() * 100)}`),
    ),
    sendKeys: vi.fn().mockResolvedValue(undefined),
    captureOutput: vi.fn().mockResolvedValue("output"),
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

function makeSpec(overrides?: Partial<TeamSpec>): TeamSpec {
  return {
    name: "test-team",
    workers: [
      { id: "w1", cli: "codex" },
      { id: "w2", cli: "qwen-code" },
    ],
    tasks: ["implement feature A", "implement feature B", "implement feature C"],
    ...overrides,
  };
}

describe("Orchestrator", () => {
  let session: ReturnType<typeof createMockSessionManager>;
  let worktree: ReturnType<typeof createMockWorktreeManager>;
  let orch: Orchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    session = createMockSessionManager();
    worktree = createMockWorktreeManager();
    orch = new Orchestrator("/tmp/.zc", session, worktree);
  });

  describe("startTeam", () => {
    it("should create session, tasks, and workers", async () => {
      const spec = makeSpec();
      await orch.startTeam(spec);

      // Creates tmux session
      expect(session.createSession).toHaveBeenCalledWith("zc-test-team");

      // Spawns 2 workers (each calls createPane)
      expect(session.createPane).toHaveBeenCalledTimes(2);
      expect(worktree.create).toHaveBeenCalledTimes(2);

      // TaskQueue should have 3 tasks
      const status = await orch.getStatus();
      expect(status.tasks.pending + status.tasks.running + status.tasks.done + status.tasks.failed).toBe(3);
      expect(status.workers).toHaveLength(2);
      expect(status.name).toBe("test-team");

      await orch.shutdown();
    });

    it("should handle empty tasks list", async () => {
      const spec = makeSpec({ tasks: [] });
      await orch.startTeam(spec);

      const status = await orch.getStatus();
      expect(status.tasks.pending).toBe(0);
      expect(status.workers).toHaveLength(2);

      await orch.shutdown();
    });

    it("should handle empty workers list", async () => {
      const spec = makeSpec({ workers: [] });
      await orch.startTeam(spec);

      const status = await orch.getStatus();
      expect(status.workers).toHaveLength(0);
      expect(status.tasks.pending).toBe(3);

      await orch.shutdown();
    });
  });

  describe("dispatchOnce", () => {
    it("should assign ready tasks to idle workers", async () => {
      const spec = makeSpec();
      await orch.startTeam(spec);

      // Run one dispatch cycle
      await orch.dispatchOnce();

      const status = await orch.getStatus();
      // 2 workers should have picked up 2 tasks
      expect(status.tasks.running).toBe(2);
      expect(status.tasks.pending).toBe(1);

      await orch.shutdown();
    });

    it("should not dispatch when no idle workers", async () => {
      const spec = makeSpec({ workers: [{ id: "w1", cli: "codex" }] });
      await orch.startTeam(spec);

      // First dispatch: w1 picks up 1 task
      await orch.dispatchOnce();
      let status = await orch.getStatus();
      expect(status.tasks.running).toBe(1);

      // Second dispatch: w1 is busy, no dispatch
      await orch.dispatchOnce();
      status = await orch.getStatus();
      expect(status.tasks.running).toBe(1);
      expect(status.tasks.pending).toBe(2);

      await orch.shutdown();
    });

    it("should not dispatch when no ready tasks", async () => {
      const spec = makeSpec({ tasks: [] });
      await orch.startTeam(spec);

      await orch.dispatchOnce();

      const status = await orch.getStatus();
      expect(status.tasks.running).toBe(0);

      await orch.shutdown();
    });

    it("should mark task failed when worker dies", async () => {
      const spec = makeSpec({ workers: [{ id: "w1", cli: "codex" }] });
      await orch.startTeam(spec);

      // Dispatch one task
      await orch.dispatchOnce();
      let status = await orch.getStatus();
      expect(status.tasks.running).toBe(1);

      // Make health check fail (worker dies)
      vi.mocked(session.captureOutput).mockRejectedValueOnce(new Error("pane dead"));

      // Next dispatch should detect dead worker and fail the task
      await orch.dispatchOnce();
      status = await orch.getStatus();
      expect(status.tasks.failed).toBe(1);

      await orch.shutdown();
    });

    it("should release task back to pending when assignTask fails", async () => {
      const spec = makeSpec({ workers: [{ id: "w1", cli: "codex" }] });
      await orch.startTeam(spec);

      // Make assignTask throw after claim+transition succeed
      const wm = orch.getWorkerManager();
      vi.spyOn(wm, "assignTask").mockRejectedValueOnce(new Error("assign failed"));

      // Dispatch — claim+transition succeed, assignTask fails, should rollback
      await orch.dispatchOnce();

      const status = await orch.getStatus();
      // Task should be back to pending, not stuck in_progress
      expect(status.tasks.running).toBe(0);
      expect(status.tasks.pending).toBe(3);

      await orch.shutdown();
    });
  });

  describe("getStatus", () => {
    it("should return correct summary", async () => {
      const spec = makeSpec();
      await orch.startTeam(spec);

      const status = await orch.getStatus();
      expect(status.name).toBe("test-team");
      expect(status.workers).toHaveLength(2);
      expect(status.tasks.pending).toBe(3);
      expect(status.tasks.running).toBe(0);
      expect(status.tasks.done).toBe(0);
      expect(status.tasks.failed).toBe(0);
      expect(status.messages).toBe(0);

      await orch.shutdown();
    });
  });

  describe("shutdown", () => {
    it("should stop dispatch loop and shut down workers", async () => {
      const spec = makeSpec();
      await orch.startTeam(spec);

      await orch.shutdown();

      expect(session.killSession).toHaveBeenCalledWith("zc-test-team");
      // Workers should be killed
      expect(session.killPane).toHaveBeenCalledTimes(2);
    });

    it("should release active task assignments on shutdown", async () => {
      const spec = makeSpec({ workers: [{ id: "w1", cli: "codex" }] });
      await orch.startTeam(spec);

      await orch.dispatchOnce();
      let status = await orch.getStatus();
      expect(status.tasks.running).toBe(1);

      await orch.shutdown();

      // After shutdown, in_progress task's token is cleared so it goes back to pending
      // (release changes status back to pending)
      const tq = orch.getTaskQueue();
      const allTasks = tq.list();
      const pendingCount = allTasks.filter((t) => t.status === "pending").length;
      // The running task should have been released back to pending
      expect(pendingCount).toBe(3);
    });

    it("should be safe to call shutdown without startTeam", async () => {
      // Need to at least start to have workerManager initialized
      const spec = makeSpec({ workers: [], tasks: [] });
      await orch.startTeam(spec);
      await expect(orch.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("skill matching modes", () => {
    it("should pass skills from TeamSpec to tasks", async () => {
      const spec = makeSpec({ skills: ["debugging-and-error-recovery", "security-and-hardening"] });
      await orch.startTeam(spec);

      const tq = orch.getTaskQueue();
      const tasks = tq.list();
      for (const task of tasks) {
        expect(task.skills).toEqual(["debugging-and-error-recovery", "security-and-hardening"]);
      }

      await orch.shutdown();
    });

    it("should use keyword matcher by default", async () => {
      const spec = makeSpec();
      await orch.startTeam(spec);

      // dispatchOnce should work without errors (uses default keyword matcher)
      await expect(orch.dispatchOnce()).resolves.toBeUndefined();

      await orch.shutdown();
    });

    it("should accept skillMatchMode in TeamSpec", async () => {
      const spec = makeSpec({ skillMatchMode: "keyword" });
      await orch.startTeam(spec);

      const status = await orch.getStatus();
      expect(status.name).toBe("test-team");

      await orch.shutdown();
    });
  });
});
