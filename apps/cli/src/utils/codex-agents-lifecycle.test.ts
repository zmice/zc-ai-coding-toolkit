import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createCodexAgentsReceipt,
  resolveCodexAgentsReceiptPath,
  writeCodexAgentsReceipt,
} from "../platform-state/codex-agents-receipt.js";
import {
  inspectReceiptManagedCodexAgents,
  resolveCodexAgentsRootFromMarketplace,
  stripCodexAgentConfigFile,
} from "./codex-agents-lifecycle.js";

describe("Codex agents lifecycle", () => {
  it("maps a personal marketplace root to Codex home", () => {
    expect(resolveCodexAgentsRootFromMarketplace("/home/test", "global")).toBe(
      "/home/test/.codex",
    );
    expect(resolveCodexAgentsRootFromMarketplace("/repo/project", "project")).toBe(
      "/repo/project",
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
    );

    expect(result).toEqual({ changed: true, missing: false });
    expect(await readFile(configPath, "utf8")).toBe([
      "[agents.zc_local]",
      'config_file = "agents/zc-local.toml"',
      "",
      "[[mcp_servers]]",
      'name = "keep-me"',
      "",
    ].join("\n"));
  });
});
