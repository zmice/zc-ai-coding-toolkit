import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createInstallPlan,
  selectMatchedAssets,
  type PlatformArtifact,
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

const artifacts: readonly PlatformArtifact[] = [
  {
    path: "QWEN.md",
    content: "# qwen",
  },
];

describe("@zmice/platform-core", () => {
  it("selects assets by platform", () => {
    const matched = selectMatchedAssets(manifest, "qwen");

    assert.deepEqual(matched.map((asset) => asset.id), ["skill-alpha"]);
  });

  it("creates install plans rooted at the destination with safe overwrite defaults", () => {
    const plan = createInstallPlan(
      {
        platform: "qwen",
        packageName: "@zmice/platform-qwen",
        manifestSource: "toolkit-manifest",
        matchedAssets: selectMatchedAssets(manifest, "qwen"),
        artifacts,
      },
      {
        destinationRoot: "/tmp/qwen",
      },
    );

    assert.equal(plan.destinationRoot, "/tmp/qwen");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/qwen/QWEN.md"]);
  });
});
