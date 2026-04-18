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
    stderr: stderrLines.join("\n"),
  };
}

describe("upstream governance commands", () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("以文本格式输出 diff，并区分结构、文本、元数据和影响面", async () => {
    const result = await runCli(["upstream", "diff", "legacy-root-source-model"]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("上游：legacy-root-source-model");
    expect(result.stdout).toContain("模式：diff");
    expect(result.stdout).toContain("结构变化");
    expect(result.stdout).toContain("文本变化");
    expect(result.stdout).toContain("元数据变化");
    expect(result.stdout).toContain("下游影响");
    expect(result.stdout).toContain("install.sh");
    expect(result.stdout).toContain("status: active -> retired");
    expect(result.stdout).toContain("需要人工审阅后再决定是否导入。");
  });

  it("支持 JSON diff 输出，供后续自动化消费但不替代人工审阅", async () => {
    const result = await runCli([
      "upstream",
      "diff",
      "legacy-root-source-model",
      "--format",
      "json",
    ]);

    const payload = JSON.parse(result.stdout) as {
      upstream: string;
      mode: string;
      changes: {
        structural: Array<{ path: string; kind: string }>;
        metadata: Array<{ field: string; before: string; after: string }>;
      };
      review_status: string;
    };

    expect(result.stderr).toBe("");
    expect(payload.upstream).toBe("legacy-root-source-model");
    expect(payload.mode).toBe("diff");
    expect(payload.review_status).toBe("pending-manual-review");
    expect(payload.changes.structural).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "install.sh", kind: "removed" })]),
    );
    expect(payload.changes.metadata).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status", before: "active", after: "retired" })]),
    );
  });

  it("支持 Markdown report 输出，包含审阅材料和决策占位", async () => {
    const result = await runCli([
      "upstream",
      "report",
      "legacy-root-source-model",
      "--format",
      "md",
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Upstream Report");
    expect(result.stdout).toContain("## Summary");
    expect(result.stdout).toContain("## Evidence");
    expect(result.stdout).toContain("## Decision");
    expect(result.stdout).toContain("`pending-manual-review`");
    expect(result.stdout).toContain("人工审阅");
  });

  it("import --dry-run 只输出提案，不执行任何写入", async () => {
    const result = await runCli([
      "upstream",
      "import",
      "legacy-root-source-model",
      "--dry-run",
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("模式：import-dry-run");
    expect(result.stdout).toContain("计划动作");
    expect(result.stdout).toContain("不会写入 `packages/toolkit`");
    expect(result.stdout).toContain("不会写入 `packages/platform-*`");
    expect(result.stdout).toContain("阻断条件");
    expect(result.stdout).toContain("必须先完成人工审阅");
  });

  it("缺少 --dry-run 时阻止 import 执行", async () => {
    const result = await runCli(["upstream", "import", "legacy-root-source-model"]);

    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("当前阶段只支持 `import --dry-run`");
    expect(process.exitCode).toBe(1);
  });
});
