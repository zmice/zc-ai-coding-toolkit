import { describe, it, expect } from "vitest";
import { SessionManager } from "../session-manager.js";

describe("SessionManager", () => {
  it("creates an instance with the expected methods", () => {
    const session = new SessionManager();
    expect(typeof session.createSession).toBe("function");
    expect(typeof session.createPane).toBe("function");
    expect(typeof session.killSession).toBe("function");
  });
});
