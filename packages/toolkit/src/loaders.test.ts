import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { join } from "node:path";
import { parseSimpleYaml } from "./loaders/simple-yaml.js";
import {
  loadToolkitAssetUnit,
  loadToolkitContentTree
} from "./loaders/asset-unit.js";
import { resolveToolkitContentRoot } from "./loaders/fs.js";

describe("parseSimpleYaml", () => {
  it("parses the metadata subset used by toolkit assets", () => {
    const parsed = parseSimpleYaml(`
kind: skill
name: context-budget-audit
title: Context Budget Audit
description: Audits context window consumption across agents, skills, instructions, and commands.
tags:
  - context
  - audit
platforms:
  - qwen
  - codex
tools:
  - Read
  - Bash
`);

    assert.deepEqual(parsed, {
      kind: "skill",
      name: "context-budget-audit",
      title: "Context Budget Audit",
      description: "Audits context window consumption across agents, skills, instructions, and commands.",
      tags: ["context", "audit"],
      platforms: ["qwen", "codex"],
      tools: ["Read", "Bash"]
    });
  });
});

describe("loadToolkitAssetUnit", () => {
  it("loads a representative migrated asset unit", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const unit = await loadToolkitAssetUnit(
      join(contentRoot, "skills", "context-budget-audit")
    );

    assert.equal(unit.id, "skill:context-budget-audit");
    assert.equal(unit.meta.kind, "skill");
    assert.equal(unit.meta.name, "context-budget-audit");
    assert.match(unit.body, /Context Budget Audit|Context Window Consumption|context/i);
    assert.ok(unit.attachments.length >= 0);
    assert.deepEqual(unit.meta.platforms, ["qwen", "codex", "qoder"]);
  });
});

describe("loadToolkitContentTree", () => {
  it("loads the toolkit content tree and includes representative migrated assets", async () => {
    const assets = await loadToolkitContentTree();

    assert.ok(assets.length >= 3);
    assert.ok(assets.some((asset) => asset.id === "skill:context-budget-audit"));
    assert.ok(assets.some((asset) => asset.id === "command:verify"));
    assert.ok(assets.some((asset) => asset.id === "agent:test-engineer"));
  });
});
