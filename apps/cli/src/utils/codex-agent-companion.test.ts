import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createCodexCompanionAgentInstallPlan,
  loadCodexAgentCompanion,
} from "./codex-agent-companion.js";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

describe("Codex agent companion", () => {
  it("loads a version-matched companion payload from an installed plugin", async () => {
    const pluginRoot = await mkdtemp(join(tmpdir(), "zc-codex-plugin-"));
    const companionRoot = join(pluginRoot, "assets/zc-agents");
    const configContent = "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n";
    const agentContent = "name = \"zc_code_reviewer\"\ndescription = \"Review code\"\ndeveloper_instructions = \"Review carefully\"\n";
    await mkdir(join(companionRoot, "config"), { recursive: true });
    await mkdir(join(companionRoot, "agents"), { recursive: true });
    await writeFile(join(companionRoot, "config/agents.toml"), configContent);
    await writeFile(join(companionRoot, "agents/zc-code-reviewer.toml"), agentContent);
    await writeFile(join(companionRoot, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: sha256(JSON.stringify([
        {
          name: "zc_code_reviewer",
          path: "agents/zc-code-reviewer.toml",
          sha256: sha256(agentContent),
        },
      ])),
      config: {
        path: "config/agents.toml",
        sha256: sha256(configContent),
      },
      agents: [
        {
          name: "zc_code_reviewer",
          path: "agents/zc-code-reviewer.toml",
          sha256: sha256(agentContent),
        },
      ],
    }, null, 2)}\n`);

    const companion = await loadCodexAgentCompanion(pluginRoot);

    expect(companion.pluginVersion).toBe("0.6.0");
    expect(companion.installedPluginPath).toBe(pluginRoot);
    expect(companion.agents).toEqual([
      expect.objectContaining({
        name: "zc_code_reviewer",
        relativePath: "agents/zc-code-reviewer.toml",
        content: agentContent,
      }),
    ]);
    expect(companion.configContent).toBe(configContent);

    const globalRoot = resolve("/home/test/.codex");
    const globalPlan = createCodexCompanionAgentInstallPlan(companion, {
      root: globalRoot,
      scope: "global",
    });
    expect(globalPlan.artifacts.map((artifact) => artifact.path)).toEqual([
      join(globalRoot, "config.toml"),
      join(globalRoot, "agents", "zc-code-reviewer.toml"),
    ]);
    expect(globalPlan.metadata.artifactCount).toBe(globalPlan.artifacts.length);

    const projectRoot = resolve("/repo/project");
    const projectPlan = createCodexCompanionAgentInstallPlan(companion, {
      root: projectRoot,
      scope: "project",
    });
    expect(projectPlan.artifacts.map((artifact) => artifact.path)).toEqual([
      join(projectRoot, ".codex", "config.toml"),
      join(projectRoot, ".codex", "agents", "zc-code-reviewer.toml"),
    ]);
  });

  it("rejects a companion file whose digest does not match the manifest", async () => {
    const pluginRoot = await mkdtemp(join(tmpdir(), "zc-codex-plugin-invalid-"));
    const companionRoot = join(pluginRoot, "assets/zc-agents");
    await mkdir(join(companionRoot, "config"), { recursive: true });
    await mkdir(join(companionRoot, "agents"), { recursive: true });
    await writeFile(join(companionRoot, "config/agents.toml"), "");
    await writeFile(join(companionRoot, "agents/zc-code-reviewer.toml"), "changed");
    const agentEntries = [
      {
        name: "zc_code_reviewer",
        path: "agents/zc-code-reviewer.toml",
        sha256: sha256("original"),
      },
    ];
    await writeFile(join(companionRoot, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: sha256(JSON.stringify(agentEntries)),
      config: {
        path: "config/agents.toml",
        sha256: sha256(""),
      },
      agents: agentEntries,
    })}\n`);

    await expect(loadCodexAgentCompanion(pluginRoot)).rejects.toThrow(
      "companion agent 文件哈希不匹配",
    );
  });

  it("accepts Git CRLF checkout content when the manifest hashes canonical LF text", async () => {
    const pluginRoot = await mkdtemp(join(tmpdir(), "zc-codex-plugin-crlf-"));
    const companionRoot = join(pluginRoot, "assets/zc-agents");
    const configContent = "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n";
    const agentContent = "name = \"zc_code_reviewer\"\ndescription = \"Review code\"\n";
    const agentEntries = [
      {
        name: "zc_code_reviewer",
        path: "agents/zc-code-reviewer.toml",
        sha256: sha256(agentContent),
      },
    ];
    await mkdir(join(companionRoot, "config"), { recursive: true });
    await mkdir(join(companionRoot, "agents"), { recursive: true });
    await writeFile(join(companionRoot, "config/agents.toml"), configContent.replaceAll("\n", "\r\n"));
    await writeFile(
      join(companionRoot, "agents/zc-code-reviewer.toml"),
      agentContent.replaceAll("\n", "\r\n"),
    );
    await writeFile(join(companionRoot, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.8.5",
      contentFingerprint: sha256(JSON.stringify(agentEntries)),
      config: {
        path: "config/agents.toml",
        sha256: sha256(configContent),
      },
      agents: agentEntries,
    }, null, 2)}\n`);

    const companion = await loadCodexAgentCompanion(pluginRoot);

    expect(companion.configContent).toBe(configContent);
    expect(companion.agents[0]?.content).toBe(agentContent);
  });
});
