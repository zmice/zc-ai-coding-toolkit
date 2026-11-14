import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createCodexAgentsReceipt,
  resolveCodexAgentsReceiptPath,
  writeCodexAgentsReceipt,
} from "../platform-state/codex-agents-receipt.js";
import {
  assertNoDanglingCodexAgentRegistrations,
  inspectReceiptManagedCodexAgents,
  resolveCodexAgentsRootFromMarketplace,
  stripCodexAgentConfigFile,
} from "./codex-agents-lifecycle.js";
import { mergeCodexAgentConfig, resolveManagedCodexAgentSections } from "./codex-config-merge.js";

describe("Codex agents lifecycle", () => {
  it("maps a personal marketplace root to Codex home", () => {
    expect(resolveCodexAgentsRootFromMarketplace("/home/test", "global")).toBe(
      resolve("/home/test", ".codex"),
    );
    expect(resolveCodexAgentsRootFromMarketplace("/repo/project", "project")).toBe(
      resolve("/repo/project"),
    );
  });

  it("returns only receipt-owned direct-install agents", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-lifecycle-"));
    const ownedAgentPath = join(root, "agents", "zc-code-reviewer.toml");
    const receipt = createCodexAgentsReceipt({
      root,
      scope: "dir",
      pluginId: "zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: "fixture",
      artifacts: [
        {
          path: ownedAgentPath,
          content: 'name = "zc_code_reviewer"\n',
        },
      ],
    });
    await writeCodexAgentsReceipt(
      resolveCodexAgentsReceiptPath(root, "dir"),
      receipt,
    );

    const lifecycle = await inspectReceiptManagedCodexAgents(root, "dir");

    expect(lifecycle.configPath).toBe(join(root, "config.toml"));
    expect(lifecycle.receipt).not.toBeNull();
    expect(lifecycle.ownedPaths).toEqual([ownedAgentPath]);
  });

  it("removes only named config sections and preserves following array tables", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-config-"));
    const configPath = join(root, "config.toml");
    await writeFile(configPath, [
      "[agents.zc_owned]",
      'config_file = "agents/zc-owned.toml"',
      "",
      "[agents.zc_local]",
      'config_file = "agents/zc-local.toml"',
      "",
      "[[mcp_servers]]",
      'name = "keep-me"',
      "",
    ].join("\n"));

    const result = await stripCodexAgentConfigFile(
      configPath,
      false,
      ["zc_owned"],
      [],
      resolveManagedCodexAgentSections(undefined, await readFile(configPath, "utf8"), '[agents.zc_owned]\nconfig_file = "agents/zc-owned.toml"\n'),
    );

    const expectedContent = [
      "[agents.zc_local]",
      'config_file = "agents/zc-local.toml"',
      "",
      "[[mcp_servers]]",
      'name = "keep-me"',
      "",
    ].join("\n");
    expect(result).toEqual({ changed: true, missing: false, nextContent: expectedContent });
    expect(await readFile(configPath, "utf8")).toBe(expectedContent);
  });

  it("removes only unchanged receipt-owned subagent defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-defaults-"));
    const configPath = join(root, "config.toml");
    await writeFile(configPath, [
      "[agents]",
      'default_subagent_model = "gpt-user"',
      'default_subagent_reasoning_effort = "medium"',
      "",
    ].join("\n"));

    await stripCodexAgentConfigFile(configPath, false, [], [
      { key: "default_subagent_model", value: "gpt-5.6-terra" },
      { key: "default_subagent_reasoning_effort", value: "medium" },
    ]);

    expect(await readFile(configPath, "utf8")).toBe([
      "[agents]",
      'default_subagent_model = "gpt-user"',
      "",
    ].join("\n"));
  });

  it("blocks legacy or edited registrations that still reference a role being removed", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-dangling-"));
    const configPath = join(root, "config.toml");
    const rolePath = join(root, "agents", "zc-review.toml");
    const original = '[agents.zc_review]\nconfig_file = "agents/zc-review.toml"\n';
    await writeFile(configPath, original);
    await expect(assertNoDanglingCodexAgentRegistrations(configPath, [rolePath], []))
      .rejects.toThrow(/请先人工合并/);
    const upgradedLegacyOwnership = resolveManagedCodexAgentSections(
      original, mergeCodexAgentConfig(original, original), original, [],
    );
    expect(upgradedLegacyOwnership).toEqual([]);
    await expect(assertNoDanglingCodexAgentRegistrations(configPath, [rolePath], upgradedLegacyOwnership))
      .rejects.toThrow(/请先人工合并/);
    const owned = resolveManagedCodexAgentSections(undefined, original, original);
    await expect(assertNoDanglingCodexAgentRegistrations(configPath, [rolePath], owned))
      .resolves.toBeUndefined();
    await writeFile(configPath, original.replace("[agents.zc_review]", '[agents.zc_review]\ndescription = "user"'));
    await expect(assertNoDanglingCodexAgentRegistrations(configPath, [rolePath], owned))
      .rejects.toThrow(/请先人工合并/);
  });
});
