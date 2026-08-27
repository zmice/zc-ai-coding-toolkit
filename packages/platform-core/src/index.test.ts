import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  attachPlanMetadata,
  createAttachmentArtifacts,
  createMarkdownAgentArtifact,
  createMarkdownCommandArtifact,
  createArtifactMetadata,
  createNamespacedAssetSlug,
  createQoderCnGenerationPlan,
  createQoderCnInstallPlan,
  createStableFingerprint,
  createInstallPlan,
  createSkillArtifact,
  prependGeneratedHeader,
  qoderCnCapability,
  qoderCnPackageName,
  qoderCnPlatformName,
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
    const destinationRoot = join("tmp", "qwen");
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
        destinationRoot,
      },
    );

    assert.equal(plan.destinationRoot, destinationRoot);
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [join(destinationRoot, "QWEN.md")]);
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

  it("creates supporting-file artifacts beside a generated skill", () => {
    const asset = {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["codex"],
      attachments: [
        {
          relativePath: "assets/references/guide.md",
          contents: "# Guide\n",
        },
      ],
    } as const;

    assert.deepEqual(
      createAttachmentArtifacts({
        directory: "skills/alpha",
        asset,
      }),
      [
        {
          path: "skills/alpha/references/guide.md",
          content: "# Guide\n",
        },
      ],
    );
  });

  it("rejects supporting-file paths that escape the generated skill directory", () => {
    const asset = {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["codex"],
      attachments: [
        {
          relativePath: "assets/../outside.md",
          contents: "unsafe",
        },
      ],
    } as const;

    assert.throws(
      () => createAttachmentArtifacts({ directory: "skills/alpha", asset }),
      /不安全的附件路径/,
    );
  });
});

// ─── Qoder CN (qoder-cn) plugin generation ─────────────────────────────

const qoderCnManifest: ToolkitManifestLike = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill:alpha",
      kind: "skill",
      platforms: ["qoder-cn", "qwen"],
      title: "Alpha skill",
      summary: "Alpha summary",
      body: "Alpha skill body",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["qoder-cn"],
      title: "Start command",
      summary: "Route the task into the right workflow",
      body: "Start command body",
    },
    {
      id: "agent:reviewer",
      kind: "agent",
      platforms: ["qoder-cn"],
      title: "Reviewer agent",
      summary: "Review implementation quality",
      body: "Reviewer agent body",
      tools: ["read", "grep"],
      requires: ["skill:alpha"],
    },
    {
      id: "skill:codex-only",
      kind: "skill",
      platforms: ["codex"],
      title: "Codex exclusive skill",
      body: "Not for qoder-cn",
    },
  ],
};

