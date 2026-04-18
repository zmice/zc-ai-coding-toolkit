import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
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
      id: "skill-alpha",
      kind: "skill",
      platforms: ["qwen", "codex"],
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

describe("@zmice/platform-qwen scaffold", () => {
  it("creates a generation plan from toolkit assets", () => {
    const plan = createQwenGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["skill-alpha"]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.context,
      templateFiles.extensionManifest,
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("skill-alpha"));
    assert.ok(plan.artifacts[1]?.content.includes(`"contextFile": "${templateFiles.context}"`));
  });

  it("creates an install plan that is rooted at the caller destination", () => {
    const plan = createQwenInstallPlan(manifest, { destinationRoot: "/tmp/qwen" });

    assert.equal(plan.destinationRoot, "/tmp/qwen");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      "/tmp/qwen/QWEN.md",
      "/tmp/qwen/qwen-extension.json",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("工具包资产"));
  });
});
