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
    assert.ok(Boolean(manifest.byId["command:spec"]));
    assert.ok(Boolean(manifest.byId["agent:architect"]));
    assert.deepEqual(
      manifest.byId["agent:test-engineer"]?.meta.platforms,
      ["qwen", "codex", "qoder"]
    );
  });
});
