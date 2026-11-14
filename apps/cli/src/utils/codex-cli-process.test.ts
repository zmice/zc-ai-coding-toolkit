import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runCodexCliCommand } from "./codex-cli-process.js";

const nodeSpawn = ((command: string, args: readonly string[], options: object) =>
  spawn(process.execPath, args, options)) as unknown as typeof spawn;

describe("bounded Codex CLI process", () => {
  it("preserves successful output and allows ordinary nonzero probes", async () => {
    const success = await runCodexCliCommand(["-e", "process.stdout.write('ok')"], {
      spawn: nodeSpawn,
    });
    expect(success.stdout).toBe("ok");
    expect(success.code).toBe(0);

    const failed = await runCodexCliCommand(["-e", "process.stderr.write('bad'); process.exit(3)"], {
      spawn: nodeSpawn,
      allowFailure: true,
    });
    expect(failed.code).toBe(3);
    expect(failed.stderr).toBe("bad");
  });

  it("reports nonzero and ENOENT with command context", async () => {
    await expect(runCodexCliCommand(["-e", "process.exit(4)"], { spawn: nodeSpawn }))
      .rejects.toThrow(/codex.*退出码为 4/);
    await expect(runCodexCliCommand(["--version"], {
      spawn: (() => spawn("missing-codex-executable-xyz", [])) as unknown as typeof spawn,
    })).rejects.toThrow(/codex.*未检测到/);
  });

  it("times out a hanging command even with allowFailure", async () => {
    await expect(runCodexCliCommand(["-e", "setInterval(() => {}, 1000)"], {
      spawn: nodeSpawn,
      timeoutMs: 100,
      allowFailure: true,
    })).rejects.toThrow(/codex.*timeout.*cleanup=.*exit=parent-confirmed/);
  });

  it("bounds combined output and kills a flood", async () => {
    await expect(runCodexCliCommand(["-e", "setInterval(() => {process.stdout.write('x'.repeat(4096)); process.stderr.write('y'.repeat(4096))}, 1)"], {
      spawn: nodeSpawn,
      maxOutputBytes: 8192,
      timeoutMs: 3000,
      allowFailure: true,
    })).rejects.toThrow(/codex.*output-limit.*cleanup=.*exit=parent-confirmed/);
  });

  it("cancels a running command", async () => {
    const controller = new AbortController();
    const initialSignals = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
    const pending = runCodexCliCommand(["-e", "setInterval(() => {}, 1000)"], {
      spawn: nodeSpawn,
      timeoutMs: 3000,
      signal: controller.signal,
      allowFailure: true,
    });
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(initialSignals.map((n) => n + 1));
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toThrow(/codex.*aborted.*cleanup=.*exit=parent-confirmed/);
    expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(initialSignals);
  });

  it("cancels on process signal and removes its handler", async () => {
    const before = new Set(process.listeners("SIGINT"));
    const pending = runCodexCliCommand(["-e", "setInterval(() => {}, 1000)"], {
      spawn: nodeSpawn,
      timeoutMs: 3000,
      allowFailure: true,
    });
    const handler = process.listeners("SIGINT").find((listener) => !before.has(listener));
    expect(handler).toBeDefined();
    handler!("SIGINT");
    await expect(pending).rejects.toThrow(/reason=aborted.*exit=parent-confirmed/);
    expect(new Set(process.listeners("SIGINT"))).toEqual(before);
  });

  it("decodes UTF-8 across chunks and accepts exactly the output limit", async () => {
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; pid: number };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 12345;
    const spawnSplit = (() => {
      queueMicrotask(() => {
        const stdout = Buffer.from("中文");
        const stderr = Buffer.from("错误");
        child.stdout.emit("data", stdout.subarray(0, 2));
        child.stderr.emit("data", stderr.subarray(0, 1));
        child.stdout.emit("data", stdout.subarray(2));
        child.stderr.emit("data", stderr.subarray(1));
        child.emit("close", 0, null);
      });
      return child;
    }) as unknown as typeof spawn;
    const result = await runCodexCliCommand(["plugin", "list"], {
      spawn: spawnSplit,
      maxOutputBytes: 12,
    });
    expect(result.stdout).toBe("中文");
    expect(result.stderr).toBe("错误");
  });

  it("releases its pipes and child when cleanup has no PID and close never arrives", async () => {
    vi.useFakeTimers();
    try {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        unref: ReturnType<typeof vi.fn>;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.unref = vi.fn();
      const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
      const pending = runCodexCliCommand(["plugin", "list"], {
        spawn: (() => child) as unknown as typeof spawn,
        timeoutMs: 10,
        allowFailure: true,
      });
      const assertion = expect(pending).rejects.toThrow(/reason=timeout; cleanup=no-pid; exit=unconfirmed; pid=unknown/);
      await vi.advanceTimersByTimeAsync(2010);
      await assertion;
      expect(child.stdout.destroyed).toBe(true);
      expect(child.stderr.destroyed).toBe(true);
      expect(child.unref).toHaveBeenCalledOnce();
      expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it("redacts credentials split across output chunks, args, mirror and failure", async () => {
    const secret = "SYNTHETIC_SECRET_42";
    const url = `https://user:${secret}@example.test/repo?token=${secret}#${secret}`;
    const makeSpawn = (exitCode: number) => (() => {
      const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; pid: number };
      child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 12345;
      queueMicrotask(() => {
        const output = `published ${url}`;
        const split = output.indexOf(secret) + 4;
        child.stdout.emit("data", Buffer.from(output.slice(0, split)));
        child.stdout.emit("data", Buffer.from(output.slice(split)));
        child.stderr.emit("data", Buffer.from(`auth=${secret}`));
        child.emit("close", exitCode, null);
      });
      return child;
    }) as unknown as typeof spawn;
    const mirror = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const mirrorError = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const result = await runCodexCliCommand(["plugin", "marketplace", "add", url], { spawn: makeSpawn(0), mirrorOutput: true });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(mirror.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(mirrorError.mock.calls)).not.toContain(secret);
      await expect(runCodexCliCommand(["plugin", "marketplace", "add", url], { spawn: makeSpawn(5), mirrorOutput: true }))
        .rejects.toThrow(/REDACTED/);
      expect(JSON.stringify(mirror.mock.calls)).not.toContain(secret);
      expect(JSON.stringify(mirrorError.mock.calls)).not.toContain(secret);
    } finally { mirror.mockRestore(); mirrorError.mockRestore(); }
  });

  it("allows internal rollback parsing from raw output without exposing raw result", async () => {
    const secret = "SYNTHETIC_ROLLBACK_SECRET_42";
    const source = `https://user:${secret}@example.test/repo?token=${secret}`;
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; pid: number };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 12345;
    const spawnRaw = (() => {
      queueMicrotask(() => {
        child.stdout.emit("data", Buffer.from(JSON.stringify({ marketplaces: [{ source }] })));
        child.emit("close", 0, null);
      });
      return child;
    }) as unknown as typeof spawn;
    let rollbackSource: string | undefined;
    const result = await runCodexCliCommand(["plugin", "marketplace", "list", "--json"], {
      spawn: spawnRaw,
      inspectRawOutput: ({ stdout }) => { rollbackSource = JSON.parse(stdout).marketplaces[0].source; },
    });
    expect(rollbackSource).toBe(source);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.parse(result.stdout).marketplaces[0].source).toContain("[REDACTED]");
  });

  it("sanitizes errors thrown by the internal output inspector", async () => {
    const secret = "SYNTHETIC_INSPECT_SECRET_42";
    const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; pid: number };
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.pid = 12345;
    const spawnRaw = (() => {
      queueMicrotask(() => { child.emit("close", 0, null); });
      return child;
    }) as unknown as typeof spawn;
    let caught: unknown;
    try {
      await runCodexCliCommand([`https://user:${secret}@example.test/repo`], {
        spawn: spawnRaw,
        inspectRawOutput: () => { throw new Error(`https://user:${secret}@example.test/repo?token=${secret}`); },
      });
    } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain(secret);
    expect((caught as Error).message).toContain("[REDACTED]");
  });
});
