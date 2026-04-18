import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// We need to mock homedir before importing config
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: vi.fn(() => actual.tmpdir()) };
});

import { loadConfig } from "../config.js";
import type { ZcConfig } from "../config.js";
import { homedir } from "node:os";

describe("config", () => {
  let tempHome: string;
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), "zc-cfg-test-"));
    vi.mocked(homedir).mockReturnValue(tempHome);

    // Backup and clear ZC_ env vars
    for (const key of ["ZC_DEFAULT_CLI", "ZC_MODEL", "ZC_SKILLS_DIR", "ZC_LOG_LEVEL"]) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(async () => {
    // Restore env vars
    for (const [key, val] of Object.entries(envBackup)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    await rm(tempHome, { recursive: true, force: true }).catch(() => {});
  });

  it("returns default config when no config file exists", async () => {
    const config = await loadConfig();
    expect(config.defaultCli).toBe("codex");
    expect(config.model).toBe("");
    expect(config.skillsDir).toBe("");
    expect(config.logLevel).toBe("info");
  });

  it("reads config from ~/.zc/config.json", async () => {
    const zcDir = join(tempHome, ".zc");
    await mkdir(zcDir, { recursive: true });
    await writeFile(
      join(zcDir, "config.json"),
      JSON.stringify({ defaultCli: "qwen-code", model: "gpt-4" }),
    );

    const config = await loadConfig();
    expect(config.defaultCli).toBe("qwen-code");
    expect(config.model).toBe("gpt-4");
    // Defaults preserved for unset fields
    expect(config.logLevel).toBe("info");
  });

  it("env vars override file config", async () => {
    const zcDir = join(tempHome, ".zc");
    await mkdir(zcDir, { recursive: true });
    await writeFile(
      join(zcDir, "config.json"),
      JSON.stringify({ defaultCli: "qwen-code" }),
    );

    process.env["ZC_DEFAULT_CLI"] = "codex";
    process.env["ZC_LOG_LEVEL"] = "debug";

    const config = await loadConfig();
    expect(config.defaultCli).toBe("codex");
    expect(config.logLevel).toBe("debug");
  });

  it("handles invalid JSON gracefully", async () => {
    const zcDir = join(tempHome, ".zc");
    await mkdir(zcDir, { recursive: true });
    await writeFile(join(zcDir, "config.json"), "not-json!!!");

    const config = await loadConfig();
    expect(config.defaultCli).toBe("codex");
  });
});
