import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { resolveToolkitContentRoot } from "./loaders/fs.js";
import {
  createToolkitManifest,
  getToolkitAssetById,
  listToolkitAssetsByKind,
  loadToolkitManifest
} from "./manifests/toolkit-manifest.js";
import { loadToolkitContentTree } from "./loaders/asset-unit.js";

describe("createToolkitManifest", () => {
  it("normalizes assets into a stable manifest", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const assets = await loadToolkitContentTree(contentRoot);
    const manifest = createToolkitManifest(assets, contentRoot);

    assert.equal(manifest.version, 1);
    assert.ok(manifest.counts.total >= 3);
    assert.ok(manifest.counts.skills >= 1);
    assert.ok(manifest.counts.commands >= 1);
    assert.ok(manifest.counts.agents >= 1);
    assert.equal(
      getToolkitAssetById(manifest, "command:verify")?.meta.title,
      "verify"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:task-plan")?.meta.title,
      "计划"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:spec")?.meta.tier,
      "core"
    );
    assert.equal(
      getToolkitAssetById(manifest, "command:spec")?.meta.source?.upstream,
      "agent-skills"
    );
    assert.equal(
      getToolkitAssetById(manifest, "skill:sdd-tdd-workflow")?.meta.source?.originPath,
      "skills/sdd-tdd-workflow/SKILL.md"
    );
    assert.equal(
      getToolkitAssetById(manifest, "skill:engineering-principles")?.meta.source?.upstream,
      "andrej-karpathy-skills"
    );
    assert.deepEqual(manifest.byRelationship.requires["command:build"], [
      "skill:incremental-implementation",
      "skill:test-driven-development"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:build"], [
      "skill:debugging-and-error-recovery",
      "skill:engineering-principles"
    ]);
    assert.deepEqual(
      getToolkitAssetById(manifest, "command:verify")?.meta.platforms,
      ["qwen", "codex", "qoder"]
    );
    assert.ok(listToolkitAssetsByKind(manifest, "agent").length >= 1);
  });
});

describe("loadToolkitManifest", () => {
  it("loads and validates the manifest from content on disk", async () => {
    const manifest = await loadToolkitManifest();

    assert.ok(manifest.assets.length >= 3);
    assert.ok(Boolean(manifest.byId["skill:sdd-tdd-workflow"]));
    assert.ok(Boolean(manifest.byId["skill:engineering-principles"]));
    assert.ok(Boolean(manifest.byId["command:spec"]));
    assert.ok(Boolean(manifest.byId["agent:architect"]));
    assert.equal(manifest.byId["skill:sdd-tdd-workflow"]?.meta.tier, "core");
    assert.equal(manifest.byId["agent:architect"]?.meta.audience, "advanced");
    assert.deepEqual(manifest.byRelationship.requires["command:quality-review"], [
      "skill:code-review-and-quality"
    ]);
    assert.deepEqual(manifest.byRelationship.suggests["command:quality-review"], [
      "skill:security-and-hardening",
      "skill:performance-optimization"
    ]);
    assert.deepEqual(
      manifest.byId["agent:test-engineer"]?.meta.platforms,
      ["qwen", "codex", "qoder"]
    );
  });
});
