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
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["skill-alpha"]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [templateFiles.agents]);
    assert.ok(plan.artifacts[0]?.content.includes("skill-alpha"));
  });

  it("creates an install plan with safe overwrite defaults", () => {
    const plan = createCodexInstallPlan(manifest, { destinationRoot: "/tmp/codex" });

    assert.equal(plan.destinationRoot, "/tmp/codex");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/codex/AGENTS.md"]);
  });
});
