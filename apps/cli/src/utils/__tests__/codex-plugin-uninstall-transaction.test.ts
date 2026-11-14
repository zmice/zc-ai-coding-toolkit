import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withCodexPluginUninstallRollback } from "../codex-plugin-uninstall-transaction.js";

const roots: string[] = [];
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "zc-plugin-transaction-"));
  roots.push(root);
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("Codex local plugin uninstall rollback", () => {
  it("restores a removed bundle and changed config after a later failure", async () => {
    const root = fixture();
    const bundle = join(root, "plugins/zc-toolkit");
    const config = join(root, "config.toml");
    mkdirSync(bundle, { recursive: true });
    writeFileSync(join(bundle, "plugin.json"), "original");
    writeFileSync(config, "original config");
    await expect(withCodexPluginUninstallRollback(root, [bundle, config], async (acknowledge) => {
      rmSync(bundle, { recursive: true });
      await acknowledge(bundle, { kind: "absent" });
      writeFileSync(config, "stripped config");
      await acknowledge(config, { kind: "file-content", content: "stripped config" });
      throw new Error("receipt failure");
    })).rejects.toThrow("receipt failure");
    expect(readFileSync(join(bundle, "plugin.json"), "utf8")).toBe("original");
    expect(readFileSync(config, "utf8")).toBe("original config");
    expect(readdirSync(root).some((name) => name.startsWith(".zc-plugin-uninstall-"))).toBe(false);
  });

  it("keeps a recovery copy when a target changed outside the acknowledged mutation", async () => {
    const root = fixture();
    const config = join(root, "config.toml");
    writeFileSync(config, "original");
    await expect(withCodexPluginUninstallRollback(root, [config], async (acknowledge) => {
      writeFileSync(config, "stripped");
      await acknowledge(config, { kind: "file-content", content: "stripped" });
      writeFileSync(config, "concurrent edit");
      throw new Error("later failure");
    })).rejects.toThrow("恢复副本保留");
    expect(readFileSync(config, "utf8")).toBe("concurrent edit");
    const recovery = readdirSync(root).find((name) => name.startsWith(".zc-plugin-uninstall-"));
    expect(recovery).toBeDefined();
    expect(readFileSync(join(root, recovery!, "0"), "utf8")).toBe("original");
  });

  it("retains recovery evidence for an unacknowledged partial deletion", async () => {
    const root = fixture();
    const bundle = join(root, "plugins/zc-toolkit");
    mkdirSync(bundle, { recursive: true });
    writeFileSync(join(bundle, "one"), "one");
    writeFileSync(join(bundle, "two"), "two");
    await expect(withCodexPluginUninstallRollback(root, [bundle], async () => {
      rmSync(join(bundle, "one"));
      throw new Error("remove failed midway");
    })).rejects.toThrow("恢复副本保留");
    expect(readFileSync(join(bundle, "two"), "utf8")).toBe("two");
    const recovery = readdirSync(root).find((name) => name.startsWith(".zc-plugin-uninstall-"));
    expect(recovery).toBeDefined();
    const manifest = JSON.parse(readFileSync(join(root, recovery!, "manifest.json"), "utf8"));
    expect(manifest).toEqual(expect.objectContaining({ phase: "recovery-required", targets: [expect.objectContaining({ path: bundle, index: 0, digest: expect.any(String) })] }));
  });

  it("preserves files created at a previously missing or newly deleted target", async () => {
    for (const existed of [false, true]) {
      const root = fixture();
      const entry = join(root, "AGENTS.md");
      if (existed) writeFileSync(entry, "old managed");
      await expect(withCodexPluginUninstallRollback(root, [entry], async (acknowledge) => {
        if (existed) rmSync(entry);
        writeFileSync(entry, "user created");
        await acknowledge(entry, { kind: "absent" });
      })).rejects.toThrow("恢复副本保留");
      expect(readFileSync(entry, "utf8")).toBe("user created");
      const recovery = readdirSync(root).find((name) => name.startsWith(".zc-plugin-uninstall-"));
      expect(recovery).toBeDefined();
      const manifest = JSON.parse(readFileSync(join(root, recovery!, "manifest.json"), "utf8"));
      expect(manifest.targets[0]).toEqual(expect.objectContaining({ path: entry, index: existed ? 0 : null }));
    }
  });

  it("distinguishes different file content splits across the same directory entries", async () => {
    const root = fixture();
    const bundle = join(root, "bundle");
    mkdirSync(bundle);
    writeFileSync(join(bundle, "a"), "x");
    writeFileSync(join(bundle, "b"), "f:/b\0y");
    await expect(withCodexPluginUninstallRollback(root, [bundle], async () => {
      writeFileSync(join(bundle, "a"), "xf:/b\0");
      writeFileSync(join(bundle, "b"), "y");
      throw new Error("injected failure");
    })).rejects.toThrow("恢复副本保留");
    expect(readFileSync(join(bundle, "a"), "utf8")).toBe("xf:/b\0");
    expect(readdirSync(root).some((name) => name.startsWith(".zc-plugin-uninstall-"))).toBe(true);
  });

  it("restores the acknowledged bundle and retains evidence for a partial config write", async () => {
    const root = fixture();
    const bundle = join(root, "plugins/zc-toolkit");
    const config = join(root, "config.toml");
    mkdirSync(bundle, { recursive: true });
    writeFileSync(join(bundle, "plugin.json"), "original bundle");
    writeFileSync(config, "original config");
    await expect(withCodexPluginUninstallRollback(root, [bundle, config], async (acknowledge) => {
      rmSync(bundle, { recursive: true });
      await acknowledge(bundle, { kind: "absent" });
      writeFileSync(config, "partial config");
      throw new Error("config write failed");
    })).rejects.toThrow("恢复副本保留");
    expect(readFileSync(join(bundle, "plugin.json"), "utf8")).toBe("original bundle");
    expect(readFileSync(config, "utf8")).toBe("partial config");
    expect(readdirSync(root).some((name) => name.startsWith(".zc-plugin-uninstall-"))).toBe(true);
  });

  it("refuses rollback after a parent directory is replaced", async () => {
    const root = fixture();
    const agents = join(root, "agents");
    const role = join(agents, "zc-reviewer.toml");
    mkdirSync(agents);
    writeFileSync(role, "original");
    await expect(withCodexPluginUninstallRollback(root, [role], async (acknowledge) => {
      rmSync(role);
      await acknowledge(role, { kind: "absent" });
      renameSync(agents, join(root, "agents-old"));
      mkdirSync(agents);
      throw new Error("later failure");
    })).rejects.toThrow("恢复副本保留");
    expect(existsSync(role)).toBe(false);
    expect(existsSync(join(root, "agents-old/zc-reviewer.toml"))).toBe(false);
    expect(readdirSync(root).some((name) => name.startsWith(".zc-plugin-uninstall-"))).toBe(true);
  });

  it("does not roll back committed removal if backup cleanup fails", async () => {
    const root = fixture();
    const entry = join(root, "AGENTS.md");
    writeFileSync(entry, "original");
    await expect(withCodexPluginUninstallRollback(root, [entry], async (acknowledge) => {
      rmSync(entry);
      await acknowledge(entry, { kind: "absent" });
      const backup = readdirSync(root).find((name) => name.startsWith(".zc-plugin-uninstall-"))!;
      rmSync(join(root, backup), { recursive: true });
      writeFileSync(join(root, backup), "blocked cleanup");
    })).rejects.toThrow("已完成，但恢复副本清理失败");
    expect(existsSync(entry)).toBe(false);
  });

  it("does not delete a different directory placed at the backup path", async () => {
    const root = fixture();
    const entry = join(root, "AGENTS.md");
    writeFileSync(entry, "original");
    let replacement = "";
    await expect(withCodexPluginUninstallRollback(root, [entry], async (acknowledge) => {
      rmSync(entry);
      await acknowledge(entry, { kind: "absent" });
      const backup = join(root, readdirSync(root).find((name) => name.startsWith(".zc-plugin-uninstall-"))!);
      renameSync(backup, join(root, "original-backup"));
      mkdirSync(backup);
      replacement = join(backup, "user-file");
      writeFileSync(replacement, "preserve");
    })).rejects.toThrow("已完成，但恢复副本清理失败");
    expect(readFileSync(replacement, "utf8")).toBe("preserve");
    expect(existsSync(entry)).toBe(false);
  });

  it("rejects paths outside root before entering the mutation", async () => {
    const root = fixture();
    const external = fixture();
    let called = false;
    const work = async () => { called = true; };
    await expect(withCodexPluginUninstallRollback(root, [join(external, "file")], work)).rejects.toThrow("不在选定目录内");
    expect(called).toBe(false);
  });

  it.skipIf(process.platform === "win32")("rejects symlinked parents before entering the mutation", async () => {
    const root = fixture();
    const external = fixture();
    const linked = join(root, "linked");
    symlinkSync(external, linked, "dir");
    let called = false;
    await expect(withCodexPluginUninstallRollback(root, [join(linked, "file")], async () => { called = true; })).rejects.toThrow("链接");
    expect(called).toBe(false);
    expect(existsSync(linked)).toBe(true);
  });
});
