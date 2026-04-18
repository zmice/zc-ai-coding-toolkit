import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shutdownTeamRuntime, runTeamRuntime } from "../team.js";
import type { TeamSpec } from "../../team/orchestrator.js";

describe("team CLI helpers", () => {
  let stateDir: string;

  beforeEach(async () => {
    stateDir = await mkdtemp(join(tmpdir(), "zc-team-cli-"));
  });

  afterEach(async () => {
    await rm(stateDir, { recursive: true, force: true }).catch(() => {});
  });

  it("shutdownTeamRuntime should remove persisted team state after cleanup", async () => {
    const teamDir = join(stateDir, "demo-team");
    await mkdir(teamDir, { recursive: true });
    await writeFile(join(teamDir, "state.json"), '{"name":"demo-team"}', "utf-8");

    const session = {
      killSession: vi.fn().mockResolvedValue(undefined),
    };
    const worktree = {
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    await shutdownTeamRuntime("demo-team", stateDir, session, worktree);

    expect(session.killSession).toHaveBeenCalledWith("zc-demo-team");
    expect(worktree.cleanup).toHaveBeenCalledWith("demo-team");
    await expect(access(teamDir)).rejects.toThrow();
  });

  it("runTeamRuntime should clean up when the dispatch loop throws", async () => {
    const spec: TeamSpec = {
      name: "demo-team",
      workers: [{ id: "w1", cli: "codex" }],
      tasks: ["task 1"],
    };

    const session = {
      killSession: vi.fn().mockResolvedValue(undefined),
    };
    const worktree = {
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    const orchestrator = {
      startTeam: vi.fn().mockResolvedValue(undefined),
      runDispatchLoop: vi.fn().mockRejectedValue(new Error("dispatch failed")),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const signalHandlers = new Map<string, () => void | Promise<void>>();
    const signalProcess = {
      exitCode: undefined as number | undefined,
      on: vi.fn((signal: string, handler: () => void | Promise<void>) => {
        signalHandlers.set(signal, handler);
        return signalProcess;
      }),
      removeListener: vi.fn(() => signalProcess),
    };

    await expect(
      runTeamRuntime(spec, stateDir, session, worktree, orchestrator, signalProcess),
    ).rejects.toThrow("dispatch failed");

    expect(orchestrator.shutdown).toHaveBeenCalled();
    expect(session.killSession).toHaveBeenCalledWith("zc-demo-team");
    expect(worktree.cleanup).toHaveBeenCalledWith("demo-team");
    expect(signalHandlers.has("SIGINT")).toBe(true);
    expect(signalHandlers.has("SIGTERM")).toBe(true);
  });

  it("runTeamRuntime should clean up on SIGINT", async () => {
    const spec: TeamSpec = {
      name: "demo-team",
      workers: [{ id: "w1", cli: "codex" }],
      tasks: ["task 1"],
    };

    const session = {
      killSession: vi.fn().mockResolvedValue(undefined),
    };
    const worktree = {
      cleanup: vi.fn().mockResolvedValue(undefined),
    };

    let resolveLoop!: () => void;
    const loopPromise = new Promise<void>((resolve) => {
      resolveLoop = resolve;
    });

    const orchestrator = {
      startTeam: vi.fn().mockResolvedValue(undefined),
      runDispatchLoop: vi.fn().mockImplementation(() => loopPromise),
      shutdown: vi.fn().mockImplementation(async () => {
        resolveLoop();
      }),
    };

    const signalHandlers = new Map<string, () => void | Promise<void>>();
    const signalProcess = {
      exitCode: undefined as number | undefined,
      on: vi.fn((signal: string, handler: () => void | Promise<void>) => {
        signalHandlers.set(signal, handler);
        return signalProcess;
      }),
      removeListener: vi.fn(() => signalProcess),
    };

    const runtimePromise = runTeamRuntime(
      spec,
      stateDir,
      session,
      worktree,
      orchestrator,
      signalProcess,
    );

    const sigintHandler = signalHandlers.get("SIGINT");
    expect(sigintHandler).toBeDefined();
    await sigintHandler?.();
    await runtimePromise;

    expect(orchestrator.shutdown).toHaveBeenCalled();
    expect(session.killSession).toHaveBeenCalledWith("zc-demo-team");
    expect(worktree.cleanup).toHaveBeenCalledWith("demo-team");
    expect(signalProcess.exitCode).toBe(130);
  });
});
