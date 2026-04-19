import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  capability,
  createQoderGenerationPlan,
  createQoderInstallPlan,
  packageName,
  platformName,
  templateFiles,
  type ToolkitManifestLike,
} from "./index.js";

const manifest = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill-alpha",
      kind: "skill",
      platforms: ["qwen", "qoder"],
      name: "alpha",
      title: "Alpha skill",
      summary: "Alpha skill summary",
      body: "# Alpha skill\n",
    },
    {
      id: "command-beta",
      kind: "command",
      platforms: ["qoder"],
      name: "beta",
      title: "Beta command",
      summary: "Beta command summary",
      body: "执行 Beta command。",
    },
    {
      id: "agent-gamma",
      kind: "agent",
      platforms: ["qoder"],
      name: "gamma",
      title: "Gamma agent",
      summary: "Gamma agent summary",
      body: "作为 Gamma agent 执行任务。",
      tools: ["read", "edit"],
      requires: ["skill:skill-alpha", "command:command-beta"],
    },
  ],
} as unknown as ToolkitManifestLike;

describe("@zmice/platform-qoder scaffold", () => {
  it("creates a project-scoped generation plan from toolkit assets", () => {
    const plan = createQoderGenerationPlan(manifest, { scope: "project" });

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.equal(plan.capability?.namespace, capability.namespace);
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill-alpha",
      "command-beta",
      "agent-gamma",
    ]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.agents,
      ".qoder/commands/zc-beta.md",
      ".qoder/skills/zc-alpha/SKILL.md",
      ".qoder/agents/zc-gamma.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("skill-alpha"));
    assert.ok(plan.artifacts[1]?.content.includes('name: "zc-beta"'));
    assert.ok(plan.artifacts[2]?.content.includes('name: "zc-alpha"'));
    assert.ok(plan.artifacts[3]?.content.includes('tools:'));
    assert.ok(plan.artifacts[3]?.content.includes('"zc-skill-alpha"'));
  });

  it("creates a project-scoped install plan with .qoder directories", () => {
    const plan = createQoderInstallPlan(manifest, {
      destinationRoot: "/tmp/qoder-project",
      scope: "project",
    });

    assert.equal(plan.destinationRoot, "/tmp/qoder-project");
    assert.equal(plan.scope, "project");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/qoder-project/AGENTS.md",
      "/tmp/qoder-project/.qoder/commands/zc-beta.md",
      "/tmp/qoder-project/.qoder/skills/zc-alpha/SKILL.md",
      "/tmp/qoder-project/.qoder/agents/zc-gamma.md",
    ]);
  });

  it("creates a global-scoped install plan with root commands/skills/agents directories", () => {
    const plan = createQoderInstallPlan(manifest, {
      destinationRoot: "/tmp/qoder-home",
      scope: "global",
    });

    assert.equal(plan.scope, "global");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/qoder-home/AGENTS.md",
      "/tmp/qoder-home/commands/zc-beta.md",
      "/tmp/qoder-home/skills/zc-alpha/SKILL.md",
      "/tmp/qoder-home/agents/zc-gamma.md",
    ]);
  });
});
