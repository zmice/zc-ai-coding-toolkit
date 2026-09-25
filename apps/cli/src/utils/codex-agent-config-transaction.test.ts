import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withCodexAgentConfigReceiptRollback } from "./codex-agent-config-transaction.js";
import { mergeOwnedCodexAgentConfigWithDefaults, stripManagedZcAgentSections } from "./codex-config-merge.js";

const generated = '[agents]\ndefault_subagent_model = "gpt-6-sol"\ndefault_subagent_reasoning_effort = "medium"\n\n[agents.zc_reviewer]\nconfig_file = "agents/zc-reviewer.toml"\n';

describe("Codex agent config and receipt failure recovery", () => {
  it("rolls back a failed receipt, then keeps retried defaults owned through uninstall", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-rollback-"));
    const configPath = join(root, "config.toml");
    const receiptPath = join(root, "platform-state", "receipt.json");
    const original = '[features]\nsearch = true\n';
    await writeFile(configPath, original);
    try {
      const sync = async (failReceipt: boolean) => {
        const existing = await readFile(configPath, "utf8");
        const merged = mergeOwnedCodexAgentConfigWithDefaults(existing, generated, [], []);
        await withCodexAgentConfigReceiptRollback([configPath], receiptPath, async () => {
          await writeFile(configPath, merged.content);
          await mkdir(join(root, "platform-state"), { recursive: true });
          await writeFile(receiptPath, failReceipt ? "partial" : JSON.stringify(merged.managedDefaults));
          if (failReceipt) throw new Error("injected receipt failure");
        });
        return merged.managedDefaults;
      };

      await expect(sync(true)).rejects.toThrow("injected receipt failure");
      expect(await readFile(configPath, "utf8")).toBe(original);
      await expect(readFile(receiptPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      const ownedDefaults = await sync(false);
      expect(ownedDefaults.map((item) => item.key)).toEqual([
        "default_subagent_model", "default_subagent_reasoning_effort",
      ]);
      const installed = await readFile(configPath, "utf8");
      const uninstalled = stripManagedZcAgentSections(installed, ["zc_reviewer"], ownedDefaults);
      expect(uninstalled).toContain(original.trim());
      expect(uninstalled).not.toContain("default_subagent_model");
      expect(uninstalled).not.toContain("default_subagent_reasoning_effort");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not claim or remove a matching user default", async () => {
    const existing = '[agents]\ndefault_subagent_model = "gpt-6-sol"\n';
    const merged = mergeOwnedCodexAgentConfigWithDefaults(existing, generated, [], []);
    expect(merged.managedDefaults).toEqual([
      { key: "default_subagent_reasoning_effort", value: "medium" },
    ]);
    expect(stripManagedZcAgentSections(merged.content, ["zc_reviewer"], merged.managedDefaults))
      .toBe(existing.trim());
  });

  it("restores an existing receipt after a partially written replacement", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-receipt-"));
    const configPath = join(root, "config.toml");
    const receiptPath = join(root, "receipt.json");
    await writeFile(configPath, "original config\n");
    await writeFile(receiptPath, "original receipt\n");
    try {
      await expect(withCodexAgentConfigReceiptRollback([configPath], receiptPath, async () => {
        await writeFile(configPath, "changed config\n");
        await writeFile(receiptPath, "partial receipt");
        throw new Error("injected receipt failure");
      })).rejects.toThrow("injected receipt failure");
      expect(await readFile(configPath, "utf8")).toBe("original config\n");
      expect(await readFile(receiptPath, "utf8")).toBe("original receipt\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports both the write failure and an unverified rollback", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-recovery-"));
    const configPath = join(root, "config.toml");
    const receiptPath = join(root, "receipt.json");
    await writeFile(configPath, "original config\n");
    try {
      await expect(withCodexAgentConfigReceiptRollback([configPath], receiptPath, async () => {
        await writeFile(configPath, "changed config\n");
        await mkdir(receiptPath);
        throw new Error("injected receipt failure");
      })).rejects.toThrow(/injected receipt failure.*rollback could not be verified/);
      expect(await readFile(configPath, "utf8")).toBe("original config\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
