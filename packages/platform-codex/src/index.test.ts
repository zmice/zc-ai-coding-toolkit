import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
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
      id: "agent-gamma",
      kind: "agent",
      platforms: ["codex"],
      title: "Gamma agent",
    },
    {
      id: "command-beta",
      kind: "command",
      platforms: ["qoder"],
      title: "Beta command",
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
      "agent-gamma",
    ]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [templateFiles.agents]);
    assert.ok(plan.artifacts[0]?.content.includes("Gamma agent"));
  });

  it("creates an install plan that is rooted at the caller destination", () => {
    const plan = createCodexInstallPlan(manifest, { destinationRoot: "/tmp/codex" });

    assert.equal(plan.destinationRoot, "/tmp/codex");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/codex/AGENTS.md"]);
    assert.ok(plan.artifacts[0]?.content.includes("工具包资产"));
  });
});
