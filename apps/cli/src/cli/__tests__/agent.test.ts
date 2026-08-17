import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../index.js";

const cleanupPaths = new Set<string>();
const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return result.stdout.trim();
}

async function createRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zc-agent-worktree-cli-repo-"));
  cleanupPaths.add(root);
  await git(root, "init", "-b", "main");
  await git(root, "config", "user.name", "zc test");
  await git(root, "config", "user.email", "zc-test@example.invalid");
  await writeFile(join(root, "README.md"), "# fixture\n", "utf8");
  await git(root, "add", "README.md");
  await git(root, "commit", "-m", "test: init");
  return root;
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

describe("agent controller CLI", () => {
  afterEach(async () => {
    for (const path of cleanupPaths) {
      await rm(path, { recursive: true, force: true });
    }
    cleanupPaths.clear();
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("creates a ready context-fanout dry-run plan for independent writable tasks", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-plan-"));
    cleanupPaths.add(root);

    const result = await runCli([
      "agent",
      "plan",
      "--dir",
      root,
      "--run-id",
      "agent-test",
      "--tasks",
      "API | files=src/api.ts,src/api.test.ts | verify=pnpm test",
      "UI | files=src/ui.ts,src/ui.test.ts | verify=pnpm test",
      "--json",
    ]);
    const plan = JSON.parse(result.stdout) as {
      status: string;
      mode: string;
      dry_run: boolean;
      dispatch_contract: { dispatch_now: string };
      tasks: Array<{
        model: string;
        artifactPaths: { brief: string; report: string; reviewPackage: string; review: string };
      }>;
      artifacts: { root: string };
    };

    expect(result.stderr).toBe("");
    expect(plan.status).toBe("ready");
    expect(plan.mode).toBe("context-fanout");
    expect(plan.dry_run).toBe(true);
    expect(plan.dispatch_contract.dispatch_now).toBe("no");
    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[0]?.model).toBe("platform-default");
    expect(plan.tasks[0]?.artifactPaths.reviewPackage).toBe(
      ".codex/work/agent-runs/agent-test/review-packages/task-001.md",
    );
    expect(plan.artifacts.root).toBe(".codex/work/agent-runs/agent-test");
  });

  it("blocks writable tasks that do not declare verification", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-missing-verify-"));
    cleanupPaths.add(root);

    const result = await runCli([
      "agent",
      "plan",
      "--dir",
      root,
      "--tasks",
      "API | files=src/api.ts",
      "--json",
    ]);
    const plan = JSON.parse(result.stdout) as {
      status: string;
      blockers: string[];
    };

    expect(result.stderr).toBe("");
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("missing-verification");
    expect(process.exitCode).toBe(1);
  });

  it("blocks requested context-fanout when writable tasks overlap files", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-conflict-"));
    cleanupPaths.add(root);

    const result = await runCli([
      "agent",
      "plan",
      "--dir",
      root,
      "--mode",
      "context-fanout",
      "--tasks",
      "A | files=src/shared.ts | verify=pnpm test",
      "B | files=src/shared.ts | verify=pnpm test",
      "--json",
    ]);
    const plan = JSON.parse(result.stdout) as {
      status: string;
      blockers: string[];
      conflicts: Array<{ kind: string; severity: string; path: string }>;
    };

    expect(result.stderr).toBe("");
    expect(plan.status).toBe("blocked");
    expect(plan.blockers).toContain("file-conflicts");
    expect(plan.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "file-overlap", severity: "blocker", path: "src/shared.ts" }),
      ]),
    );
  });

  it("writes controller run artifacts when requested", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-write-"));
    cleanupPaths.add(root);

    const result = await runCli([
      "agent",
      "plan",
      "--dir",
      root,
      "--run-id",
      "agent-write",
      "--tasks",
      "API | files=src/api.ts | verify=pnpm test | intent=backend",
      "--write",
      "--json",
    ]);
    const plan = JSON.parse(result.stdout) as {
      dry_run: boolean;
      written: string[];
    };
    const brief = await readFile(join(root, ".codex/work/agent-runs/agent-write/tasks/task-001.md"), "utf8");
    const reviewPackage = await readFile(
      join(root, ".codex/work/agent-runs/agent-write/review-packages/task-001.md"),
      "utf8",
    );
    const fanIn = await readFile(join(root, ".codex/work/agent-runs/agent-write/fan-in.md"), "utf8");

    expect(result.stderr).toBe("");
    expect(plan.dry_run).toBe(false);
    expect(plan.written).toEqual(
      expect.arrayContaining([
        ".codex/work/agent-runs/agent-write/plan.json",
        ".codex/work/agent-runs/agent-write/ledger.md",
        ".codex/work/agent-runs/agent-write/fan-in.md",
        ".codex/work/agent-runs/agent-write/tasks/task-001.md",
        ".codex/work/agent-runs/agent-write/reports/task-001.md",
        ".codex/work/agent-runs/agent-write/review-packages/task-001.md",
        ".codex/work/agent-runs/agent-write/reviews/task-001.md",
      ]),
    );
    expect(brief).toContain("Allowed files:");
    expect(brief).toContain("- src/api.ts");
    expect(brief).toContain("Intent: backend");
    expect(brief).toContain("Model: platform-default");
    expect(brief).toContain("review package: .codex/work/agent-runs/agent-write/review-packages/task-001.md");
    expect(reviewPackage).toContain("do not paste full conversation history");
    expect(reviewPackage).toContain("do not re-run implementer tests unless");
    expect(fanIn).toContain("controller runs final verification before completion");
    expect(fanIn).toContain("review package exists for each task before reviewer handoff");
  });

  it("keeps Codex worktree preparation dry-run by default and safely cleans an applied lease", async () => {
    const root = await createRepository();
    const tempRoot = await mkdtemp(join(tmpdir(), "zc-agent-worktree-cli-temp-"));
    cleanupPaths.add(tempRoot);
    const baseArgs = [
      "--dir",
      root,
      "--temp-root",
      tempRoot,
      "--run-id",
      "run-cli",
      "--task-id",
      "task-cli",
      "--json",
    ];

    const dryRunResult = await runCli(["agent", "worktree", "prepare", ...baseArgs]);
    const dryRun = JSON.parse(dryRunResult.stdout) as {
      dryRun: boolean;
      path: string;
      receiptPath: string;
    };
    expect(dryRunResult.stderr).toBe("");
    expect(dryRun.dryRun).toBe(true);
    await expect(access(dryRun.path)).rejects.toThrow();
    await expect(access(dryRun.receiptPath)).rejects.toThrow();

    const prepareResult = await runCli(["agent", "worktree", "prepare", ...baseArgs, "--apply"]);
    const lease = JSON.parse(prepareResult.stdout) as {
      path: string;
      receiptPath: string;
      branch: string;
    };
    expect(prepareResult.stderr).toBe("");
    await access(lease.path);
    await access(lease.receiptPath);

    const cleanupResult = await runCli([
      "agent",
      "worktree",
      "cleanup",
      ...baseArgs,
      "--agent-state",
      "completed",
      "--fan-in-collected",
      "--apply",
    ]);
    const cleanup = JSON.parse(cleanupResult.stdout) as {
      status: string;
      branchPreserved: boolean;
    };
    expect(cleanupResult.stderr).toBe("");
    expect(cleanup.status).toBe("released");
    expect(cleanup.branchPreserved).toBe(false);
    await expect(access(lease.path)).rejects.toThrow();
    await expect(access(lease.receiptPath)).rejects.toThrow();
  });
});
