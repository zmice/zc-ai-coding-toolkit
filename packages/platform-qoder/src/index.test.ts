import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createQoderGenerationPlan,
  createQoderInstallPlan,
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
      platforms: ["qwen", "qoder"],
      title: "Alpha skill",
    },
    {
      id: "command-beta",
      kind: "command",
      platforms: ["codex"],
      title: "Beta command",
    },
  ],
};

describe("@zmice/platform-qoder scaffold", () => {
  it("creates a generation plan from toolkit assets", () => {
    const plan = createQoderGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["skill-alpha"]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [templateFiles.agents]);
    assert.ok(plan.artifacts[0]?.content.includes("skill-alpha"));
  });

  it("creates an install plan with safe overwrite defaults", () => {
    const plan = createQoderInstallPlan(manifest, { destinationRoot: "/tmp/qoder" });

    assert.equal(plan.destinationRoot, "/tmp/qoder");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/qoder/AGENTS.md"]);
  });
});
