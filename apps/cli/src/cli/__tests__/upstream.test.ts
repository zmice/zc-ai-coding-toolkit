import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUpstreamProgram,
  createUpstreamSnapshot,
  mapWithConcurrency,
  removeTemporaryDirectory,
} from "../upstream.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const cleanupPaths = new Set<string>();
const workspaceRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const execFileMock = vi.mocked(execFile);

function mockGitExecFile(handler: (args: string[]) => string): void {
  execFileMock.mockImplementation(((file, args, optionsOrCallback, maybeCallback) => {
    const callback = (typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback) as
      | ((error: Error | null, stdout: string, stderr: string) => void)
      | undefined;

    if (!callback) {
      throw new Error("execFile callback is required");
    }

    queueMicrotask(() => {
      callback(null, handler(Array.isArray(args) ? args.map(String) : []), "");
    });

    return {} as ReturnType<typeof execFile>;
  }) as typeof execFile);
}

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
    execFileMock.mockReset();
  });

  it("清理临时 Git 目录时会启用 Windows 短暂占用重试", async () => {
    const removeDirectory = vi.fn().mockResolvedValue(undefined);

    await removeTemporaryDirectory("C:\\temp\\zc-upstream-example", removeDirectory);

    expect(removeDirectory).toHaveBeenCalledWith("C:\\temp\\zc-upstream-example", {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 100,
    });
  });

  it.each(["EBUSY", "EPERM", "ENOTEMPTY"])(
    "Windows 临时目录清理遇到 %s 时只告警残留，不覆盖已生成的上游证据",
    async (code) => {
      const cleanupError = Object.assign(new Error("temporary directory is still locked"), { code });
      const removeDirectory = vi.fn().mockRejectedValue(cleanupError);
      const warn = vi.fn();

      const removed = await removeTemporaryDirectory(
        "C:\\temp\\zc-upstream-example",
        removeDirectory,
        warn,
      );

      expect(removed).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("临时目录仍被占用，已保留供后续清理"),
      );
    },
  );

  it.each(["EACCES", "EIO", undefined])(
    "临时目录清理遇到非瞬态错误 %s 时保持失败",
    async (code) => {
      const cleanupError = Object.assign(
        new Error("unexpected cleanup failure"),
        code ? { code } : {},
      );
      const removeDirectory = vi.fn().mockRejectedValue(cleanupError);
      const warn = vi.fn();

      await expect(
        removeTemporaryDirectory("C:\\temp\\zc-upstream-example", removeDirectory, warn),
      ).rejects.toBe(cleanupError);
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("批量远端任务限制并发并保持登记顺序", async () => {
    let active = 0;
    let peak = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 3, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      active -= 1;
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBeLessThanOrEqual(3);
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
      expect.arrayContaining([
        expect.objectContaining({ path: ".claude-plugin/plugin.json", kind: "added" }),
      ]),
    );
    expect(payload.changes.metadata).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "status", before: "evaluating", after: "active" })]),
    );
  });

  it("with-remote 会在 HEAD 变化时执行真实 source_paths 内容 diff", async () => {
    mockGitExecFile((args) => {
      if (args[0] === "ls-remote") {
        return "1111111111111111111111111111111111111111\tHEAD\n";
      }

      if (args.includes("--name-status")) {
        return "M\tskills/context-engineering/SKILL.md\n";
      }

      if (args.includes("--name-only")) {
        return "skills/context-engineering/SKILL.md\nREADME.md\n";
      }

      return "";
    });

    const result = await runCli([
      "diff",
      "agent-skills",
      "--against",
      "2026-06-12T05-03-41-482Z-2026-06-12-review.json",
      "--with-remote",
      "--format",
      "json",
    ]);

    const payload = JSON.parse(result.stdout) as {
      evidence: {
        remote: { head_sha: string };
        remote_content: {
          status: string;
          changed_paths: Array<{ path: string; status: string }>;
          unregistered_changed_path_count: number;
          unregistered_changed_paths: string[];
          unregistered_ai_asset_path_count: number;
          unregistered_ai_asset_paths: string[];
          source_paths_gap: boolean;
        };
      };
    };

    expect(result.stderr).toBe("");
    expect(payload.evidence.remote.head_sha).toBe("1111111111111111111111111111111111111111");
    expect(payload.evidence.remote_content.status).toBe("changed");
    expect(payload.evidence.remote_content.changed_paths).toEqual([
      { status: "M", path: "skills/context-engineering/SKILL.md" },
    ]);
    expect(payload.evidence.remote_content.unregistered_changed_path_count).toBe(0);
    expect(payload.evidence.remote_content.unregistered_changed_paths).toEqual([]);
    expect(payload.evidence.remote_content.unregistered_ai_asset_path_count).toBe(0);
    expect(payload.evidence.remote_content.unregistered_ai_asset_paths).toEqual([]);
    expect(payload.evidence.remote_content.source_paths_gap).toBe(false);
    expect(execFileMock).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["diff", "--name-status"]),
      expect.any(Object),
      expect.any(Function),
    );
    expect(
      execFileMock.mock.calls
        .filter(([, args]) => Array.isArray(args) && args.includes("diff"))
        .every(([, args]) => Array.isArray(args) && args.includes("--no-renames")),
    ).toBe(true);
  });

  it("with-remote 会单独标记未登记的疑似 AI asset 路径", async () => {
    mockGitExecFile((args) => {
      if (args[0] === "ls-remote") {
        return "2222222222222222222222222222222222222222\tHEAD\n";
      }

      if (args.includes("--name-status")) {
        return "";
      }

      if (args.includes("--name-only")) {
        return [
          ".codex-plugin/plugin.json",
          "agents/reviewer.md",
          "docs/guide.md",
        ].join("\n");
      }

      return "";
    });

    const result = await runCli([
      "diff",
      "agent-skills",
      "--against",
      "2026-06-12T05-03-41-482Z-2026-06-12-review.json",
      "--with-remote",
      "--format",
      "json",
    ]);

    const payload = JSON.parse(result.stdout) as {
      impacts: Array<{ target: string; effect: string }>;
      evidence: {
        remote_content: {
          status: string;
          unregistered_changed_path_count: number;
          unregistered_ai_asset_path_count: number;
          unregistered_ai_asset_paths: string[];
          source_paths_gap: boolean;
        };
      };
    };

    expect(result.stderr).toBe("");
    expect(payload.evidence.remote_content.status).toBe("source-paths-gap");
    expect(payload.evidence.remote_content.source_paths_gap).toBe(true);
    expect(payload.evidence.remote_content.unregistered_changed_path_count).toBe(3);
    expect(payload.evidence.remote_content.unregistered_ai_asset_path_count).toBe(2);
    expect(payload.evidence.remote_content.unregistered_ai_asset_paths).toEqual([
      ".codex-plugin/plugin.json",
      "agents/reviewer.md",
    ]);
    expect(payload.impacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: "references",
          effect: expect.stringContaining("疑似 AI asset 路径"),
        }),
        expect.objectContaining({
          target: "toolkit",
          effect: expect.stringContaining("AI asset"),
        }),
      ]),
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

  it("report all --with-remote 保持 JSON 聚合完整，并通过 stderr 报告采集进度", async () => {
    mockGitExecFile((args) => {
      if (args[0] === "ls-remote") {
        return "3333333333333333333333333333333333333333\tHEAD\n";
      }

      return "";
    });

    const result = await runCli([
      "report",
      "all",
      "--with-remote",
      "--format",
      "json",
    ]);

    const payload = JSON.parse(result.stdout) as {
      mode: string;
      results: Array<{ upstream: string }>;
    };

    expect(payload.mode).toBe("report");
    expect(payload.results).toHaveLength(14);
    expect(payload.results.map((entry) => entry.upstream)).toEqual([
      "agent-skills",
      "superpowers",
      "everything-claude-code",
      "gstack",
      "andrej-karpathy-skills",
      "openai-plugins",
      "anthropic-skills",
      "github-awesome-copilot",
      "vercel-agent-skills",
      "vercel-web-interface-guidelines",
      "modern-web-guidance",
      "ui-skills",
      "awesome-design-md",
      "ponytail",
    ]);
    expect(result.stderr).toContain("正在采集远端证据：0/14");
    expect(result.stderr).toContain("远端证据采集完成：14/14");
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

  it("snapshot --with-remote 会把登记路径的 source tree manifest 绑定进 JSON", async () => {
    const head = "4444444444444444444444444444444444444444";
    const treeOutput = [
      `100644 blob ${"a".repeat(40)}\tLICENSE`,
      `100644 blob ${"b".repeat(40)}\tREADME.md`,
      `100644 blob ${"c".repeat(40)}\tskills/frontend-ui-engineering/SKILL.md`,
    ].join("\0") + "\0";

    mockGitExecFile((args) => {
      if (args[0] === "ls-remote") {
        return `${head}\tHEAD\n`;
      }

      if (args.includes("ls-tree")) {
        return treeOutput;
      }

      return "";
    });

    const label = `tree-manifest-${Date.now()}`;
    const result = await runCli([
      "snapshot",
      "agent-skills",
      "--label",
      label,
      "--format",
      "json",
      "--with-remote",
    ]);
    const summary = JSON.parse(result.stdout) as {
      snapshot_path: string;
      summary: { source_tree_entries: number; source_tree_sha256: string | null };
    };
    cleanupPaths.add(join(workspaceRoot, summary.snapshot_path));

    const payload = JSON.parse(readFileSync(join(workspaceRoot, summary.snapshot_path), "utf8")) as {
      remote: { head_sha: string };
      source_tree: {
        command: string;
        head_sha: string;
        source_paths: string[];
        entry_count: number;
        manifest_sha256: string;
        entries: Array<{ mode: string; type: string; object: string; path: string }>;
      };
    };
    const expectedHash = createHash("sha256").update(treeOutput).digest("hex");

    expect(result.stderr).toBe("");
    expect(payload.remote.head_sha).toBe(head);
    expect(payload.source_tree.command).toBe("git fetch/ls-tree source_paths");
    expect(payload.source_tree.head_sha).toBe(head);
    expect(payload.source_tree.source_paths).toEqual(
      expect.arrayContaining(["skills", "evals", "references", "scripts"]),
    );
    expect(payload.source_tree.entry_count).toBe(3);
    expect(payload.source_tree.entries.map((entry) => entry.path)).toEqual([
      "LICENSE",
      "README.md",
      "skills/frontend-ui-engineering/SKILL.md",
    ]);
    expect(payload.source_tree.manifest_sha256).toBe(expectedHash);
    expect(summary.summary.source_tree_entries).toBe(3);
    expect(summary.summary.source_tree_sha256).toBe(expectedHash);
    expect(
      execFileMock.mock.calls.some(([, args]) =>
        Array.isArray(args) && args.includes("fetch") && args.includes("--filter=blob:none") && args.includes("--no-tags")
      ),
    ).toBe(true);
  }, 15000);

  it.each([
    {
      field: "entry count",
      mutate: (payload: {
        source_tree: { entry_count: number; head_sha: string; source_paths: string[]; manifest_sha256: string };
      }) => {
        payload.source_tree.entry_count = 2;
      },
      expected: "source_tree.entry_count 不匹配",
    },
    {
      field: "HEAD",
      mutate: (payload: {
        source_tree: { entry_count: number; head_sha: string; source_paths: string[]; manifest_sha256: string };
      }) => {
        payload.source_tree.head_sha = "6".repeat(40);
      },
      expected: "source_tree.head_sha 与 remote.head_sha 不匹配",
    },
    {
      field: "scope",
      mutate: (payload: {
        source_tree: { entry_count: number; head_sha: string; source_paths: string[]; manifest_sha256: string };
      }) => {
        payload.source_tree.source_paths = ["README.md"];
      },
      expected: "source_tree.source_paths 与 metadata.source_paths 不匹配",
    },
    {
      field: "SHA-256",
      mutate: (payload: {
        source_tree: { entry_count: number; head_sha: string; source_paths: string[]; manifest_sha256: string };
      }) => {
        payload.source_tree.manifest_sha256 = "0".repeat(64);
      },
      expected: "source_tree.manifest_sha256 校验失败",
    },
  ])("diff 会拒绝 $field 被篡改的 source tree baseline", async ({ mutate, expected }) => {
    const head = "5555555555555555555555555555555555555555";
    mockGitExecFile((args) => {
      if (args[0] === "ls-remote") {
        return `${head}\tHEAD\n`;
      }

      if (args.includes("ls-tree")) {
        return `100644 blob ${"d".repeat(40)}\tLICENSE\0`;
      }

      return "";
    });

    const created = await runCli([
      "snapshot",
      "agent-skills",
      "--label",
      `tampered-tree-${Date.now()}-${expected.length}`,
      "--format",
      "json",
      "--with-remote",
    ]);
    const result = JSON.parse(created.stdout) as { snapshot_path: string };
    const absolutePath = join(workspaceRoot, result.snapshot_path);
    cleanupPaths.add(absolutePath);
    const payload = JSON.parse(readFileSync(absolutePath, "utf8")) as {
      source_tree: { entry_count: number; head_sha: string; source_paths: string[]; manifest_sha256: string };
    };
    mutate(payload);
    writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const diff = await runCli([
      "diff",
      "agent-skills",
      "--against",
      basename(result.snapshot_path),
      "--format",
      "json",
    ]);

    expect(diff.stdout).toBe("");
    expect(diff.stderr).toContain(expected);
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
