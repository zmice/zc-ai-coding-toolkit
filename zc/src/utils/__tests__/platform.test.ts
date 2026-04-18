import { describe, it, expect } from "vitest";
import { detectPlatform, type PlatformInfo } from "../platform.js";

describe("detectPlatform", () => {
  it("should return a valid PlatformInfo structure", async () => {
    const info = await detectPlatform();

    // os should be one of the known values
    expect(["macos", "linux", "windows-wsl", "windows-native", "unknown"]).toContain(info.os);

    // tmux check should have available boolean
    expect(typeof info.tmux.available).toBe("boolean");

    // git check should have available boolean
    expect(typeof info.git.available).toBe("boolean");

    // node should have version and meetsMinimum
    expect(info.node.version).toMatch(/^v\d+\.\d+\.\d+/);
    expect(typeof info.node.meetsMinimum).toBe("boolean");
  });

  it("should detect node meets minimum version (>= 20) in current env", async () => {
    const info = await detectPlatform();
    // We are running on Node >= 20 as per package.json engines
    expect(info.node.meetsMinimum).toBe(true);
  });

  it("should detect git as available in most environments", async () => {
    const info = await detectPlatform();
    expect(info.git.available).toBe(true);
    expect(info.git.version).toBeDefined();
    expect(info.git.version!.length).toBeGreaterThan(0);
  });

  it("should detect correct OS for current platform", async () => {
    const info = await detectPlatform();
    const osPlatform = process.platform;

    if (osPlatform === "win32") {
      expect(info.os).toBe("windows-native");
    } else if (osPlatform === "darwin") {
      expect(info.os).toBe("macos");
    } else if (osPlatform === "linux") {
      expect(["linux", "windows-wsl"]).toContain(info.os);
    }
  });
});
