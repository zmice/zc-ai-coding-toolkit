import { describe, it, expect } from "vitest";
import { WorktreeManager } from "../worktree-manager.js";

describe("WorktreeManager", () => {
  it("creates an instance with the expected methods", () => {
    const manager = new WorktreeManager("/tmp/repo");
    expect(typeof manager.create).toBe("function");
    expect(typeof manager.remove).toBe("function");
    expect(typeof manager.list).toBe("function");
  });
});
