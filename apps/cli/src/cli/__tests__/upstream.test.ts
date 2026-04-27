import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUpstreamProgram, createUpstreamSnapshot } from "../upstream.js";

const cleanupPaths = new Set<string>();
const workspaceRoot = fileURLToPath(new URL("../../../../../", import.meta.url));

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
    await createUpstreamProgram().parseAsync(args, { from: "user" });
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
    for (const target of cleanupPaths) {
      rmSync(target, { recursive: true, force: true });
    }
    cleanupPaths.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("以文本格式输出 diff，并区分结构、文本、元数据和影响面", async () => {
    const result = await runCli([
      "diff",
      "agent-skills",
      "--against",
      "2026-04-14-baseline.json",
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("上游：agent-skills");
    expect(result.stdout).toContain("模式：diff");
    expect(result.stdout).toContain("结构变化");
    expect(result.stdout).toContain("文本变化");
    expect(result.stdout).toContain("元数据变化");
    expect(result.stdout).toContain("下游影响");
    expect(result.stdout).toContain("README.md");
    expect(result.stdout).toContain("status: evaluating -> active");
    expect(result.stdout).toContain("需要人工审阅后再决定是否导入。");
  });

  it("支持 JSON diff 输出，供后续自动化消费但不替代人工审阅", async () => {
    const result = await runCli([
      "diff",
      "agent-skills",
      "--against",
      "2026-04-14-baseline.json",
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
    expect(payload.upstream).toBe("agent-skills");
    expect(payload.mode).toBe("diff");
    expect(payload.review_status).toBe("pending-manual-review");
    expect(payload.changes.structural).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "README.md", kind: "removed" })]),
    );
    expect(payload.changes.metadata).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status", before: "evaluating", after: "active" })]),
    );
  });

  it("支持 Markdown report 输出，包含审阅材料和决策占位", async () => {
    const result = await runCli([
      "report",
      "agent-skills",
      "--format",
      "md",
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("# Upstream Report");
    expect(result.stdout).toContain("## Summary");
    expect(result.stdout).toContain("## Evidence");
    expect(result.stdout).toContain("## Decision");
    expect(result.stdout).toContain("source url");
    expect(result.stdout).toContain("https://github.com/addyosmani/agent-skills.git");
    expect(result.stdout).toContain("remote_head: 未采集");
    expect(result.stdout).toContain("`pending-manual-review`");
    expect(result.stdout).toContain("人工审阅");
  });

  it("snapshot 会追加不可变快照，并输出生成路径", async () => {
    const label = `nightly-review-${Date.now()}`;

    const result = await createUpstreamSnapshot("agent-skills", label);
    expect(result.upstream).toBe("agent-skills");
    expect(result.mode).toBe("snapshot");
    expect(result.label).toBe(label);

    const relativePath = result.snapshot_path;
    cleanupPaths.add(join(workspaceRoot, relativePath));

    const payload = JSON.parse(readFileSync(join(workspaceRoot, relativePath), "utf8")) as {
      upstream: string;
      label: string;
      metadata: { status: string; source_url: string };
    };

    expect(payload.upstream).toBe("agent-skills");
    expect(payload.label).toBe(label);
    expect(payload.metadata.status).toBe("active");
    expect(payload.metadata.source_url).toBe("https://github.com/addyosmani/agent-skills.git");
  }, 15000);

  it("report --output 会把 Markdown 审阅材料写入文件", async () => {
    const outputDir = join(tmpdir(), "ai-coding-upstream-report");
    const outputPath = join(outputDir, "agent-skills.md");
    cleanupPaths.add(outputDir);
    mkdirSync(outputDir, { recursive: true });

    const result = await runCli([
      "report",
      "agent-skills",
      "--format",
      "md",
      "--output",
      outputPath,
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("已写入输出");

    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("# Upstream Report");
    expect(content).toContain("## Decision");
  });

  it("import --dry-run 只输出提案，不执行任何写入", async () => {
    const result = await runCli([
      "import",
      "agent-skills",
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

  it("import --dry-run --output 会把提案写入文件", async () => {
    const outputDir = join(tmpdir(), "ai-coding-upstream-import");
    const outputPath = join(outputDir, "agent-skills.txt");
    cleanupPaths.add(outputDir);
    mkdirSync(outputDir, { recursive: true });

    const result = await runCli([
      "import",
      "agent-skills",
      "--dry-run",
      "--output",
      outputPath,
    ]);

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("已写入输出");

    const content = readFileSync(outputPath, "utf8");
    expect(content).toContain("模式：import-dry-run");
    expect(content).toContain("阻断条件");
  });

  it("缺少 --dry-run 时阻止 import 执行", async () => {
    const result = await runCli(["import", "agent-skills"]);

    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("当前阶段只支持 `import --dry-run`");
    expect(process.exitCode).toBe(1);
  });
});
