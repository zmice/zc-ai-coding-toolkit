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
      [
        "command:quality-review",
        "command:verify",
        "skill:debugging-and-error-recovery",
        "skill:engineering-principles"
      ]
    );
    assert.deepEqual(recommendation?.route, {
      family: "lifecycle",
      role: "stage-entry",
      workflows: ["full-delivery", "bugfix"],
      taskTypes: ["feature", "bugfix"],
      next: ["command:quality-review", "command:verify"],
      requiresFullLifecycle: true
    });
    assert.deepEqual(recommendation?.entry, {
      commandId: "command:start",
      reason: "这是阶段入口；若还未完成任务判型，建议先从统一入口开始。"
    });
  });

  it("treats the unified start asset as the routing entry", async () => {
    const manifest = await loadToolkitManifest();
    const recommendation = recommendToolkitAssets(manifest, "start");

    assert.equal(recommendation?.target.id, "command:start");
    assert.deepEqual(recommendation?.route, {
      family: "intake",
      role: "intake-router",
      workflows: [
        "product-analysis",
        "full-delivery",
        "bugfix",
        "review-closure",
        "docs-release",
        "investigation"
      ],
      taskTypes: ["feature", "bugfix", "review", "docs", "release", "investigation"],
      next: [
        "command:sdd-tdd",
        "command:spec",
        "command:plan-review",
        "command:task-plan",
        "command:build",
        "command:quality-review",
        "command:verify",
        "command:debug",
        "command:doc",
        "command:ship",
        "command:onboard",
        "command:ctx-health",
        "command:idea",
        "command:guard"
      ],
      requiresFullLifecycle: false
    });
    assert.deepEqual(recommendation?.entry, {
      commandId: "command:start",
      reason: "该资产本身就是统一任务开始入口。"
    });
  });
});
