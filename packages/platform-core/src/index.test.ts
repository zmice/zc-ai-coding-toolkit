import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  attachPlanMetadata,
  createMarkdownAgentArtifact,
  createMarkdownCommandArtifact,
  createArtifactMetadata,
  createNamespacedAssetSlug,
  createStableFingerprint,
  createInstallPlan,
  createSkillArtifact,
  prependGeneratedHeader,
  renderPlatformAssetList,
  selectMatchedAssets,
  stripAssetKindPrefix,
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
      platforms: ["claude"],
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
  it("creates stable sha256 fingerprints independent of object key order", () => {
    const first = createStableFingerprint({
      b: 2,
      a: 1,
      nested: {
        z: true,
        y: [{ b: "second", a: "first" }],
      },
    });
    const second = createStableFingerprint({
      nested: {
        y: [{ a: "first", b: "second" }],
        z: true,
      },
      a: 1,
      b: 2,
    });

    assert.deepEqual(first, second);
    assert.equal(first.algorithm, "sha256");
    assert.match(first.value, /^[a-f0-9]{64}$/);
  });

  it("derives artifact metadata from content without coupling it to the artifact path", () => {
    const originalArtifact: PlatformArtifact = {
      path: "QWEN.md",
      content: "# qwen\n",
    };
    const renamedArtifact: PlatformArtifact = {
      path: "/tmp/qwen/QWEN.md",
      content: "# qwen\n",
    };
    const original = createArtifactMetadata(originalArtifact);
    const renamed = createArtifactMetadata(renamedArtifact);

    assert.equal(original.bytes, Buffer.byteLength("# qwen\n"));
    assert.deepEqual(original, renamed);
  });

  it("selects assets by platform", () => {
    const matched = selectMatchedAssets(manifest, "qwen");

    assert.deepEqual(matched.map((asset) => asset.id), ["skill-alpha"]);
  });

  it("attaches generation metadata and normalizes artifact metadata", () => {
    const plan = attachPlanMetadata({
      platform: "qwen",
      packageName: "@zmice/platform-qwen",
      manifestSource: "toolkit-manifest",
      matchedAssets: selectMatchedAssets(manifest, "qwen"),
      artifacts,
    });

    assert.equal(plan.metadata?.artifactCount, 1);
    assert.equal(plan.artifacts[0]?.metadata?.bytes, Buffer.byteLength("# qwen"));
    assert.match(plan.metadata?.fingerprint.value ?? "", /^[a-f0-9]{64}$/);
  });

  it("creates install plans rooted at the destination with safe overwrite defaults", () => {
    const generationPlan = attachPlanMetadata({
      platform: "qwen",
      packageName: "@zmice/platform-qwen",
      manifestSource: "toolkit-manifest",
      matchedAssets: selectMatchedAssets(manifest, "qwen"),
      artifacts,
    });
    const plan = createInstallPlan(
      generationPlan,
      {
        destinationRoot: "/tmp/qwen",
      },
    );

    assert.equal(plan.destinationRoot, "/tmp/qwen");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), ["/tmp/qwen/QWEN.md"]);
    assert.deepEqual(plan.artifacts[0]?.metadata, generationPlan.artifacts[0]?.metadata);
    assert.notEqual(plan.metadata?.fingerprint.value, generationPlan.metadata?.fingerprint.value);
  });

  it("prepends caller-defined generated headers without baking in a comment syntax", () => {
    const content = prependGeneratedHeader("{\n  \"name\": \"demo\"\n}\n", {
      linePrefix: "//",
      lines: ["Generated file", "Do not edit manually"],
    });

    assert.equal(
      content,
      "// Generated file\n// Do not edit manually\n\n{\n  \"name\": \"demo\"\n}\n",
    );
  });

  it("normalizes asset names and renders shared platform snippets", () => {
    const asset = {
      id: "command:start",
      kind: "command",
      platforms: ["qwen"],
      title: "Start",
      summary: "Start a task",
      body: "Body",
    } as const;

    assert.equal(stripAssetKindPrefix(asset.id), "start");
    assert.equal(stripAssetKindPrefix("skill-alpha", { separators: [":"] }), "skill-alpha");
    assert.equal(stripAssetKindPrefix("skill-alpha", { separators: [":", "-"] }), "alpha");
    assert.equal(createNamespacedAssetSlug(asset), "zc-start");
    assert.equal(renderPlatformAssetList([asset]), "- `command` `command:start`: Start");
    assert.equal(renderPlatformAssetList([]), "- 尚未匹配到任何工具包资产。");
  });

  it("creates markdown artifacts with stable frontmatter", () => {
    const asset = {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["qwen"],
      title: "Alpha",
      summary: "Alpha summary",
      body: "Alpha body",
      tools: ["read"],
    } as const;

    assert.equal(
      createMarkdownCommandArtifact({
        path: "commands/zc-alpha.md",
        asset,
        name: "zc:alpha",
      }).content,
      '---\nname: "zc:alpha"\ndescription: "Alpha summary"\n---\n\nAlpha body\n',
    );
    assert.equal(
      createSkillArtifact({
        path: "skills/zc-alpha/SKILL.md",
        asset,
        name: "zc-alpha",
      }).content,
      '---\nname: "zc-alpha"\ndescription: "Alpha summary"\n---\n\nAlpha body\n',
    );
    assert.equal(
      createMarkdownAgentArtifact({
        path: "agents/zc-alpha.md",
        asset,
        name: "zc-alpha",
        tools: asset.tools,
      }).content,
      '---\nname: "zc-alpha"\ndescription: "Alpha summary"\ntools:\n  - "read"\n---\n\nAlpha body\n',
    );
  });
});
