import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../index.js";

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const logSpy = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    stdoutLines.push(parts.map(String).join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    stderrLines.push(parts.map(String).join(" "));
  });

  try {
    await createProgram().parseAsync(args, { from: "user" });
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n")
  };
}

describe("toolkit CLI", () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toolkit lint reports governance warnings as JSON", async () => {
    const result = await runCli(["toolkit", "lint", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      summary: { assets: number; warnings: number; errors: number };
    };

    expect(result.stderr).toBe("");
    expect(payload.summary.assets).toBeGreaterThan(0);
    expect(payload.summary.warnings).toBeGreaterThan(0);
    expect(payload.summary.errors).toBe(0);
  });

  it("toolkit lint --strict turns warnings into a non-zero exit", async () => {
    const result = await runCli(["toolkit", "lint", "--strict"]);

    expect(result.stdout).toContain("toolkit lint");
    expect(result.stderr).toContain("toolkit lint 在严格模式下失败");
    expect(process.exitCode).toBe(1);
  });
});
