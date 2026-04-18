import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ────────────────────────────────────────────────────────
// 1. CLI 入口测试
// ────────────────────────────────────────────────────────
describe("CLI entry point", () => {
  const cliPath = resolve(__dirname, "../../dist/cli/index.js");

  it("zc --help outputs all subcommands", async () => {
    const { stdout } = await execFileAsync("node", [cliPath, "--help"]);
    for (const cmd of ["run", "team", "task", "msg", "doctor", "setup"]) {
      expect(stdout).toContain(cmd);
    }
  });

  it("zc --version outputs version number", async () => {
    const { stdout } = await execFileAsync("node", [cliPath, "--version"]);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ────────────────────────────────────────────────────────
// 2. 适配器注册测试
// ────────────────────────────────────────────────────────
describe("Adapter registry", () => {
  it("listAdapters() returns codex and qwen-code", async () => {
    // Importing the barrel triggers auto-registration
    const { listAdapters } = await import("../adapters/index.js");
    const names = listAdapters();
    expect(names).toContain("codex");
    expect(names).toContain("qwen-code");
  });

  it("getAdapter() returns adapter instances", async () => {
    const { getAdapter } = await import("../adapters/index.js");
    expect(getAdapter("codex")).toBeDefined();
    expect(getAdapter("qwen-code")).toBeDefined();
    expect(getAdapter("nonexistent")).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────
// 3. Skill 加载集成测试
// ────────────────────────────────────────────────────────
describe("Skill loader integration", () => {
  // Project root is zc/../../ = the actual workspace root
  const projectRoot = resolve(__dirname, "../../..");

  it("discoverSkills() finds skills including team-orchestration", async () => {
    const { discoverSkills } = await import("../utils/skill-loader.js");
    const skills = await discoverSkills(projectRoot);

    expect(skills.length).toBeGreaterThan(0);
    const names = skills.map((s) => s.name);
    expect(names).toContain("team-orchestration");
  });

  it("discoverCommands() finds commands", async () => {
    const { discoverCommands } = await import("../utils/skill-loader.js");
    const commands = await discoverCommands(projectRoot);

    expect(commands.length).toBeGreaterThan(0);
    const names = commands.map((c) => c.name);
    // Spot-check some known commands
    expect(names).toContain("spec");
    expect(names).toContain("build");
  });

  it("matchSkills() matches team-orchestration for relevant task", async () => {
    const { discoverSkills, matchSkills } = await import("../utils/skill-loader.js");
    const skills = await discoverSkills(projectRoot);

    // Use English keywords since matchSkills splits skill name by '-'
    const matched = matchSkills("team orchestration task", skills);
    const matchedNames = matched.map((s) => s.name);
    expect(matchedNames).toContain("team-orchestration");
  });
});

// ────────────────────────────────────────────────────────
// 4. TaskQueue + Mailbox 协作测试
// ────────────────────────────────────────────────────────
describe("TaskQueue + Mailbox collaboration", () => {
  let teamDir: string;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "integ-tq-mb-"));
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("full lifecycle: create → claim → message → transition → verify", async () => {
    const { TaskQueue } = await import("../team/task-queue.js");
    const { Mailbox } = await import("../team/mailbox.js");

    const queue = new TaskQueue(teamDir);
    await queue.load();
    const mailbox = new Mailbox(teamDir);
    await mailbox.load();

    // 1. Create a task
    const task = await queue.create({
      title: "Implement auth",
      description: "Implement user authentication module",
      dependencies: [],
      files: ["src/auth.ts"],
    });
    expect(task.status).toBe("pending");

    // 2. Worker claims the task
    const { task: claimed, token } = await queue.claim(task.id, "worker-1");
    expect(claimed.status).toBe("claimed");

    // 3. Worker sends a status message
    const msg = await mailbox.send("worker-1", "leader", `Starting task: ${task.id}`);
    expect(msg.status).toBe("pending");

    // 4. Transition to in_progress
    const inProgress = await queue.transition(task.id, token, "in_progress");
    expect(inProgress.status).toBe("in_progress");

    // 5. Leader replies
    const reply = await mailbox.send("leader", "worker-1", "Acknowledged");
    await mailbox.markDelivered(reply.id);

    // 6. Worker completes task
    const completed = await queue.transition(task.id, token, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.claimToken).toBeUndefined();

    // 7. Verify final state
    const allTasks = queue.list();
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].status).toBe("completed");

    const allMsgs = mailbox.allMessages();
    expect(allMsgs).toHaveLength(2);

    const workerMsgs = mailbox.list("worker-1");
    expect(workerMsgs.some((m) => m.body === "Acknowledged")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────
// 5. Orchestrator 端到端测试（mock tmux/git）
// ────────────────────────────────────────────────────────
describe("Orchestrator end-to-end (mocked)", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), "integ-orch-"));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true }).catch(() => {});
  });

  it("startTeam → dispatch → shutdown lifecycle", async () => {
    const { Orchestrator } = await import("../team/orchestrator.js");
    type TeamSpec = import("../team/orchestrator.js").TeamSpec;

    // Create mock SessionManager
    const mockSession = {
      createSession: vi.fn().mockResolvedValue("zc-test-team"),
      createPane: vi.fn().mockResolvedValue("zc-test-team:0"),
      sendKeys: vi.fn().mockResolvedValue(undefined),
      captureOutput: vi.fn().mockResolvedValue(""),
      killPane: vi.fn().mockResolvedValue(undefined),
      killSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
      isAvailable: vi.fn().mockResolvedValue(true),
    };

    // Create mock WorktreeManager
    const mockWorktree = {
      create: vi.fn().mockResolvedValue("/tmp/fake-worktree"),
      remove: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      mergeTo: vi.fn().mockResolvedValue({ success: true, message: "" }),
      cleanup: vi.fn().mockResolvedValue(undefined),
      prune: vi.fn().mockResolvedValue(undefined),
    };

    const orchestrator = new Orchestrator(
      stateDir,
      mockSession as any,
      mockWorktree as any,
    );

    const spec: TeamSpec = {
      name: "test-team",
      workers: [
        { id: "w1", cli: "codex" },
        { id: "w2", cli: "qwen-code" },
      ],
      tasks: ["Implement authentication", "Implement data model"],
    };

    // 1. Start team
    await orchestrator.startTeam(spec);

    // Verify session created
    expect(mockSession.createSession).toHaveBeenCalledWith("zc-test-team");

    // Verify workers spawned (2 workers → 2 worktree creates + 2 pane creates)
    expect(mockWorktree.create).toHaveBeenCalledTimes(2);
    expect(mockSession.createPane).toHaveBeenCalledTimes(2);

    // 2. Verify tasks created
    const status = await orchestrator.getStatus();
    expect(status.name).toBe("test-team");
    expect(status.workers).toHaveLength(2);
    expect(status.tasks.pending + status.tasks.running).toBeGreaterThanOrEqual(2);

    // 3. Run one dispatch iteration — tasks should be assigned to idle workers
    await orchestrator.dispatchOnce();

    const statusAfterDispatch = await orchestrator.getStatus();
    // After dispatch, tasks should move from pending to running
    expect(statusAfterDispatch.tasks.running).toBeGreaterThanOrEqual(1);

    // Verify sendKeys was called (CLI command sent to worker panes)
    expect(mockSession.sendKeys).toHaveBeenCalled();

    // 4. Shutdown
    await orchestrator.shutdown();

    // Verify cleanup
    expect(mockSession.killPane).toHaveBeenCalled();
    expect(mockSession.killSession).toHaveBeenCalledWith("zc-test-team");
  });
});

// ────────────────────────────────────────────────────────
// 6. 中文技能匹配测试
// ────────────────────────────────────────────────────────
describe("Chinese skill matching", () => {
  const projectRoot = resolve(__dirname, "../../..");

  it("should match Chinese task description to relevant skills", async () => {
    const { discoverSkills, matchSkills } = await import("../utils/skill-loader.js");
    const skills = await discoverSkills(projectRoot);

    // 中文任务描述应能匹配到相关技能
    const result = matchSkills("修复登录页面的bug", skills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "debugging-and-error-recovery")).toBe(true);
  });

  it("should match Chinese performance task to performance skill", async () => {
    const { discoverSkills, matchSkills } = await import("../utils/skill-loader.js");
    const skills = await discoverSkills(projectRoot);

    const result = matchSkills("优化页面加载性能", skills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "performance-optimization")).toBe(true);
  });

  it("should match Chinese test task to TDD skill", async () => {
    const { discoverSkills, matchSkills } = await import("../utils/skill-loader.js");
    const skills = await discoverSkills(projectRoot);

    const result = matchSkills("为模块编写单元测试", skills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "test-driven-development")).toBe(true);
  });
});
