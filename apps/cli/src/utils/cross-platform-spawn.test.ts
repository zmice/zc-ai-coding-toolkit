import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, it } from "vitest";

import { spawnCommand } from "./cross-platform-spawn.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("cross-platform command spawn", () => {
  it.runIf(process.platform === "win32")("executes npm-style cmd shims without enabling shell mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-windows-shim-"));
    tempDirs.push(root);
    await writeFile(join(root, "zc-test-shim.cmd"), "@echo off\r\necho windows-shim-ok\r\n", "utf8");

    const env = { ...process.env };
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "Path";
    env[pathKey] = [root, env[pathKey]].filter(Boolean).join(delimiter);

    const result = await new Promise<{ code: number | null; stdout: string }>((resolvePromise, rejectPromise) => {
      const child = spawnCommand("zc-test-shim", [], {
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.once("error", rejectPromise);
      child.once("close", (code) => resolvePromise({ code, stdout }));
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /windows-shim-ok/);
  });
});
