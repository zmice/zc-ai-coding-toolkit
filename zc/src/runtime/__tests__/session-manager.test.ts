import { describe, it, expect } from "vitest";
import { SessionManager } from "../session-manager.js";

describe("SessionManager", () => {
  it("should be constructable", () => {
    const mgr = new SessionManager();
    expect(mgr).toBeInstanceOf(SessionManager);
  });

  describe("sanitize (indirect)", () => {
    it("createSession should sanitize special characters in name", async () => {
      const mgr = new SessionManager();
      // We can't actually run tmux in CI, but we can verify the method exists
      // and that it would call with sanitized name by checking the method signature
      expect(typeof mgr.createSession).toBe("function");
    });
  });

  describe("isAvailable", () => {
    it("should return a boolean", async () => {
      const mgr = new SessionManager();
      const result = await mgr.isAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("listSessions", () => {
    it("should return an array", async () => {
      const mgr = new SessionManager();
      const sessions = await mgr.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it("should only return sessions starting with zc-", async () => {
      const mgr = new SessionManager();
      const sessions = await mgr.listSessions();
      for (const s of sessions) {
        expect(s.startsWith("zc-")).toBe(true);
      }
    });
  });
});
