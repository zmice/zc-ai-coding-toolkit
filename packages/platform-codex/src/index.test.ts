import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capability,
  createCodexGenerationPlan,
  createCodexInstallPlan,
  createCodexMarketplaceGenerationPlan,
  createCodexPluginGenerationPlan,
  packageName,
  platformName,
  templateFiles,
  type ToolkitManifestLike,
} from "./index.js";

const manifest: ToolkitManifestLike = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill-alpha",
      kind: "skill",
      platforms: ["qwen", "codex"],
      title: "Alpha skill",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["codex"],
      title: "Start command",
      name: "start",
      summary: "统一任务开始入口",
      body: "# 开始\n\n先判断工作流类型，再选择入口。\n",
    },
    {
      id: "agent:code-reviewer",
      kind: "agent",
      platforms: ["codex"],
      title: "Code reviewer",
      summary: "Review code changes for correctness and risk.",
      body: "Review code like an owner. Prioritize correctness, security, behavior regressions, and missing tests.",
    },
  ],
};

describe("@zmice/platform-codex scaffold", () => {
  it("creates a generation plan from toolkit assets", () => {
    const plan = createCodexGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill-alpha",
      "command:start",
      "agent:code-reviewer",
    ]);
    assert.deepEqual(plan.capability, capability);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.agents,
      templateFiles.config,
      "skills/zc-start/SKILL.md",
      "skills/zc-skill-alpha/SKILL.md",
      "agents/zc-code-reviewer.toml",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Codex 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("$zc-sdd-tdd"));
    assert.ok(plan.artifacts[0]?.content.includes("统一命令语义到 Codex skill 的映射"));
    assert.ok(plan.artifacts[0]?.content.includes("固定 workflow"));
    assert.ok(plan.artifacts[0]?.content.includes("config.toml"));
    assert.ok(plan.artifacts[1]?.content.includes("[agents.zc_code_reviewer]"));
    assert.ok(plan.artifacts[1]?.content.includes('config_file = "agents/zc-code-reviewer.toml"'));
    assert.ok(plan.artifacts[2]?.content.includes("command-alias skill"));
    assert.ok(plan.artifacts[2]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[3]?.content.includes("Alpha skill"));
    assert.ok(plan.artifacts[4]?.content.includes('name = "zc_code_reviewer"'));
    assert.ok(plan.artifacts[4]?.content.includes("developer_instructions"));
  });

  it("creates a global install plan with AGENTS and skills", () => {
    const plan = createCodexInstallPlan(manifest, {
      destinationRoot: "/tmp/codex",
      scope: "global",
    });

    assert.equal(plan.destinationRoot, "/tmp/codex");
    assert.equal(plan.scope, "global");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/codex/AGENTS.md",
      "/tmp/codex/config.toml",
      "/tmp/codex/skills/zc-start/SKILL.md",
      "/tmp/codex/skills/zc-skill-alpha/SKILL.md",
      "/tmp/codex/agents/zc-code-reviewer.toml",
    ]);
  });

  it("installs project AGENTS.md and project-local .codex skills", () => {
    const plan = createCodexInstallPlan(manifest, {
      destinationRoot: "/tmp/project",
      scope: "project",
    });

    assert.equal(plan.scope, "project");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/project/AGENTS.md",
      "/tmp/project/.codex/config.toml",
      "/tmp/project/.codex/skills/zc-start/SKILL.md",
      "/tmp/project/.codex/skills/zc-skill-alpha/SKILL.md",
      "/tmp/project/.codex/agents/zc-code-reviewer.toml",
    ]);
    assert.deepEqual(plan.capability.skills?.relativeDir, ".codex/skills");
    assert.deepEqual(plan.capability.agents?.relativeDir, ".codex/agents");
    assert.ok(plan.artifacts[0]?.content.includes(".codex/skills/zc-<command>/SKILL.md"));
    assert.ok(plan.artifacts[0]?.content.includes(".codex/agents/zc-*.toml"));
    assert.ok(plan.artifacts[0]?.content.includes(".codex/config.toml"));
    assert.ok(plan.artifacts[1]?.content.includes('config_file = "agents/zc-code-reviewer.toml"'));
  });

  it("creates a Codex plugin generation plan with manifest and bundled skills", () => {
    const plan = createCodexPluginGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
    });

    assert.equal(plan.platform, platformName);
    assert.deepEqual(plan.capability.surfaces, ["plugin-dir", "skills-dir"]);
    assert.equal(plan.capability.entryFile, undefined);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.pluginManifest,
      "skills/start/SKILL.md",
      "skills/skill-alpha/SKILL.md",
    ]);
    assert.ok(plan.artifacts[1]?.content.includes('name: "start"'));
    assert.ok(plan.artifacts[1]?.content.includes("$start"));
    assert.ok(!plan.artifacts[1]?.content.includes("$zc-start"));

    const pluginManifest = JSON.parse(plan.artifacts[0]!.content) as {
      name: string;
      version: string;
      skills: string;
      interface: { defaultPrompt: string[] };
      zc: { commands: number; skills: number };
    };
    assert.equal(pluginManifest.name, "zc-toolkit");
    assert.equal(pluginManifest.version, "0.2.5");
    assert.equal(pluginManifest.skills, "./skills/");
    assert.deepEqual(pluginManifest.interface.defaultPrompt, [
      "Use start to choose the right workflow for this task.",
      "Use team-orchestration when multiple agents need coordinated worktree isolation.",
    ]);
    assert.deepEqual(pluginManifest.zc, { commands: 1, skills: 1 });
  });

  it("creates a Codex repo marketplace generation plan", () => {
    const plan = createCodexMarketplaceGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.marketplace,
      templateFiles.agents,
      "plugins/zc-toolkit/.codex-plugin/plugin.json",
      "plugins/zc-toolkit/skills/start/SKILL.md",
      "plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      ".codex/config.toml",
      ".codex/agents/zc-code-reviewer.toml",
    ]);
    assert.deepEqual(plan.capability.surfaces, ["entry-file", "plugin-dir", "skills-dir", "agents-dir"]);
    assert.equal(plan.capability.entryFile?.fileName, templateFiles.agents);
    assert.equal(plan.capability.skills?.relativeDir, "plugins/zc-toolkit/skills");
    assert.equal(plan.capability.agents?.relativeDir, ".codex/agents");
    assert.ok(plan.artifacts[1]?.content.includes("Codex zc-toolkit 插件入口"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:start` -> `$start"));
    assert.ok(!plan.artifacts[1]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[1]?.content.includes("plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));

    const marketplace = JSON.parse(plan.artifacts[0]!.content) as {
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
      }>;
    };
    assert.equal(marketplace.plugins[0]?.name, "zc-toolkit");
    assert.deepEqual(marketplace.plugins[0]?.source, {
      source: "local",
      path: "./plugins/zc-toolkit",
    });
    assert.deepEqual(marketplace.plugins[0]?.policy, {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    });
  });

  it("creates a Codex personal marketplace generation plan", () => {
    const plan = createCodexMarketplaceGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
      scope: "global",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.marketplace,
      ".codex/AGENTS.md",
      ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json",
      ".codex/plugins/zc-toolkit/skills/start/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      ".codex/config.toml",
      ".codex/agents/zc-code-reviewer.toml",
    ]);
    assert.equal(plan.capability.entryFile?.fileName, ".codex/AGENTS.md");
    assert.equal(plan.capability.skills?.relativeDir, ".codex/plugins/zc-toolkit/skills");
    assert.ok(plan.artifacts[1]?.content.includes("~/.codex/plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:start` -> `$start"));

    const marketplace = JSON.parse(plan.artifacts[0]!.content) as {
      plugins: Array<{ source: { source: string; path: string } }>;
    };
    assert.deepEqual(marketplace.plugins[0]?.source, {
      source: "local",
      path: "./.codex/plugins/zc-toolkit",
    });
  });
});
