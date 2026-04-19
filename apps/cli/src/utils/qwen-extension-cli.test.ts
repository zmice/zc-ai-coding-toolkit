import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

type SpawnBehavior =
  | { type: "success" }
  | { type: "not-found" }
  | { type: "failure"; code?: number; stderr?: string; stdout?: string };

const spawnMock = vi.fn<(command: string, args: readonly string[], options: object) => EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
}>();

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

function createFakeChild(behavior: SpawnBehavior) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
  };

  child.stdout = new PassThrough();
  child.stderr = new PassThrough();

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

  it("treats uninstalling a missing extension as a no-op", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() =>
      createFakeChild({
        type: "failure",
        code: 1,
        stderr: "Extension not found.\n",
      }),
    );

    await expect(mod.updateQwenExtensionWithOfficialCli("zc-toolkit")).resolves.toBeUndefined();
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
