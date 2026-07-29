import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createCodexAgentsReceipt,
  getCodexAgentsReceiptOwnedPaths,
  readCodexAgentsReceipt,
  resolveCodexAgentsReceiptPath,
  writeCodexAgentsReceipt,
} from "./codex-agents-receipt.js";

describe("Codex agents receipt", () => {
  it("stores only managed agent files with stable ownership metadata", () => {
    const root = "/home/test/.codex";
    const receipt = createCodexAgentsReceipt({
      root,
      scope: "global",
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      installedPluginPath: "/home/test/.codex/plugins/cache/zc-toolkit/zc-toolkit/0.6.0",
      contentFingerprint: "agent-fingerprint",
      installedAt: "2026-07-28T00:00:00.000Z",
      artifacts: [
        {
          path: join(root, "config.toml"),
          content: "[agents.zc_code_reviewer]\n",
        },
        {
          path: join(root, "agents/zc-code-reviewer.toml"),
          content: "name = \"zc_code_reviewer\"\n",
        },
      ],
    });

    expect(receipt).toEqual(expect.objectContaining({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      scope: "global",
      root,
      contentFingerprint: "agent-fingerprint",
      installedAt: "2026-07-28T00:00:00.000Z",
      managedAgentNames: ["zc_code_reviewer"],
    }));
    expect(receipt.artifacts).toHaveLength(1);
    expect(receipt.artifacts[0]).toEqual(expect.objectContaining({
      path: join(root, "agents/zc-code-reviewer.toml"),
      bytes: Buffer.byteLength("name = \"zc_code_reviewer\"\n", "utf8"),
    }));
    expect(receipt.artifacts[0]?.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(getCodexAgentsReceiptOwnedPaths(receipt)).toEqual([
      join(root, "agents/zc-code-reviewer.toml"),
    ]);
  });

  it("uses scope-aware receipt paths and round-trips the receipt", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "zc-codex-agents-receipt-"));
    const receipt = createCodexAgentsReceipt({
      root: tempRoot,
      scope: "project",
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: "agent-fingerprint",
      artifacts: [
        {
          path: join(tempRoot, ".codex/agents/zc-code-reviewer.toml"),
          content: "name = \"zc_code_reviewer\"\n",
        },
      ],
    });

    const receiptPath = resolveCodexAgentsReceiptPath(tempRoot, "project");
    expect(receiptPath).toBe(
      join(tempRoot, ".codex/platform-state/zc-toolkit-agents.install-receipt.json"),
    );

    await writeCodexAgentsReceipt(receiptPath, receipt);

    await expect(readCodexAgentsReceipt(receiptPath, {
      root: tempRoot,
      scope: "project",
    })).resolves.toEqual(receipt);
    expect(resolveCodexAgentsReceiptPath(tempRoot, "global")).toBe(
      join(tempRoot, "platform-state/zc-toolkit-agents.install-receipt.json"),
    );
  });

  it("rejects receipt artifact paths outside the owned agents directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "zc-agent-receipt-escape-"));
    const receiptPath = resolveCodexAgentsReceiptPath(root, "global");
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, `${JSON.stringify({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      installedPluginPath: "/cache/zc-toolkit",
      contentFingerprint: "fingerprint",
      scope: "global",
      root,
      installedAt: "2026-07-28T00:00:00.000Z",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [
        {
          path: join(tmpdir(), "other/agents/zc-code-reviewer.toml"),
          sha256: "digest",
          bytes: 10,
        },
      ],
    }, null, 2)}\n`);

    await expect(readCodexAgentsReceipt(receiptPath)).rejects.toThrow(
      "Invalid Codex agents receipt",
    );
  });

  it("rejects a self-consistent receipt whose root differs from the resolved target", async () => {
    const expectedRoot = await mkdtemp(join(tmpdir(), "zc-agent-receipt-target-"));
    const forgedRoot = await mkdtemp(join(tmpdir(), "zc-agent-receipt-forged-"));
    const receiptPath = resolveCodexAgentsReceiptPath(expectedRoot, "global");
    const forgedReceipt = createCodexAgentsReceipt({
      root: forgedRoot,
      scope: "global",
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: "fingerprint",
      artifacts: [
        {
          path: join(forgedRoot, "agents/zc-code-reviewer.toml"),
          content: 'name = "zc_code_reviewer"\n',
        },
      ],
    });
    await writeCodexAgentsReceipt(receiptPath, forgedReceipt);

    await expect(readCodexAgentsReceipt(receiptPath, {
      root: expectedRoot,
      scope: "global",
    })).rejects.toThrow("receipt root or scope mismatch");
  });
});
