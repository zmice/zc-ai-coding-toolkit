import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capability,
  createQwenGenerationPlan,
  createQwenInstallPlan,
  packageName,
  platformName,
  templateFiles,
  type ToolkitManifestLike,
} from "./index.js";

const manifest: ToolkitManifestLike = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["qwen", "codex"],
      title: "Alpha skill",
      body: "Alpha skill body",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["qwen"],
      title: "Start command",
      summary: "Route the task into the right workflow",
      body: "Start command body",
    },
    {
      id: "agent:reviewer",
      kind: "agent",
      platforms: ["qwen"],
      title: "Reviewer agent",
      summary: "Review implementation quality",
      body: "Reviewer agent body",
      tools: ["read", "grep"],
      requires: ["skill:alpha"],
    },
  ],
};

describe("@zmice/platform-qwen scaffold", () => {
  it("creates a project-scope extension generation plan from toolkit assets", () => {
    const plan = createQwenGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.equal(plan.capability?.extension?.name, templateFiles.extensionName);
    assert.deepEqual(plan.capability, capability);
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill:alpha",
      "command:start",
      "agent:reviewer",
    ]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      ".qwen/extensions/zc-toolkit/QWEN.md",
      ".qwen/extensions/zc-toolkit/qwen-extension.json",
      ".qwen/extensions/zc-toolkit/commands/zc/start.md",
      ".qwen/extensions/zc-toolkit/skills/zc-alpha/SKILL.md",
      ".qwen/extensions/zc-toolkit/agents/zc-reviewer.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Qwen 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("zc:start"));
    assert.ok(plan.artifacts[0]?.content.includes("固定 workflow"));
    assert.ok(plan.artifacts[1]?.content.includes(`"name": "${templateFiles.extensionName}"`));
    assert.ok(plan.artifacts[1]?.content.includes(`"version": "0.1.0"`));
    assert.ok(plan.artifacts[1]?.content.includes(`"contextFileName": "${templateFiles.context}"`));
    assert.ok(plan.artifacts[2]?.content.includes('name: "zc:start"'));
    assert.ok(plan.artifacts[3]?.content.includes('name: "zc-alpha"'));
    assert.ok(plan.artifacts[4]?.content.includes('name: "zc-reviewer"'));
  });

  it("creates a global install plan rooted at the caller destination", () => {
    const plan = createQwenInstallPlan(manifest, {
      destinationRoot: "/tmp/qwen",
      scope: "global",
    });

    assert.equal(plan.destinationRoot, "/tmp/qwen");
    assert.equal(plan.scope, "global");
    assert.equal(plan.overwrite, "error");
    assert.equal(plan.capability?.namespace, "zc");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/qwen/extensions/zc-toolkit/QWEN.md",
      "/tmp/qwen/extensions/zc-toolkit/qwen-extension.json",
      "/tmp/qwen/extensions/zc-toolkit/commands/zc/start.md",
      "/tmp/qwen/extensions/zc-toolkit/skills/zc-alpha/SKILL.md",
      "/tmp/qwen/extensions/zc-toolkit/agents/zc-reviewer.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Qwen 工作流入口"));
    assert.ok(plan.artifacts[2]?.content.includes("Start command body"));
  });
});
