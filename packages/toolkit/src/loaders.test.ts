import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { join } from "node:path";
import { parseSimpleYaml } from "./loaders/simple-yaml.js";
import {
  loadToolkitAssetUnit,
  loadToolkitContentTree
} from "./loaders/asset-unit.js";
import { resolveToolkitContentRoot } from "./loaders/fs.js";
import { validateToolkitAssetMeta } from "./schema/asset-meta.js";

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

describe("validateToolkitAssetMeta", () => {
  it("normalizes supported Codex custom-agent scalar configuration", () => {
    const meta = validateToolkitAssetMeta({
      kind: "agent",
      name: "code-reviewer",
      title: "代码审查",
      description: "审查代码正确性、风险与回归。",
      platforms: ["codex"],
      codex_agent: {
        model: "gpt-5.6-terra",
        model_reasoning_effort: "high",
        sandbox_mode: "read-only"
      }
    });

    assert.deepEqual(meta.codexAgent, {
      model: "gpt-5.6-terra",
      modelReasoningEffort: "high",
      sandboxMode: "read-only"
    });
  });

  it("rejects Codex custom-agent configuration on non-agent assets", () => {
    assert.throws(
      () => validateToolkitAssetMeta({
        kind: "skill",
        name: "review",
        title: "审查",
        description: "审查代码。",
        platforms: ["codex"],
        codex_agent: {
          sandbox_mode: "read-only"
        }
      }),
      /codex_agent is only valid for agent assets/
    );
  });

  it("accepts the full Codex reasoning range and rejects unsupported values", () => {
    const base = {
      kind: "agent",
      name: "reviewer",
      title: "审查",
      description: "审查代码。",
      platforms: ["codex"]
    };

    for (const modelReasoningEffort of ["max", "ultra"] as const) {
      assert.equal(
        validateToolkitAssetMeta({
          ...base,
          codex_agent: { model_reasoning_effort: modelReasoningEffort }
        }).codexAgent?.modelReasoningEffort,
        modelReasoningEffort
      );
    }
    assert.throws(
      () => validateToolkitAssetMeta({
        ...base,
        codex_agent: { model_reasoning_effort: "extreme" }
      }),
      /codex_agent\.model_reasoning_effort must be one of/
    );
    assert.throws(
      () => validateToolkitAssetMeta({
        ...base,
        codex_agent: { sandbox_mode: "repo-write" }
      }),
      /codex_agent\.sandbox_mode must be one of/
    );
  });

  it("rejects unknown Codex agent fields instead of silently inheriting runtime defaults", () => {
    assert.throws(
      () => validateToolkitAssetMeta({
        kind: "agent",
        name: "reviewer",
        title: "审查",
        description: "审查代码。",
        platforms: ["codex"],
        codex_agent: {
          model: "gpt-5.6-terra",
          sandbox_mod: "read-only"
        }
      }),
      /codex_agent contains unsupported field: sandbox_mod/
    );
  });

  it("rejects incomplete or non-Codex custom-agent configuration", () => {
    const base = {
      kind: "agent",
      name: "reviewer",
      title: "审查",
      description: "审查代码。"
    };

    assert.throws(
      () => validateToolkitAssetMeta({
        ...base,
        platforms: ["codex"],
        codex_agent: {}
      }),
      /codex_agent must configure at least one supported field/
    );
    assert.throws(
      () => validateToolkitAssetMeta({
        ...base,
        platforms: ["codex"],
        codex_agent: { model: " " }
      }),
      /codex_agent\.model must be a non-empty string/
    );
    assert.throws(
      () => validateToolkitAssetMeta({
        ...base,
        platforms: ["qwen"],
        codex_agent: { sandbox_mode: "read-only" }
      }),
      /codex_agent requires codex in platforms/
    );
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
    assert.deepEqual(unit.meta.platforms, ["qwen", "codex", "claude", "opencode", "qoder-cn"]);
  });

  it("loads supporting reference files from the asset directory", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const unit = await loadToolkitAssetUnit(
      join(contentRoot, "skills", "frontend-ui-engineering")
    );

    assert.deepEqual(
      unit.attachments.map((attachment) => attachment.relativePath),
      [
        "assets/references/accessibility-checklist.md",
        "assets/references/design-system-contract.md",
        "assets/references/LICENSE-agent-skills.txt",
      ]
    );
    assert.match(
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("accessibility-checklist.md"))?.contents ?? "",
      /# Accessibility Checklist/,
    );
    assert.match(
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("LICENSE-agent-skills.txt"))?.contents ?? "",
      /Copyright \(c\) 2025 Addy Osmani/,
    );
    assert.match(unit.body, /外部品牌、截图、站点或 `DESIGN\.md` 参考/);
    assert.match(unit.body, /URL owner/);
    assert.match(unit.body, /reload、deep-link 和 Back\/Forward/);
    assert.match(unit.body, /overlay \/ layer owner/);
    assert.match(unit.body, /SSR \/ hydration/);
    assert.match(unit.body, /动态 viewport 和 safe area/);
    assert.match(
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("design-system-contract.md"))?.contents ?? "",
      /External Reference Gate/,
    );
    assert.match(
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("design-system-contract.md"))?.contents ?? "",
      /Drift Matrix/,
    );
    assert.match(
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("design-system-contract.md"))?.contents ?? "",
      /Browser Capability Decision/,
    );
  });

  it("loads focused UI/UX review references without expanding the entry body", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const unit = await loadToolkitAssetUnit(
      join(contentRoot, "skills", "ui-ux-review")
    );

    assert.deepEqual(
      unit.attachments.map((attachment) => attachment.relativePath),
      [
        "assets/references/design-direction-and-copy.md",
        "assets/references/interaction-and-motion-checklist.md",
        "assets/references/interface-review-checklist.md",
        "assets/references/LICENSE-anthropic-frontend-design.txt",
        "assets/references/LICENSE-ui-skills.txt",
        "assets/references/LICENSE-vercel-web-interface-guidelines.txt",
      ]
    );
    assert.match(unit.body, /只读审查|read-only/i);
    assert.match(unit.body, /最多选择 3 份参考文件/);
    assert.match(unit.body, /渲染证据/);
    assert.match(unit.body, /不能单独满足 Contract 证据/);
    const interfaceChecklist =
      unit.attachments.find((attachment) =>
        attachment.relativePath.endsWith("interface-review-checklist.md"))?.contents ?? "";
    assert.match(interfaceChecklist, /背景滚动链/);
    assert.match(interfaceChecklist, /hydration/);
    assert.match(interfaceChecklist, /动态 viewport/);
  });

  it("ships the upstream license beside every copied agent-skills checklist", async () => {
    const contentRoot = resolveToolkitContentRoot();

    for (const skillName of [
      "frontend-ui-engineering",
      "code-review-and-quality",
      "security-and-hardening",
    ]) {
      const unit = await loadToolkitAssetUnit(
        join(contentRoot, "skills", skillName),
      );
      const notice = unit.attachments.find(
        (attachment) =>
          attachment.relativePath === "assets/references/LICENSE-agent-skills.txt",
      );

      assert.match(notice?.contents ?? "", /Copyright \(c\) 2025 Addy Osmani/);
    }
  });

  it("loads observability guidance through a progressive-disclosure attachment", async () => {
    const contentRoot = resolveToolkitContentRoot();
    const unit = await loadToolkitAssetUnit(
      join(contentRoot, "skills", "observability-and-instrumentation")
    );

    assert.equal(unit.meta.source?.upstream, "agent-skills");
    assert.deepEqual(
      unit.attachments.map((attachment) => attachment.relativePath),
      ["assets/references/observability-checklist.md"]
    );
    assert.match(unit.body, /references\/observability-checklist\.md/);
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
