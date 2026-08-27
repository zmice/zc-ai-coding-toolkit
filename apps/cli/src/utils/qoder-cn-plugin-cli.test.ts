import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

type SpawnBehavior =
  | { type: "success" }
  | { type: "not-found" }
  | { type: "failure"; code?: number; stderr?: string; stdout?: string };

const spawnMock = vi.fn<(command: string, args: readonly string[], options: object) => EventEmitter & {
  stdin: PassThrough;
  stdout: PassThrough;
  stderr: PassThrough;
}>();

vi.mock("./cross-platform-spawn.js", () => ({
  spawnCommand: spawnMock,
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

  queueMicrotask(() => {
    if (behavior.type === "not-found") {
      child.emit("error", Object.assign(new Error("spawn qodercn ENOENT"), { code: "ENOENT" }));
      return;
    }

    if (behavior.type === "failure") {
      if (behavior.stdout) child.stdout.emit("data", Buffer.from(behavior.stdout));
      if (behavior.stderr) child.stderr.emit("data", Buffer.from(behavior.stderr));
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

const modPromise = import("./qoder-cn-plugin-cli.js");

describe("Qoder CN official plugin CLI wrapper", () => {
  it("maps generated plugin artifacts into a managed local bundle", async () => {
    const mod = await modPromise;
    const qoderRoot = resolve("/home/test/.qoder-cn");
    const bundleRoot = resolve(qoderRoot, ".zc/platform-bundles/qoder-cn/zc-toolkit");

    const plan = mod.toQoderCnOfficialCliInstallPlan({
      platform: "qoder-cn",
      packageName: "@zmice/platform-core",
      manifestSource: "toolkit-manifest",
      matchedAssets: [],
      destinationRoot: qoderRoot,
      scope: "global",
      overwrite: "error",
      artifacts: [
        { path: join(qoderRoot, ".qoder-plugin/plugin.json"), content: "{}\n" },
        { path: join(qoderRoot, "skills/start/SKILL.md"), content: "# start\n" },
      ],
    });

    assert.equal(plan.destinationRoot, qoderRoot);
    assert.deepEqual(plan.artifacts.map(({ path, content }) => ({ path, content })), [
      { path: join(bundleRoot, ".qoder-plugin/plugin.json"), content: "{}\n" },
      { path: join(bundleRoot, "skills/start/SKILL.md"), content: "# start\n" },
    ]);
  });

  it("validates and installs the bundle through qodercn plugins", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() => createFakeChild({ type: "success" }));
    const bundleRoot = resolve("/tmp/zc-qoder-cn-plugin");

    await expect(mod.installQoderCnPluginWithOfficialCli(bundleRoot)).resolves.toBeUndefined();

    assert.deepEqual(spawnMock.mock.calls.map(([command, args, options]) => ({ command, args, options })), [
      { command: "qodercn", args: ["plugins", "validate", bundleRoot], options: { stdio: "pipe" } },
      { command: "qodercn", args: ["plugins", "install", bundleRoot], options: { stdio: "pipe" } },
    ]);
  });

  it("fails explicitly instead of falling back to filesystem writes when qodercn is unavailable", async () => {
    const mod = await modPromise;
    spawnMock.mockImplementation(() => createFakeChild({ type: "not-found" }));

    await expect(mod.installQoderCnPluginWithOfficialCli(resolve("/tmp/plugin"))).rejects.toBeInstanceOf(
      mod.QoderCnOfficialCliUnavailableError,
    );
  });
});
