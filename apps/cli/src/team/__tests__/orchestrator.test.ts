import { describe, it, expect } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { SessionManager } from "../../runtime/session-manager.js";
import { WorktreeManager } from "../../runtime/worktree-manager.js";

class FakeSessionManager extends SessionManager {
  sent: string[] = [];

  override async createSession(name: string): Promise<string> {
    return name;
  }

  override async createPane(sessionName: string): Promise<string> {
    return `${sessionName}:1`;
  }

  override async sendKeys(_paneId: string, keys: string): Promise<void> {
    this.sent.push(keys);
  }
}

class FakeWorktreeManager extends WorktreeManager {
  constructor() {
    super("/tmp/repo");
  }

  override async create(name: string): Promise<string> {
    return `/tmp/repo/.worktrees/${name}`;
  }
}

describe("Orchestrator", () => {
  it("creates an instance with the expected public API", () => {
    const orch = new Orchestrator("/tmp/state", new SessionManager(), new WorktreeManager("/tmp/repo"));
    expect(typeof orch.startTeam).toBe("function");
    expect(typeof orch.dispatchOnce).toBe("function");
    expect(typeof orch.shutdown).toBe("function");
  });

  it("injects explicit task skills into dispatched worker prompts", async () => {
    const session = new FakeSessionManager();
    const stateDir = `/tmp/zc-orchestrator-${Date.now()}`;
    const orch = new Orchestrator(stateDir, session, new FakeWorktreeManager());

    await orch.startTeam({
      name: "team-skills",
      workers: [{ id: "w1", cli: "codex" }],
      tasks: [{
        id: "task-1",
        title: "Implement API",
        description: "Implement API",
        files: ["src/api.ts"],
        dependencies: [],
        skills: ["zc-build"],
        mode: "parallel",
      }],
    });
    await orch.dispatchOnce();

    expect(session.sent.at(-1)).toContain("# Skill: zc-build");
  });
});