describe("Qoder CN (qoder-cn) generation plan", () => {
  it("creates a generation plan with correct platform and matched assets", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);

    assert.equal(plan.platform, qoderCnPlatformName);
    assert.equal(plan.platform, "qoder-cn");
    assert.equal(plan.packageName, qoderCnPackageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.capability, qoderCnCapability);
    assert.deepEqual(
      plan.matchedAssets.map((asset) => asset.id),
      ["skill:alpha", "command:start", "agent:reviewer"],
    );
  });

  it("produces artifacts with correct paths for plugin.json, commands, skills, and agents", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);

    assert.deepEqual(
      plan.artifacts.map((artifact) => artifact.path),
      [
        ".qoder-plugin/plugin.json",
        "commands/start.md",
        "skills/alpha/SKILL.md",
        "agents/reviewer.md",
      ],
    );
  });

  it("generates Qoder CN plugin metadata and explicit component paths for the plugin UI", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);
    const pluginJsonArtifact = plan.artifacts[0];

    assert.ok(pluginJsonArtifact);
    assert.equal(pluginJsonArtifact.path, ".qoder-plugin/plugin.json");

    const parsed = JSON.parse(pluginJsonArtifact.content);
    assert.equal(typeof parsed.name, "string");
    assert.ok(parsed.name.length > 0);
    assert.equal(parsed.version, "0.1.0");
    assert.equal(parsed.displayName, "zc AI 编码工具包");
    assert.equal(parsed.homepage, "https://github.com/zmice/zc-ai-coding-toolkit");
    assert.equal(parsed.repository, "https://github.com/zmice/zc-ai-coding-toolkit.git");
    assert.equal(parsed.commands, "./commands");
    assert.equal(parsed.skills, "./skills");
    assert.equal(parsed.agents, "./agents");
    assert.equal(parsed.license, "MIT");
  });

  it("respects custom pluginVersion option", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest, {
      pluginVersion: "2.0.0",
    });
    const parsed = JSON.parse(plan.artifacts[0]!.content);

    assert.equal(parsed.version, "2.0.0");
  });

  it("generates command artifacts with correct frontmatter", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);
    const commandArtifact = plan.artifacts[1];

    assert.ok(commandArtifact);
    assert.ok(commandArtifact.content.includes('name: "start"'));
    assert.ok(commandArtifact.content.includes("Start command body"));
  });

  it("generates skill artifacts with correct frontmatter", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);
    const skillArtifact = plan.artifacts[2];

    assert.ok(skillArtifact);
    assert.ok(skillArtifact.content.includes('name: "alpha"'));
    assert.ok(skillArtifact.content.includes("Alpha skill body"));
  });

  it("generates agent artifacts with tools and skill references", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);
    const agentArtifact = plan.artifacts[3];

    assert.ok(agentArtifact);
    assert.ok(agentArtifact.content.includes('name: "reviewer"'));
    assert.ok(agentArtifact.content.includes("Reviewer agent body"));
    assert.ok(agentArtifact.content.includes('"read"'));
    assert.ok(agentArtifact.content.includes('"grep"'));
    assert.ok(agentArtifact.content.includes("alpha"));
  });

  it("filters out assets that do not target qoder-cn platform", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest);

    const matchedIds = plan.matchedAssets.map((asset) => asset.id);
    assert.ok(!matchedIds.includes("skill:codex-only"));
    assert.ok(matchedIds.includes("skill:alpha"));

    const artifactPaths = plan.artifacts.map((artifact) => artifact.path);
    assert.ok(!artifactPaths.some((path) => path.includes("codex-only")));
  });

  it("includes supporting-file attachments beside generated skills", () => {
    const attachmentManifest: ToolkitManifestLike = {
      source: "toolkit-manifest",
      assets: [
        {
          id: "skill:with-attachments",
          kind: "skill",
          platforms: ["qoder-cn"],
          title: "Skill with attachments",
          body: "See attachments.",
          attachments: [
            {
              relativePath: "assets/references/guide.md",
              contents: "# Guide\n",
            },
          ],
        },
      ],
    };

    const plan = createQoderCnGenerationPlan(attachmentManifest);

    assert.ok(
      plan.artifacts.some(
        (artifact) =>
          artifact.path === "skills/with-attachments/references/guide.md"
          && artifact.content === "# Guide\n",
      ),
    );
  });

  it("uses custom packageName and manifestSource when provided", () => {
    const plan = createQoderCnGenerationPlan(qoderCnManifest, {
      packageName: "@custom/package",
      manifestSource: "custom-source",
    });

    assert.equal(plan.packageName, "@custom/package");
    assert.equal(plan.manifestSource, "custom-source");
  });
});

describe("Qoder CN (qoder-cn) install plan", () => {
  it("creates an install plan with correct destination and defaults", () => {
    const destinationRoot = join("tmp", "qoder-cn");
    const plan = createQoderCnInstallPlan(qoderCnManifest, {
      destinationRoot,
    });

    assert.equal(plan.destinationRoot, destinationRoot);
    assert.equal(plan.scope, "project");
    assert.equal(plan.overwrite, "error");
    assert.equal(plan.platform, "qoder-cn");
  });

  it("prefixes all artifact paths with destinationRoot", () => {
    const destinationRoot = join("tmp", "qoder-cn");
    const plan = createQoderCnInstallPlan(qoderCnManifest, {
      destinationRoot,
    });

    assert.deepEqual(
      plan.artifacts.map((artifact) => artifact.path),
      [
        join(destinationRoot, ".qoder-plugin/plugin.json"),
        join(destinationRoot, "commands/start.md"),
        join(destinationRoot, "skills/alpha/SKILL.md"),
        join(destinationRoot, "agents/reviewer.md"),
      ],
    );
  });

  it("supports global scope", () => {
    const destinationRoot = join("tmp", "qoder-cn-global");
    const plan = createQoderCnInstallPlan(qoderCnManifest, {
      destinationRoot,
      scope: "global",
    });

    assert.equal(plan.scope, "global");
  });

  it("supports force overwrite mode", () => {
    const destinationRoot = join("tmp", "qoder-cn-force");
    const plan = createQoderCnInstallPlan(qoderCnManifest, {
      destinationRoot,
      overwrite: "force",
    });

    assert.equal(plan.overwrite, "force");
  });

  it("preserves artifact content after path prefixing", () => {
    const destinationRoot = join("tmp", "qoder-cn");
    const plan = createQoderCnInstallPlan(qoderCnManifest, {
      destinationRoot,
    });

    const pluginJson = JSON.parse(plan.artifacts[0]!.content);
    assert.equal(typeof pluginJson.name, "string");
    assert.ok(plan.artifacts[1]!.content.includes('name: "start"'));
  });
});
