import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadToolkitManifest } from "./manifests/toolkit-manifest.js";
import {
  recommendToolkitAssets,
  resolveToolkitAssetQuery,
  searchToolkitAssets
} from "./query/toolkit-query.js";

describe("toolkit query helpers", () => {
  it("resolves shorthand asset queries when unique", async () => {
    const manifest = await loadToolkitManifest();
    const asset = resolveToolkitAssetQuery(manifest, "spec");

    assert.equal(asset?.id, "command:spec");
  });

  it("searches assets by keyword across id/title/description", async () => {
    const manifest = await loadToolkitManifest();
    const matches = searchToolkitAssets(manifest, "review");

    assert.ok(matches.some((asset) => asset.id === "command:quality-review"));
    assert.ok(matches.some((asset) => asset.id === "agent:code-reviewer"));
  });

  it("builds recommendations from requires and suggests", async () => {
    const manifest = await loadToolkitManifest();
    const recommendation = recommendToolkitAssets(manifest, "build");

    assert.equal(recommendation?.target.id, "command:build");
    assert.deepEqual(
      recommendation?.required.map((asset) => asset.id),
      ["skill:incremental-implementation", "skill:test-driven-development"]
    );
    assert.deepEqual(
      recommendation?.suggested.map((asset) => asset.id),
      ["skill:debugging-and-error-recovery", "skill:engineering-principles"]
    );
  });
});
