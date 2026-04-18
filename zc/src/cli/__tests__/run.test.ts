import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseRunOptions, executeRun, type RunOptions } from "../run.js";

// Mock the adapters module
vi.mock("../../adapters/index.js", () => {
  return {
    getAdapter: vi.fn(),
    listAdapters: vi.fn(() => ["codex", "qwen-code"]),
  };
});

import { getAdapter, listAdapters } from "../../adapters/index.js";
const mockGetAdapter = vi.mocked(getAdapter);
const mockListAdapters = vi.mocked(listAdapters);

describe("parseRunOptions", () => {
  it("should use default values when no options provided", () => {
    const result = parseRunOptions(undefined, {});
    expect(result.prompt).toBeUndefined();
    expect(result.options.cli).toBe("codex");
    expect(result.options.model).toBeUndefined();
    expect(result.options.workdir).toBe(process.cwd());
  });

  it("should use provided prompt", () => {
    const result = parseRunOptions("fix the bug", {});
    expect(result.prompt).toBe("fix the bug");
  });

  it("should treat empty string prompt as undefined", () => {
    const result = parseRunOptions("", {});
    expect(result.prompt).toBeUndefined();
  });

  it("should use custom cli option", () => {
    const result = parseRunOptions(undefined, { cli: "qwen-code" });
    expect(result.options.cli).toBe("qwen-code");
  });

  it("should use custom model", () => {
    const result = parseRunOptions(undefined, { model: "gpt-4" });
    expect(result.options.model).toBe("gpt-4");
  });

  it("should use custom workdir", () => {
    const result = parseRunOptions(undefined, { workdir: "/tmp/project" });
    expect(result.options.workdir).toBe("/tmp/project");
  });

  it("should handle all options together", () => {
    const result = parseRunOptions("build it", {
      cli: "qwen-code",
      model: "qwen-max",
      workdir: "/home/user/proj",
    });
    expect(result.prompt).toBe("build it");
    expect(result.options.cli).toBe("qwen-code");
    expect(result.options.model).toBe("qwen-max");
    expect(result.options.workdir).toBe("/home/user/proj");
  });
});

describe("executeRun", () => {
  let originalExitCode: number | string | null | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it("should error when adapter is not found", async () => {
    mockGetAdapter.mockReturnValue(undefined);
    mockListAdapters.mockReturnValue(["codex", "qwen-code"]);

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await executeRun("hello", { cli: "unknown-cli", workdir: "/tmp" });

    expect(process.exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("未知的 CLI 适配器"),
    );
    errSpy.mockRestore();
  });

  it("should error when CLI is not installed (detect returns false)", async () => {
    const mockAdapter = {
      name: "codex",
      detect: vi.fn().mockResolvedValue(false),
      version: vi.fn(),
      spawn: vi.fn(),
      injectContext: vi.fn(),
      healthCheck: vi.fn(),
    };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await executeRun("hello", { cli: "codex", workdir: "/tmp" });

    expect(process.exitCode).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("未安装或不可用"),
    );
    expect(mockAdapter.detect).toHaveBeenCalled();
    expect(mockAdapter.spawn).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("should spawn worker and forward output when CLI is available", async () => {
    const { EventEmitter } = await import("node:events");

    const fakeProc = new EventEmitter();
    const fakeStdout = new EventEmitter();
    const fakeStderr = new EventEmitter();
    Object.assign(fakeProc, { stdout: fakeStdout, stderr: fakeStderr });

    const mockWorker = {
      pid: 12345,
      process: fakeProc as any,
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const mockAdapter = {
      name: "codex",
      detect: vi.fn().mockResolvedValue(true),
      version: vi.fn(),
      spawn: vi.fn().mockResolvedValue(mockWorker),
      injectContext: vi.fn(),
      healthCheck: vi.fn(),
    };
    mockGetAdapter.mockReturnValue(mockAdapter);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    // Start executeRun (it will await the close event)
    const runPromise = executeRun("build the app", {
      cli: "codex",
      model: "o3",
      workdir: "/tmp/proj",
    });

    // Allow async code in executeRun to proceed before emitting events
    await new Promise((r) => setTimeout(r, 50));

    // Simulate output
    fakeStdout.emit("data", Buffer.from("hello stdout"));
    fakeStderr.emit("data", Buffer.from("hello stderr"));

    // Simulate process exit
    fakeProc.emit("close", 0);

    await runPromise;

    expect(mockAdapter.spawn).toHaveBeenCalledWith({
      workdir: "/tmp/proj",
      model: "o3",
      prompt: "build the app",
    });
    expect(stdoutWriteSpy).toHaveBeenCalledWith(Buffer.from("hello stdout"));
    expect(stderrWriteSpy).toHaveBeenCalledWith(Buffer.from("hello stderr"));
    expect(process.exitCode).toBe(0);

    logSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
  });

  it("should propagate non-zero exit code", async () => {
    const { EventEmitter } = await import("node:events");

    const fakeProc = new EventEmitter();
    Object.assign(fakeProc, { stdout: new EventEmitter(), stderr: new EventEmitter() });

    const mockWorker = {
      pid: 99,
      process: fakeProc as any,
      kill: vi.fn().mockResolvedValue(undefined),
    };

    const mockAdapter = {
      name: "codex",
      detect: vi.fn().mockResolvedValue(true),
      version: vi.fn(),
      spawn: vi.fn().mockResolvedValue(mockWorker),
      injectContext: vi.fn(),
      healthCheck: vi.fn(),
    };
    mockGetAdapter.mockReturnValue(mockAdapter);

    vi.spyOn(console, "log").mockImplementation(() => {});

    const runPromise = executeRun("task", { cli: "codex", workdir: "/tmp" });
    await new Promise((r) => setTimeout(r, 50));
    fakeProc.emit("close", 42);
    await runPromise;

    expect(process.exitCode).toBe(42);

    vi.restoreAllMocks();
  });
});
