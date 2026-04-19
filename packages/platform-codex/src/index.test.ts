import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capability,
  createCodexGenerationPlan,
  createCodexInstallPlan,
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
  ],
};

describe("@zmice/platform-codex scaffold", () => {
  it("creates a generation plan from toolkit assets", () => {
    const plan = createCodexGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["skill-alpha", "command:start"]);
    assert.deepEqual(plan.capability, capability);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.agents,
      "skills/zc-start/SKILL.md",
      "skills/zc-skill-alpha/SKILL.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Codex 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("$zc-sdd-tdd"));
    assert.ok(plan.artifacts[0]?.content.includes("统一命令语义到 Codex skill 的映射"));
    assert.ok(plan.artifacts[0]?.content.includes("固定 workflow"));
    assert.ok(plan.artifacts[1]?.content.includes("command-alias skill"));
    assert.ok(plan.artifacts[1]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[2]?.content.includes("Alpha skill"));
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
      "/tmp/codex/skills/zc-start/SKILL.md",
      "/tmp/codex/skills/zc-skill-alpha/SKILL.md",
    ]);
  });

  it("keeps project installs conservative and only writes AGENTS.md", () => {
    const plan = createCodexInstallPlan(manifest, {
      destinationRoot: "/tmp/project",
      scope: "project",
    });

    assert.equal(plan.scope, "project");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/project/AGENTS.md"]);
  });
});
