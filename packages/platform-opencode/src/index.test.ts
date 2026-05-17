import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  capability,
  createOpenCodeGenerationPlan,
  createOpenCodeInstallPlan,
  packageName,
  platformName,
  type ToolkitManifestLike,
} from "./index.js";

const manifest = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill:sdd-tdd-workflow",
      kind: "skill",
      platforms: ["opencode"],
      name: "sdd-tdd-workflow",
      title: "工作流",
      summary: "Workflow summary",
      body: "# Workflow\n",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["opencode"],
      name: "start",
      title: "开始",
      summary: "Start command summary",
      body: "开始一个新任务。",
    },
    {
      id: "agent:reviewer",
      kind: "agent",
      platforms: ["opencode"],
      name: "reviewer",
      title: "审查代理",
      summary: "Review implementation quality",
      body: "Review me.",
    },
  ],
} as unknown as ToolkitManifestLike;

describe("@zmice/platform-opencode scaffold", () => {
  it("creates a project-scoped generation plan from toolkit assets", () => {
    const plan = createOpenCodeGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.equal(plan.capability?.namespace, capability.namespace);
    assert.deepEqual(plan.capability?.surfaces, [
      "entry-file",
      "commands-dir",
      "skills-dir",
      "agents-dir",
    ]);
    assert.equal(plan.capability?.agents.relativeDir, ".opencode/agents");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill:sdd-tdd-workflow",
      "command:start",
      "agent:reviewer",
    ]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "AGENTS.md",
      ".opencode/commands/zc-start.md",
      ".opencode/skills/zc-sdd-tdd-workflow/SKILL.md",
      ".opencode/agents/zc-reviewer.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("OpenCode 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes(".opencode/commands"));
    assert.ok(plan.artifacts[0]?.content.includes(".opencode/agents"));
    assert.ok(plan.artifacts[1]?.content.includes('description: "Start command summary"'));
    assert.ok(!plan.artifacts[1]?.content.includes("\nname: "));
    assert.ok(plan.artifacts[2]?.content.includes('name: "zc-sdd-tdd-workflow"'));
    assert.ok(plan.artifacts[3]?.content.includes('name: "zc-reviewer"'));
  });

  it("creates a project-scoped install plan with .opencode directories", () => {
    const destinationRoot = join("tmp", "opencode-project");
    const plan = createOpenCodeInstallPlan(manifest, {
      destinationRoot,
      scope: "project",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "AGENTS.md"),
      join(destinationRoot, ".opencode/commands/zc-start.md"),
      join(destinationRoot, ".opencode/skills/zc-sdd-tdd-workflow/SKILL.md"),
      join(destinationRoot, ".opencode/agents/zc-reviewer.md"),
    ]);
  });

  it("creates a global-scoped install plan using ~/.config/opencode paths", () => {
    const destinationRoot = join("tmp", "home");
    const plan = createOpenCodeInstallPlan(manifest, {
      destinationRoot,
      scope: "global",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "AGENTS.md"),
      join(destinationRoot, "commands/zc-start.md"),
      join(destinationRoot, "skills/zc-sdd-tdd-workflow/SKILL.md"),
      join(destinationRoot, "agents/zc-reviewer.md"),
    ]);
  });

  it("creates a portable dir-scoped install plan without .config or .opencode prefixes", () => {
    const destinationRoot = join("tmp", "opencode-bundle");
    const plan = createOpenCodeInstallPlan(manifest, {
      destinationRoot,
      scope: "dir",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "AGENTS.md"),
      join(destinationRoot, "commands/zc-start.md"),
      join(destinationRoot, "skills/zc-sdd-tdd-workflow/SKILL.md"),
      join(destinationRoot, "agents/zc-reviewer.md"),
    ]);
  });
});
