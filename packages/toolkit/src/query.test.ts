import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadToolkitManifest } from "./manifests/toolkit-manifest.js";
import type { ToolkitAssetUnit, ToolkitManifest } from "./types.js";
import {
  recommendToolkitAssets,
  resolveToolkitAssetQuery,
  searchToolkitAssets
} from "./query/toolkit-query.js";

function createSyntheticCommandAsset(
  id: string,
  options: {
    name: string;
    title: string;
    description?: string;
    workflowFamily?: ToolkitAssetUnit["meta"]["workflowFamily"];
    workflowRole?: ToolkitAssetUnit["meta"]["workflowRole"];
    routingWorkflows?: ToolkitAssetUnit["meta"]["routingWorkflows"];
    taskTypes?: ToolkitAssetUnit["meta"]["taskTypes"];
    requires?: readonly string[];
    suggests?: readonly string[];
  }
): ToolkitAssetUnit {
  return {
    id,
    meta: {
      kind: "command",
      name: options.name,
      title: options.title,
      description: options.description ?? options.title,
      ...(options.workflowFamily ? { workflowFamily: options.workflowFamily } : {}),
      ...(options.workflowRole ? { workflowRole: options.workflowRole } : {}),
      ...(options.routingWorkflows ? { routingWorkflows: options.routingWorkflows } : {}),
      ...(options.taskTypes ? { taskTypes: options.taskTypes } : {}),
      ...(options.requires ? { requires: options.requires } : {}),
      ...(options.suggests ? { suggests: options.suggests } : {})
    },
    body: "",
    attachments: [],
    source: {
      directory: id,
      meta: `${id}/meta.yaml`,
      body: `${id}/body.md`,
      assets: `${id}/assets`
    }
  };
}

function createSyntheticManifest(assets: readonly ToolkitAssetUnit[]): ToolkitManifest {
  const byId = Object.fromEntries(assets.map((asset) => [asset.id, asset]));
  return {
    version: 1,
    generatedAt: "2026-04-19T00:00:00.000Z",
    contentRoot: "/synthetic",
    counts: {
      skills: 0,
      commands: assets.length,
      agents: 0,
      total: assets.length
    },
    assets,
    byId,
    byRelationship: {
      requires: Object.fromEntries(assets.map((asset) => [asset.id, asset.meta.requires ?? []])),
      suggests: Object.fromEntries(assets.map((asset) => [asset.id, asset.meta.suggests ?? []])),
      conflictsWith: Object.fromEntries(assets.map((asset) => [asset.id, asset.meta.conflictsWith ?? []])),
      supersedes: Object.fromEntries(assets.map((asset) => [asset.id, asset.meta.supersedes ?? []]))
    }
  };
}

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
      workflowEntries: {
        "full-delivery": "command:sdd-tdd",
        bugfix: "command:debug"
      },
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
      workflowEntries: {
        "product-analysis": "command:product-analysis",
        "full-delivery": "command:sdd-tdd",
        bugfix: "command:debug",
        "review-closure": "command:quality-review",
        "docs-release": "command:doc",
        investigation: "command:onboard"
      },
      taskTypes: ["feature", "bugfix", "review", "docs", "release", "investigation"],
      next: [
        "command:product-analysis",
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

  it("treats product-analysis as the workflow entry for product shaping work", async () => {
    const manifest = await loadToolkitManifest();
    const recommendation = recommendToolkitAssets(manifest, "product-analysis");

    assert.equal(recommendation?.target.id, "command:product-analysis");
    assert.deepEqual(recommendation?.route, {
      family: "lifecycle",
      role: "workflow-entry",
      workflows: ["product-analysis"],
      workflowEntries: {
        "product-analysis": "command:product-analysis"
      },
      taskTypes: ["feature", "investigation"],
      next: ["command:idea", "command:spec", "command:plan-review", "command:task-plan"],
      requiresFullLifecycle: true
    });
    assert.deepEqual(recommendation?.entry, {
      commandId: "command:product-analysis",
      reason: "该资产本身就是适合直接进入的 workflow 入口。"
    });
  });

  it("prefers command:product-analysis as the product-analysis workflow entry when present", () => {
    const manifest = createSyntheticManifest([
      createSyntheticCommandAsset("command:start", {
        name: "start",
        title: "开始",
        workflowFamily: "intake",
        workflowRole: "intake-router",
        routingWorkflows: [
          "product-analysis",
          "full-delivery",
          "bugfix",
          "review-closure",
          "docs-release",
          "investigation"
        ],
        taskTypes: ["feature", "bugfix", "review", "docs", "release", "investigation"],
        suggests: ["command:product-analysis", "command:sdd-tdd", "command:debug"]
      }),
      createSyntheticCommandAsset("command:product-analysis", {
        name: "product-analysis",
        title: "产品分析",
        workflowFamily: "lifecycle",
        workflowRole: "workflow-entry",
        routingWorkflows: ["product-analysis"],
        taskTypes: ["feature", "investigation"]
      }),
      createSyntheticCommandAsset("command:idea", {
        name: "idea",
        title: "想法",
        workflowFamily: "specialized",
        workflowRole: "specialized-entry",
        routingWorkflows: ["product-analysis", "investigation"],
        taskTypes: ["feature", "investigation"]
      }),
      createSyntheticCommandAsset("command:sdd-tdd", {
        name: "sdd-tdd",
        title: "工作流",
        workflowFamily: "lifecycle",
        workflowRole: "workflow-entry",
        routingWorkflows: ["full-delivery"],
        taskTypes: ["feature"]
      }),
      createSyntheticCommandAsset("command:debug", {
        name: "debug",
        title: "调试",
        workflowFamily: "specialized",
        workflowRole: "workflow-entry",
        routingWorkflows: ["bugfix"],
        taskTypes: ["bugfix"]
      }),
      createSyntheticCommandAsset("command:quality-review", {
        name: "quality-review",
        title: "审查",
        workflowFamily: "lifecycle",
        workflowRole: "workflow-entry",
        routingWorkflows: ["review-closure"],
        taskTypes: ["review"]
      }),
      createSyntheticCommandAsset("command:doc", {
        name: "doc",
        title: "文档",
        workflowFamily: "specialized",
        workflowRole: "workflow-entry",
        routingWorkflows: ["docs-release"],
        taskTypes: ["docs", "release"]
      }),
      createSyntheticCommandAsset("command:onboard", {
        name: "onboard",
        title: "入门",
        workflowFamily: "specialized",
        workflowRole: "workflow-entry",
        routingWorkflows: ["investigation"],
        taskTypes: ["investigation"]
      })
    ]);

    const recommendation = recommendToolkitAssets(manifest, "start");

    assert.equal(
      recommendation?.route?.workflowEntries["product-analysis"],
      "command:product-analysis"
    );
  });
});
