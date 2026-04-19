import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capability,
  createClaudeGenerationPlan,
  createClaudeInstallPlan,
  packageName,
  platformName,
  templateFiles,
  type ToolkitManifestLike,
} from "./index.js";

const manifest = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["claude"],
      title: "Alpha skill",
      summary: "Alpha skill summary",
      body: "Alpha skill body",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["claude"],
      name: "start",
      title: "开始",
      summary: "Start command summary",
      body: "开始一个新任务。",
    },
    {
      id: "agent:architect",
      kind: "agent",
      platforms: ["claude"],
      name: "architect",
      title: "架构师",
      summary: "Architect agent summary",
      body: "作为架构师执行任务。",
      tools: ["read", "edit"],
    },
  ],
} as unknown as ToolkitManifestLike;

describe("@zmice/platform-claude scaffold", () => {
  it("creates a project-scoped generation plan from toolkit assets", () => {
    const plan = createClaudeGenerationPlan(manifest, { scope: "project" });

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.equal(plan.capability?.namespace, capability.namespace);
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill:alpha",
      "command:start",
      "agent:architect",
    ]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.claude,
      ".claude/commands/zc-start.md",
      ".claude/agents/zc-architect.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Claude Code 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("未生成的 skill 资产：1 个"));
    assert.ok(plan.artifacts[1]?.content.includes('name: "zc-start"'));
    assert.ok(plan.artifacts[2]?.content.includes('tools:'));
  });

  it("creates a project-scoped install plan with .claude directories", () => {
    const plan = createClaudeInstallPlan(manifest, {
      destinationRoot: "/tmp/claude-project",
      scope: "project",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/claude-project/CLAUDE.md",
      "/tmp/claude-project/.claude/commands/zc-start.md",
      "/tmp/claude-project/.claude/agents/zc-architect.md",
    ]);
  });

  it("creates a global-scoped install plan with root commands/agents directories", () => {
    const plan = createClaudeInstallPlan(manifest, {
      destinationRoot: "/tmp/claude-home",
      scope: "global",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/claude-home/CLAUDE.md",
      "/tmp/claude-home/commands/zc-start.md",
      "/tmp/claude-home/agents/zc-architect.md",
    ]);
  });
});
