import { describe, it, expect } from "vitest";
import { WorkerManager } from "../worker-manager.js";
import { SessionManager } from "../../runtime/session-manager.js";
import { WorktreeManager } from "../../runtime/worktree-manager.js";

describe("WorkerManager", () => {
  it("creates an instance with the expected methods", () => {
    const manager = new WorkerManager("team", new SessionManager(), new WorktreeManager("/tmp/repo"));
    expect(typeof manager.spawnWorker).toBe("function");
    expect(typeof manager.listWorkers).toBe("function");
    expect(typeof manager.shutdownAll).toBe("function");
  });
});
