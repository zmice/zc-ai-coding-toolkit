import { describe, it, expect } from "vitest";
import { Orchestrator } from "../orchestrator.js";
import { SessionManager } from "../../runtime/session-manager.js";
import { WorktreeManager } from "../../runtime/worktree-manager.js";

describe("Orchestrator", () => {
  it("creates an instance with the expected public API", () => {
    const orch = new Orchestrator("/tmp/state", new SessionManager(), new WorktreeManager("/tmp/repo"));
    expect(typeof orch.startTeam).toBe("function");
    expect(typeof orch.dispatchOnce).toBe("function");
    expect(typeof orch.shutdown).toBe("function");
  });
});
