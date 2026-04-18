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
      id: "command-beta",
      kind: "command",
      platforms: ["qoder"],
      title: "Beta command",
    },
    {
      id: "skill-alpha",
      kind: "skill",
      platforms: ["qwen"],
      title: "Alpha skill",
    },
  ],
};

describe("@zmice/platform-qoder scaffold", () => {
  it("creates a generation plan from toolkit assets", () => {
    const plan = createQoderGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["command-beta"]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [templateFiles.instructions]);
    assert.ok(plan.artifacts[0]?.content.includes("Beta command"));
  });

  it("creates an install plan that is rooted at the caller destination", () => {
    const plan = createQoderInstallPlan(manifest, { destinationRoot: "/tmp/qoder" });

    assert.equal(plan.destinationRoot, "/tmp/qoder");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/qoder/instructions.md",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("工具包资产"));
  });
});
