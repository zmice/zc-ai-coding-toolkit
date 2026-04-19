import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

type SpawnBehavior =
  | { type: "success" }
  | { type: "success-on-input" }
  | { type: "not-found" }
  | { type: "failure"; code?: number; stderr?: string; stdout?: string };

const spawnMock = vi.fn<(command: string, args: readonly string[], options: object) => EventEmitter & {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
}>();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

function createFakeChild(behavior: SpawnBehavior) {
  const child = new EventEmitter() as EventEmitter & {
    stdin: PassThrough;
    stdout: PassThrough;
    stderr: PassThrough;
  };

  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

  if (behavior.type === "success-on-input") {
    child.stdin.once("data", () => {
      child.emit("close", 0, null);
    });
  }

  queueMicrotask(() => {
    if (behavior.type === "not-found") {
      const error = Object.assign(new Error("spawn qwen ENOENT"), { code: "ENOENT" });
      child.emit("error", error);
      return;
    }

    if (behavior.type === "failure") {
      if (behavior.stdout) {
        child.stdout.emit("data", Buffer.from(behavior.stdout));
      }
      if (behavior.stderr) {
        child.stderr.emit("data", Buffer.from(behavior.stderr));
      }
      child.emit("close", behavior.code ?? 1, null);
      return;
    }

    if (behavior.type === "success-on-input") { return; }

    child.emit("close", 0, null);
  });

  return child;
}

afterEach(() => {
  spawnMock.mockReset();
});

const modPromise = import("./qwen-extension-cli.js");

describe("qwen official CLI wrapper", () => {
  it("maps install plan artifacts into a standalone release bundle", async () => {
    const mod = await modPromise;

    const artifacts = mod.toQwenOfficialCliReleaseArtifacts(
      {
        destinationRoot: "/home/test/.qwen",
        capability: {
          extension: {
            relativeDir: "extensions",
            name: "zc-toolkit",
          },
        },
        artifacts: [
          {
            path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md",
            content: "# context\n",
          },
          {
            path: "/home/test/.qwen/extensions/zc-toolkit/commands/zc/start.md",
            content: "# start\n",
          },
        ],
      },
      "/tmp/zc-toolkit",
    );

    assert.deepEqual(artifacts, [
      {
        path: "/tmp/zc-toolkit/QWEN.md",
        content: "# context\n",
      },
      {
        path: "/tmp/zc-toolkit/commands/zc/start.md",
        content: "# start\n",
      },
    ]);
  });

  it("uses the official update command for repo-managed extensions", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() =>
      createFakeChild({
        type: "success",
      }),
    );

    await expect(mod.updateQwenExtensionWithOfficialCli("zc-toolkit")).resolves.toBeUndefined();
    assert.equal(spawnMock.mock.calls.length, 1);
    assert.deepEqual(spawnMock.mock.calls[0]?.[1], ["extensions", "update", "zc-toolkit"]);
    assert.deepEqual(spawnMock.mock.calls[0]?.[2], { stdio: "pipe" });
  });

  it("forwards interactive stdin to the qwen child process", async () => {
    const mod = await modPromise;
    const input = new PassThrough();
    const originalStdin = process.stdin;

    spawnMock.mockImplementation(() =>
      createFakeChild({
        type: "success-on-input",
      }),
    );

    Object.defineProperty(process, "stdin", {
      configurable: true,
      value: input,
    });

    try {
      const installPromise = mod.installQwenExtensionFromOfficialRepoWithCli(
        "https://github.com/zmice/zc-qwen-extension.git",
      );

      const child = spawnMock.mock.results[0]?.value;
      assert.ok(child);
      const forwardedChunks: string[] = [];
      child.stdin.on("data", (chunk: Buffer | string) => {
        forwardedChunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      });
      input.write("Y\n");

      await expect(installPromise).resolves.toBeUndefined();
      assert.equal(forwardedChunks.join(""), "Y\n");
    } finally {
      Object.defineProperty(process, "stdin", {
        configurable: true,
        value: originalStdin,
      });
    }
  });

  it("treats uninstalling a missing extension as a no-op", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() =>
      createFakeChild({
        type: "failure",
        code: 1,
        stderr: "Extension not found.\n",
      }),
    );

    await expect(mod.uninstallQwenExtensionWithOfficialCli("zc-toolkit")).resolves.toBeUndefined();
    assert.equal(spawnMock.mock.calls.length, 1);
    assert.deepEqual(spawnMock.mock.calls[0]?.[1], ["extensions", "uninstall", "zc-toolkit"]);
  });

  it("still throws for other qwen CLI failures", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() =>
      createFakeChild({
        type: "failure",
        code: 2,
        stderr: "Permission denied.\n",
      }),
    );

    await expect(mod.updateQwenExtensionWithOfficialCli("zc-toolkit")).rejects.toThrow(
      /退出码为 2/,
    );
  });
});
