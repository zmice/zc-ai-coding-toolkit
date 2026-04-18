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
tier: recommended
audience: advanced
stability: stable
tags:
  - context
  - audit
platforms:
  - qwen
  - codex
tools:
  - Read
  - Bash
source:
  upstream: everything-claude-code
  strategy: adapted
  origin_name: context-budget-audit
  origin_path: prompts/context-budget-audit.md
  origin_id: prompt:context-budget-audit
  notes: governance baseline
`);

    assert.deepEqual(parsed, {
      kind: "skill",
      name: "context-budget-audit",
      title: "Context Budget Audit",
      description: "Audits context window consumption across agents, skills, instructions, and commands.",
      tier: "recommended",
      audience: "advanced",
      stability: "stable",
      tags: ["context", "audit"],
      platforms: ["qwen", "codex"],
      tools: ["Read", "Bash"],
      source: {
        upstream: "everything-claude-code",
        strategy: "adapted",
        origin_name: "context-budget-audit",
        origin_path: "prompts/context-budget-audit.md",
        origin_id: "prompt:context-budget-audit",
        notes: "governance baseline"
      }
    });
  });
});

describe("loadToolkitAssetUnit", () => {
  it("loads a representative migrated asset unit", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const unit = await loadToolkitAssetUnit(
      join(contentRoot, "skills", "sdd-tdd-workflow")
    );

    assert.equal(unit.id, "skill:sdd-tdd-workflow");
    assert.equal(unit.meta.kind, "skill");
    assert.equal(unit.meta.name, "sdd-tdd-workflow");
    assert.equal(unit.meta.tier, "core");
    assert.equal(unit.meta.audience, "default");
    assert.equal(unit.meta.stability, "stable");
    assert.equal(unit.meta.source?.upstream, "agent-skills");
    assert.equal(unit.meta.source?.strategy, "adapted");
    assert.equal(unit.meta.source?.originName, "sdd-tdd-workflow");
    assert.equal(unit.meta.source?.originPath, "skills/sdd-tdd-workflow/SKILL.md");
    assert.match(unit.body, /SDD\+TDD|spec|test|workflow/i);
    assert.ok(unit.attachments.length >= 0);
    assert.deepEqual(unit.meta.platforms, ["qwen", "codex", "qoder"]);
  });
});

describe("loadToolkitContentTree", () => {
  it("loads the toolkit content tree and includes representative migrated assets", async () => {
    const assets = await loadToolkitContentTree();

    assert.ok(assets.length >= 3);
    assert.ok(assets.some((asset) => asset.id === "skill:sdd-tdd-workflow"));
    assert.ok(assets.some((asset) => asset.id === "command:verify"));
    assert.ok(assets.some((asset) => asset.id === "agent:test-engineer"));
  });
});
