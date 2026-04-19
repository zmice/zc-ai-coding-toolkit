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

  it("toolkit lint reports a clean governance summary as JSON", async () => {
    const result = await runCli(["toolkit", "lint", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      summary: { assets: number; warnings: number; errors: number };
    };

    expect(result.stderr).toBe("");
    expect(payload.summary.assets).toBeGreaterThan(0);
    expect(payload.summary.warnings).toBe(0);
    expect(payload.summary.errors).toBe(0);
  });

  it("toolkit lint --strict stays green when governance is clean", async () => {
    const result = await runCli(["toolkit", "lint", "--strict"]);

    expect(result.stdout).toContain("toolkit lint");
    expect(result.stdout).toContain("- warnings: 0");
    expect(result.stderr).toBe("");
    expect(process.exitCode).toBeUndefined();
  });

  it("toolkit show prints detailed governance metadata", async () => {
    const result = await runCli(["toolkit", "show", "command:build"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("ID：command:build");
    expect(result.stdout).toContain("层级：core");
    expect(result.stdout).toContain("工作流家族：lifecycle");
    expect(result.stdout).toContain("工作流角色：stage-entry");
    expect(result.stdout).toContain("固定工作流：full-delivery, bugfix");
    expect(result.stdout).toContain("依赖：skill:incremental-implementation, skill:test-driven-development");
    expect(result.stdout).toContain("来源：agent-skills (adapted)");
  });

  it("toolkit search finds assets by keyword", async () => {
    const result = await runCli(["toolkit", "search", "review"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("command:quality-review");
    expect(result.stdout).toContain("agent:code-reviewer");
    expect(result.stdout).toContain("workflow=lifecycle/stage-entry");
    expect(result.stdout).toContain("route=full-delivery, bugfix, review-closure");
  });

  it("toolkit recommend returns required and suggested assets", async () => {
    const result = await runCli(["toolkit", "recommend", "build"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("推荐目标：command:build");
    expect(result.stdout).toContain("工作流家族：lifecycle");
    expect(result.stdout).toContain("工作流角色：stage-entry");
    expect(result.stdout).toContain("固定工作流：full-delivery, bugfix");
    expect(result.stdout).toContain("推荐起始入口：command:start");
    expect(result.stdout).toContain("skill:incremental-implementation");
    expect(result.stdout).toContain("skill:test-driven-development");
    expect(result.stdout).toContain("command:quality-review");
    expect(result.stdout).toContain("command:verify");
    expect(result.stdout).toContain("skill:debugging-and-error-recovery");
    expect(result.stdout).toContain("skill:engineering-principles");
  });

  it("toolkit show prints the fixed workflow set for start", async () => {
    const result = await runCli(["toolkit", "show", "command:start"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("ID：command:start");
    expect(result.stdout).toContain(
      "固定工作流：product-analysis, full-delivery, bugfix, review-closure, docs-release, investigation"
    );
  });
});
