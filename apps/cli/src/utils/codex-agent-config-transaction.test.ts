import { describe, expect, it, vi } from "vitest";
import * as fsPromises from "node:fs/promises";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withCodexAgentConfigReceiptRollback, withCodexTargetLock } from "./codex-agent-config-transaction.js";
import { mergeOwnedCodexAgentConfigWithDefaults, stripManagedZcAgentSections } from "./codex-config-merge.js";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:fs/promises")>(),
}));

const generated = '[agents]\ndefault_subagent_model = "gpt-6-sol"\ndefault_subagent_reasoning_effort = "medium"\n\n[agents.zc_reviewer]\nconfig_file = "agents/zc-reviewer.toml"\n';

describe("Codex agent config and receipt failure recovery", () => {
  it("serializes inspection and mutation for the same Codex root", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-lock-"));
    const steps: string[] = [];
    let releaseFirst!: () => void;
    const holdFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
    try {
      const first = withCodexTargetLock(root, async () => {
        steps.push("first-inspect");
        await holdFirst;
        steps.push("first-write");
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      const second = withCodexTargetLock(root, async () => {
        steps.push("second-inspect");
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      expect(steps).toEqual(["first-inspect"]);
      releaseFirst();
      await Promise.all([first, second]);
      expect(steps).toEqual(["first-inspect", "first-write", "second-inspect"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps the same lock after the target is created and through a symlink alias", async (context) => {
    const parent = await mkdtemp(join(tmpdir(), "zc-agent-target-lock-"));
    const root = join(parent, "target");
    const alias = join(parent, "alias");
    await mkdir(root);
    try {
      try { await symlink(root, alias, process.platform === "win32" ? "junction" : "dir"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") { context.skip(); return; }
        throw error;
      }
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const events: string[] = [];
      const first = withCodexTargetLock(root, async () => {
        events.push("first");
        await gate;
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
      const second = withCodexTargetLock(alias, async () => { events.push("second"); });
      await new Promise<void>((resolve) => setTimeout(resolve, 80));
      expect(events).toEqual(["first"]);
      release();
      await Promise.all([first, second]);
      expect(events).toEqual(["first", "second"]);
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

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
      let failure: unknown;
      try {
        await withCodexAgentConfigReceiptRollback([configPath], receiptPath, async () => {
          await writeFile(configPath, "changed config\n");
          await mkdir(receiptPath);
          throw new Error("injected receipt failure");
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      const aggregate = failure as AggregateError;
      expect(aggregate.message).toMatch(/injected receipt failure.*rollback could not be verified/);
      expect(aggregate.errors).toHaveLength(2);
      expect((aggregate.errors[0] as Error).message).toBe("injected receipt failure");
      expect(await readFile(configPath, "utf8")).toBe("original config\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("restores existing artifacts and removes newly created artifacts after the Nth write fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-artifacts-"));
    const configPath = join(root, "config.toml");
    const oldAgent = join(root, "agents", "zc-old.toml");
    const newAgent = join(root, "agents", "zc-new.toml");
    const receiptPath = join(root, "receipt.json");
    await mkdir(join(root, "agents"));
    await writeFile(configPath, "old config");
    await writeFile(oldAgent, "old agent");
    await writeFile(receiptPath, "old receipt");
    try {
      const write = async (fail: boolean) => withCodexAgentConfigReceiptRollback(
        [configPath, oldAgent, newAgent, oldAgent], receiptPath, async () => {
          await writeFile(configPath, "new config");
          await writeFile(oldAgent, "new agent");
          await writeFile(newAgent, "new artifact");
          if (fail) throw new Error("Nth artifact write failed");
          await writeFile(receiptPath, "new receipt");
        },
      );
      await expect(write(true)).rejects.toThrow("Nth artifact write failed");
      expect(await readFile(configPath, "utf8")).toBe("old config");
      expect(await readFile(oldAgent, "utf8")).toBe("old agent");
      await expect(readFile(newAgent)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(receiptPath, "utf8")).toBe("old receipt");
      await write(false);
      expect(await readFile(newAgent, "utf8")).toBe("new artifact");
      expect(await readFile(receiptPath, "utf8")).toBe("new receipt");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not follow a symlink introduced before rollback", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-link-"));
    const artifact = join(root, "agent.toml");
    const outside = join(root, "user.toml");
    await writeFile(artifact, "old agent");
    await writeFile(outside, "user content");
    try {
      try {
        await symlink(outside, artifact + ".probe", "file");
        await rm(artifact + ".probe");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") {
          context.skip();
          return;
        }
        throw error;
      }
      await expect(withCodexAgentConfigReceiptRollback([artifact], join(root, "receipt.json"), async () => {
        await rm(artifact);
        await symlink(outside, artifact, "file");
        throw new Error("write failed");
      })).rejects.toBeInstanceOf(AggregateError);
      expect(await readFile(outside, "utf8")).toBe("user content");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts an existing parent junction but detects its redirection before rollback", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-parent-link-"));
    const first = join(root, "first");
    const second = join(root, "second");
    const link = join(root, "agents");
    const artifact = join(link, "zc-agent.toml");
    await mkdir(first);
    await mkdir(second);
    await writeFile(join(first, "zc-agent.toml"), "original agent");
    await writeFile(join(second, "zc-agent.toml"), "unmanaged content");
    try {
      try {
        await symlink(first, link, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") {
          context.skip();
          return;
        }
        throw error;
      }
      let failure: unknown;
      try {
        await withCodexAgentConfigReceiptRollback([artifact], join(root, "receipt.json"), async () => {
          await rm(link, { recursive: true });
          await symlink(second, link, process.platform === "win32" ? "junction" : "dir");
          throw new Error("write failed");
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(AggregateError);
      expect((failure as AggregateError).errors.some((error: Error) => /parent was redirected/.test(error.message)))
        .toBe(true);
      expect(await readFile(join(second, "zc-agent.toml"), "utf8")).toBe("unmanaged content");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not restore into a replacement parent directory at the same path", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-parent-swap-"));
    const agents = join(root, "agents");
    const artifact = join(agents, "zc-agent.toml");
    await mkdir(agents);
    await writeFile(artifact, "original agent");
    try {
      await expect(withCodexAgentConfigReceiptRollback([artifact], join(root, "receipt.json"), async () => {
        await rm(agents, { recursive: true });
        await mkdir(agents);
        await writeFile(artifact, "unmanaged replacement");
        throw new Error("write failed");
      })).rejects.toBeInstanceOf(AggregateError);
      expect(await readFile(artifact, "utf8")).toBe("unmanaged replacement");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("leaves a directory introduced at a new artifact path and reports failed recovery", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-replace-"));
    const artifact = join(root, "agent.toml");
    try {
      await expect(withCodexAgentConfigReceiptRollback([artifact], join(root, "receipt.json"), async () => {
        await mkdir(artifact);
        throw new Error("Nth artifact write failed");
      })).rejects.toBeInstanceOf(AggregateError);
      expect((await stat(artifact)).isDirectory()).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves a replacement directory even when the filesystem reuses its inode", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-inode-reuse-"));
    const agents = join(root, "agents");
    const artifact = join(agents, "zc-agent.toml");
    await mkdir(agents);
    await writeFile(artifact, "original agent");
    let replaced = false;
    const realStat = fsPromises.stat;
    const mockedStat = vi.spyOn(fsPromises, "stat");
    mockedStat.mockImplementation((async (...args: Parameters<typeof realStat>) => {
      const entry = await realStat(...args);
      if (args[0] !== agents) return entry;
      // Reproduce inode reuse without depending on the host allocator or clock resolution.
      return typeof entry.ino === "bigint"
        ? { ...entry, dev: 1n, ino: 1n, birthtimeNs: replaced ? 200n : 100n }
        : { ...entry, dev: 1, ino: 1 };
    }) as typeof realStat);
    try {
      await expect(withCodexAgentConfigReceiptRollback([artifact], join(root, "receipt.json"), async () => {
        await rm(agents, { recursive: true });
        await mkdir(agents);
        await writeFile(artifact, "unmanaged replacement");
        replaced = true;
        throw new Error("write failed");
      })).rejects.toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({ message: expect.stringContaining("parent was redirected") }),
        ]),
      });
      expect(await readFile(artifact, "utf8")).toBe("unmanaged replacement");
    } finally {
      mockedStat.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a preexisting directory target before calling write", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-dir-"));
    const directory = join(root, "agent.toml");
    await mkdir(directory);
    let called = false;
    try {
      await expect(withCodexAgentConfigReceiptRollback([directory], join(root, "receipt.json"), async () => {
        called = true;
      })).rejects.toThrow(/regular file/);
      expect(called).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
