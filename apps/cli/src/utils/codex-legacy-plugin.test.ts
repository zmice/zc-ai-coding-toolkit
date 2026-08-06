import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "vitest";

import {
  backupCodexLegacyDirectPlugin,
  detachCodexLegacyDirectPlugin,
  isCodexLegacyDirectPluginPath,
  resolveCodexLegacyPersonalMarketplacePath,
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
    assert.equal(
      resolveCodexLegacyPersonalMarketplacePath(
        "C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit",
      ),
      "C:\\Users\\zmice\\.agents\\plugins\\marketplace.json",
    );
  });

  it("refuses to back up any path outside the exact legacy plugin boundary", async () => {
    await assert.rejects(
      backupCodexLegacyDirectPlugin(
        "C:\\Users\\zmice\\.codex\\plugins\\cache\\zc-toolkit",
        "0.5.0",
      ),
      /拒绝迁移非 Codex 旧直装目录/,
    );
  });

  it("copies a recoverable backup while keeping the old source readable for official removal", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const manifestPath = join(pluginPath, ".codex-plugin", "plugin.json");
    await mkdir(join(pluginPath, ".codex-plugin"), { recursive: true });
    await writeFile(manifestPath, '{"version":"0.5.0"}\n', "utf8");

    const backup = await backupCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );

    assert.equal(backup.copied, true);
    assert.equal(backup.originalPath, pluginPath);
    assert.equal(
      backup.backupPath,
      join(root, ".codex", "platform-state", "legacy-plugin-backups", "zc-toolkit-0.5.0-20260805T031530000Z"),
    );
    assert.equal(await readFile(manifestPath, "utf8"), '{"version":"0.5.0"}\n');
    assert.equal(
      await readFile(join(backup.backupPath!, ".codex-plugin", "plugin.json"), "utf8"),
      '{"version":"0.5.0"}\n',
    );
  });

  it("detaches the old source only after a verified backup exists", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    await mkdir(pluginPath, { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    const backup = await backupCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );

    await detachCodexLegacyDirectPlugin(backup);

    await assert.rejects(readFile(join(pluginPath, "legacy.txt"), "utf8"), { code: "ENOENT" });
    assert.equal(await readFile(join(backup.backupPath!, "legacy.txt"), "utf8"), "preserve me\n");
  });

  it("detaches the auto-discovered personal marketplace entry that shadows the Git source", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
    const marketplaceContent = `${JSON.stringify({
      name: "zc-toolkit",
      plugins: [
        {
          name: "zc-toolkit",
          source: {
            source: "local",
            path: "./.codex/plugins/zc-toolkit",
          },
        },
      ],
    }, null, 2)}\n`;
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(root, ".agents", "plugins"), { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    await writeFile(marketplacePath, marketplaceContent, "utf8");

    const backup = await backupCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );

    assert.deepEqual(backup.personalMarketplace, {
      originalPath: marketplacePath,
      backupPath: `${backup.backupPath}.personal-marketplace.json`,
      legacyEntryCount: 1,
    });
    assert.equal(
      await readFile(backup.personalMarketplace!.backupPath, "utf8"),
      marketplaceContent,
    );

    await detachCodexLegacyDirectPlugin(backup);

    await assert.rejects(readFile(marketplacePath, "utf8"), { code: "ENOENT" });
    await assert.rejects(readFile(join(pluginPath, "legacy.txt"), "utf8"), { code: "ENOENT" });
  });

  it("removes only the owned legacy entry from a shared personal marketplace", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(root, ".agents", "plugins"), { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    await writeFile(marketplacePath, `${JSON.stringify({
      name: "zc-toolkit",
      plugins: [
        {
          name: "zc-toolkit",
          source: { source: "local", path: "./.codex/plugins/zc-toolkit" },
        },
        {
          name: "other-plugin",
          source: { source: "local", path: "./plugins/other-plugin" },
        },
      ],
    }, null, 2)}\n`, "utf8");
    const backup = await backupCodexLegacyDirectPlugin(pluginPath, "0.5.0");

    await detachCodexLegacyDirectPlugin(backup);

    const remaining = JSON.parse(await readFile(marketplacePath, "utf8")) as {
      plugins: Array<{ name: string }>;
    };
    assert.deepEqual(remaining.plugins.map((plugin) => plugin.name), ["other-plugin"]);
  });

  it("refuses to detach the old source when the backup is outside the managed backup directory", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const unmanagedBackupPath = join(root, "unmanaged", "zc-toolkit-0.5.0");
    await mkdir(pluginPath, { recursive: true });
    await mkdir(unmanagedBackupPath, { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");

    await assert.rejects(
      detachCodexLegacyDirectPlugin({
        originalPath: pluginPath,
        backupPath: unmanagedBackupPath,
        copied: true,
      }),
      /拒绝使用非受管 Codex 旧插件备份/,
    );

    assert.equal(await readFile(join(pluginPath, "legacy.txt"), "utf8"), "preserve me\n");
  });

  it("refuses an unowned personal marketplace backup before removing the legacy plugin", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const backupPath = join(
      root,
      ".codex",
      "platform-state",
      "legacy-plugin-backups",
      "zc-toolkit-0.5.0",
    );
    await mkdir(pluginPath, { recursive: true });
    await mkdir(backupPath, { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");

    await assert.rejects(
      detachCodexLegacyDirectPlugin({
        originalPath: pluginPath,
        backupPath,
        copied: true,
        personalMarketplace: {
          originalPath: join(root, ".agents", "plugins", "marketplace.json"),
          backupPath: join(root, "unmanaged", "marketplace.json"),
          legacyEntryCount: 1,
        },
      }),
      /拒绝使用非受管 Codex personal marketplace 备份/,
    );

    assert.equal(await readFile(join(pluginPath, "legacy.txt"), "utf8"), "preserve me\n");
  });

  it("restores a detached plugin when the replacement install fails", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    await mkdir(pluginPath, { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    const backup = await backupCodexLegacyDirectPlugin(
      pluginPath,
      "0.5.0",
      new Date("2026-08-05T03:15:30.000Z"),
    );
    await detachCodexLegacyDirectPlugin(backup);

    await restoreCodexLegacyDirectPlugin(backup);

    assert.equal(await readFile(join(pluginPath, "legacy.txt"), "utf8"), "preserve me\n");
    await assert.rejects(readFile(join(backup.backupPath!, "legacy.txt"), "utf8"), { code: "ENOENT" });
  });

  it("restores the exact personal marketplace after a replacement install failure", async () => {
    const root = await createTempDir();
    const pluginPath = join(root, ".codex", "plugins", "zc-toolkit");
    const marketplacePath = join(root, ".agents", "plugins", "marketplace.json");
    const marketplaceContent = `${JSON.stringify({
      name: "zc-toolkit",
      interface: { displayName: "Legacy marketplace" },
      plugins: [
        {
          name: "zc-toolkit",
          source: { source: "local", path: "./.codex/plugins/zc-toolkit" },
        },
        {
          name: "other-plugin",
          source: { source: "local", path: "./plugins/other-plugin" },
        },
      ],
    }, null, 2)}\n`;
    await mkdir(pluginPath, { recursive: true });
    await mkdir(join(root, ".agents", "plugins"), { recursive: true });
    await writeFile(join(pluginPath, "legacy.txt"), "preserve me\n", "utf8");
    await writeFile(marketplacePath, marketplaceContent, "utf8");
    const backup = await backupCodexLegacyDirectPlugin(pluginPath, "0.5.0");
    await detachCodexLegacyDirectPlugin(backup);

    await restoreCodexLegacyDirectPlugin(backup);

    assert.equal(await readFile(marketplacePath, "utf8"), marketplaceContent);
    assert.equal(await readFile(join(pluginPath, "legacy.txt"), "utf8"), "preserve me\n");
  });
});
