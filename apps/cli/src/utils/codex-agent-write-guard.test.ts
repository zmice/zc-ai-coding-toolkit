import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCodexAgentsReceipt } from "../platform-state/codex-agents-receipt.js";
import { assertCodexAgentDeletesOwned, assertCodexAgentWritesOwned } from "./codex-agent-write-guard.js";

describe("Codex role migration ownership", () => {
  it("allows owned pins to migrate but preserves changed and unowned user configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-model-policy-"));
    try {
      const path = join(root, "agents", "zc-reviewer.toml");
      await mkdir(join(root, "agents"));
      const old = 'name = "zc_reviewer"\nmodel = "old-pinned"\n';
      const next = [{ path, content: 'name = "zc_reviewer"\n' }];
      const receipt = createCodexAgentsReceipt({ root, scope: "dir", pluginId: "zc-toolkit@zc-toolkit",
        pluginVersion: "old", contentFingerprint: "test", artifacts: [{ path, content: old }] });
      await expect(assertCodexAgentWritesOwned(next, null)).resolves.toBeUndefined();
      await writeFile(path, old);
      await expect(assertCodexAgentWritesOwned(next, receipt)).resolves.toBeUndefined();
      await expect(assertCodexAgentWritesOwned(next, null)).rejects.toThrow("保留用户自定义");
      const custom = old.replace("old-pinned", "user-choice");
      await writeFile(path, custom);
      await expect(assertCodexAgentWritesOwned(next, receipt)).rejects.toThrow("保留用户自定义");
      expect(await readFile(path, "utf8")).toBe(custom);
      await expect(assertCodexAgentWritesOwned([{ path, content: custom }], null)).rejects.toThrow("没有归属回执");
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("prechecks every deletion target and leaves the whole batch untouched on drift", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-delete-"));
    try {
      const agentsDir = join(root, "agents");
      await mkdir(agentsDir);
      const first = join(agentsDir, "zc-first.toml");
      const second = join(agentsDir, "zc-second.toml");
      const ownedContent = 'model = "old"\n';
      const customContent = 'model = "custom"\n';
      const receipt = createCodexAgentsReceipt({ root, scope: "dir", pluginId: "zc-toolkit@zc-toolkit",
        pluginVersion: "old", contentFingerprint: "test", artifacts: [
          { path: first, content: ownedContent }, { path: second, content: ownedContent },
        ] });
      await writeFile(first, ownedContent);
      await writeFile(second, customContent);

      await expect(assertCodexAgentDeletesOwned([first, second], receipt)).rejects.toThrow("未删除");
      expect(await readFile(first, "utf8")).toBe(ownedContent);
      expect(await readFile(second, "utf8")).toBe(customContent);
      await expect(assertCodexAgentDeletesOwned([first, second], null)).rejects.toThrow("没有归属回执");

      await writeFile(second, ownedContent);
      await expect(assertCodexAgentDeletesOwned([first, second], receipt)).resolves.toBeUndefined();
      await rm(second);
      await expect(assertCodexAgentDeletesOwned([first, second], receipt)).resolves.toBeUndefined();
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("requires the exact file bytes and accepts Windows receipt path casing", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-delete-case-"));
    try {
      const path = join(root, "agents", "zc-reviewer.toml");
      await mkdir(join(root, "agents"));
      const content = 'name = "reviewer"\n';
      await writeFile(path, content);
      const receipt = createCodexAgentsReceipt({ root, scope: "dir", pluginId: "zc-toolkit@zc-toolkit",
        pluginVersion: "old", contentFingerprint: "test", artifacts: [{ path, content }] });
      if (process.platform === "win32") {
        const caseChangedReceipt = {
          ...receipt,
          artifacts: receipt.artifacts.map(entry => ({ ...entry, path: entry.path.toUpperCase() })),
        };
        await expect(assertCodexAgentDeletesOwned([path], caseChangedReceipt)).resolves.toBeUndefined();
      }
      await writeFile(path, content.replace("\n", "\r\n"));
      await expect(assertCodexAgentDeletesOwned([path], receipt)).rejects.toThrow("未删除");
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
