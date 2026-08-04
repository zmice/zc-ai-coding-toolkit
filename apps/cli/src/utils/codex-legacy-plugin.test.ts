import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import {
  isCodexLegacyDirectPluginPath,
  quarantineCodexLegacyDirectPlugin,
  restoreCodexLegacyDirectPlugin,
} from "./codex-legacy-plugin.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "zc-codex-legacy-plugin-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0, tempDirs.length).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Codex legacy direct plugin migration", () => {
  it("recognizes only the exact legacy direct plugin location on Windows", () => {
    assert.equal(
      isCodexLegacyDirectPluginPath("C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit"),
      true,
    );
    assert.equal(
      isCodexLegacyDirectPluginPath("C:\\Users\\zmice\\.codex\\plugins\\cache\\zc-toolkit"),
      false,
    );
    assert.equal(
      isCodexLegacyDirectPluginPath("C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit-copy"),
      false,
    );
  });

  it("refuses to move any path outside the exact legacy plugin boundary", async () => {
    await assert.rejects(
      quarantineCodexLegacyDirectPlugin(
        "C:\\Users\\zmice\\.codex\\plugins\\cache\\zc-toolkit",
        "0.5.0",
      ),
      /拒绝迁移非 Codex 旧直装目录/,
    );
  });

  it("moves the shadowing plugin outside the discovery directory without deleting its contents", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const manifestPath = join(pluginPath, ".codex-plugin", "plugin.json");
    await mkdir(join(pluginPath, ".codex-plugin"), { recursive: true });
    await writeFile(manifestPath, '{"version":"0.5.0"}\n', "utf8");

    const quarantine = await quarantineCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );

    assert.equal(quarantine.moved, true);
    assert.equal(quarantine.originalPath, pluginPath);
    assert.equal(
      quarantine.backupPath,
      join(root, ".codex", "platform-state", "legacy-plugin-backups", "zc-toolkit-0.5.0-20260805T031530000Z"),
    );
    await assert.rejects(readFile(manifestPath, "utf8"), { code: "ENOENT" });
    assert.equal(
      await readFile(join(quarantine.backupPath!, ".codex-plugin", "plugin.json"), "utf8"),
      '{"version":"0.5.0"}\n',
    );
  });

  it("restores a quarantined plugin when the replacement install fails", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    await mkdir(pluginPath, { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    const quarantine = await quarantineCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );

    await restoreCodexLegacyDirectPlugin(quarantine);

    assert.equal(await readFile(join(pluginPath, "legacy.txt"), "utf8"), "preserve me\n");
    await assert.rejects(readFile(join(quarantine.backupPath!, "legacy.txt"), "utf8"), { code: "ENOENT" });
  });
});
