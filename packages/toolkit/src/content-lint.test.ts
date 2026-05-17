import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { lintToolkitManifest } from "./lint/content-lint.js";
import type { ToolkitManifest } from "./types.js";

interface ManifestAssetInput {
  id?: string;
  meta?: Partial<ToolkitManifest["assets"][number]["meta"]>;
  body?: string;
}

const adaptedAgentSkillsSource = {
  upstream: "agent-skills",
  strategy: "adapted"
} as const;

const adaptedAgentSkillsSourceWithOrigin = {
  ...adaptedAgentSkillsSource,
  originName: "spec-driven-development",
  originPath: "skills/spec-driven-development/SKILL.md",
  originId: "skill:spec-driven-development"
} as const;

function makeManifest(
  overrides: Partial<ToolkitManifest["assets"][number]["meta"]>,
  relationships?: Partial<ToolkitManifest["byRelationship"]>
): ToolkitManifest {
  return makeManifestWithAssets([{ meta: overrides }], relationships);
}

function makeManifestWithAssets(
  assets: readonly ManifestAssetInput[],
  relationships?: Partial<ToolkitManifest["byRelationship"]>
): ToolkitManifest {
  const resolvedAssets: ToolkitManifest["assets"] = assets.map((asset, index) => {
    const assetId = asset.id ?? `skill:test-${index + 1}`;

    return {
      id: assetId,
      meta: {
        kind: "skill" as const,
        name: assetId.split(":")[1] ?? `test-${index + 1}`,
        title: assetId.split(":")[1] ?? `test-${index + 1}`,
        description: "test asset",
        ...asset.meta
      },
      body: asset.body ?? "## 何时使用\n\n- 测试场景\n",
      attachments: [],
      source: {
        directory: `/tmp/toolkit/${assetId}`,
        meta: `/tmp/toolkit/${assetId}/meta.yaml`,
        body: `/tmp/toolkit/${assetId}/body.md`,
        assets: `/tmp/toolkit/${assetId}/assets`
      }
    };
  });

  return {
    version: 1,
    generatedAt: "2026-04-19T00:00:00.000Z",
    contentRoot: "/tmp/toolkit",
    counts: {
      skills: resolvedAssets.length,
      commands: 0,
      agents: 0,
      total: resolvedAssets.length
    },
    assets: resolvedAssets,
    byId: {},
    byRelationship: {
      requires: relationships?.requires ?? {},
      suggests: relationships?.suggests ?? {},
      conflictsWith: relationships?.conflictsWith ?? {},
      supersedes: relationships?.supersedes ?? {}
    }
  };
}

describe("lintToolkitManifest", () => {
  it("warns when governance metadata is missing", () => {
    const result = lintToolkitManifest(makeManifest({}));

    assert.equal(result.summary.warnings, 4);
    assert.equal(result.summary.errors, 0);
    assert.deepEqual(
      result.issues.map((issue) => issue.rule),
      ["missing-tier", "missing-audience", "missing-stability", "missing-source"]
    );
  });

  it("accepts stable core assets with provenance", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "中文摘要",
        source: adaptedAgentSkillsSourceWithOrigin
      })
    );

    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });

  it("warns when relationship targets do not exist", () => {
    const manifest = makeManifest(
      {
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "中文摘要",
        requires: ["skill:missing"],
        source: adaptedAgentSkillsSourceWithOrigin
      },
      {
        requires: {
          "skill:test": ["skill:missing"]
        }
      }
    );

    const result = lintToolkitManifest(manifest);

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-relationship-target");
  });

  it("warns when core assets have no Chinese summary", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "Write tests before coding and verify behavior with evidence.",
        source: adaptedAgentSkillsSourceWithOrigin
      })
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "missing-chinese-summary");
  });

  it("errors when descriptions exceed the platform discovery budget", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "中".repeat(1025),
        source: adaptedAgentSkillsSourceWithOrigin
      })
    );

    assert.equal(result.summary.errors, 1);
    assert.equal(result.issues[0]?.rule, "description-too-long");
  });

  it("errors when a content body is empty", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          body: "",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.errors, 1);
    assert.equal(result.issues[0]?.rule, "empty-body");
  });

  it("warns when a skill body lacks activation guidance", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          body: "## 执行步骤\n\n1. 做事\n",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "missing-activation-section");
  });

  it("warns when explicit cross-asset references point nowhere", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          id: "skill:router",
          body: "## 何时使用\n\nUse `missing-skill` skill when routing.\n",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-explicit-asset-reference");
  });

  it("warns when route graph targets point nowhere", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          id: "skill:router",
          body: [
            "## 何时使用",
            "",
            "```",
            "Task arrives",
            "  └── Browser-based? ───────────→ missing-skill",
            "```"
          ].join("\n"),
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-explicit-asset-reference");
  });

  it("warns when table cells point to missing assets", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          id: "skill:router",
          body: "## 何时使用\n\n| Phase | Skill |\n| --- | --- |\n| Verify | missing-skill |\n",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-explicit-asset-reference");
  });

  it("accepts known bare asset references in route graphs and tables", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          id: "skill:router",
          body: [
            "## 何时使用",
            "",
            "Task arrives ───────────→ browser-qa-testing",
            "",
            "| Phase | Skill |",
            "| --- | --- |",
            "| Verify | browser-qa-testing |"
          ].join("\n"),
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要 A",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        },
        {
          id: "skill:browser-qa-testing",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要 B",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });

  it("ignores workflow labels and non-asset design tokens", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          body: [
            "## 何时使用",
            "",
            "Use `full-delivery` for the workflow and `workflow-entry` as metadata.",
            "Use `high-risk` as a risk label and `localize` as a task label.",
            "Use `readonly-consult`, `serial-subagent`, `context-fanout`, and `zc-team` as multi-agent mode labels.",
            "Use `feat`, `fix`, `refactor`, `test`, `docs`, and `chore` as commit types.",
            "Use `text-primary`, `bg-surface`, and `border-default` as design tokens."
          ].join("\n"),
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "中文摘要",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });

  it("warns when summaries mix long English fragments into Chinese text", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "先写测试，再按 Red Green Refactor loop 持续推进并验证结果。",
        source: adaptedAgentSkillsSourceWithOrigin
      })
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "mixed-language-summary");
  });

  it("warns when multiple assets share the same normalized summary", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets([
        {
          id: "skill:first",
          meta: {
            tier: "core",
            audience: "default",
            stability: "stable",
            description: "先写测试，再验证结果。",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        },
        {
          id: "command:second",
          meta: {
            kind: "command",
            name: "second",
            title: "second",
            tier: "recommended",
            audience: "default",
            stability: "stable",
            description: " 先写测试，再验证结果。 ",
            source: adaptedAgentSkillsSourceWithOrigin
          }
        }
      ])
    );

    assert.equal(result.summary.warnings, 2);
    assert.deepEqual(
      result.issues.map((issue) => issue.rule),
      ["duplicate-summary", "duplicate-summary"]
    );
  });

  it("warns when requires relationships contain a cycle", () => {
    const result = lintToolkitManifest(
      makeManifestWithAssets(
        [
          {
            id: "skill:a",
            meta: {
              tier: "core",
              audience: "default",
              stability: "stable",
              description: "中文摘要 A",
              requires: ["skill:b"],
              source: adaptedAgentSkillsSourceWithOrigin
            }
          },
          {
            id: "skill:b",
            meta: {
              tier: "core",
              audience: "default",
              stability: "stable",
              description: "中文摘要 B",
              requires: ["skill:a"],
              source: adaptedAgentSkillsSourceWithOrigin
            }
          }
        ],
        {
          requires: {
            "skill:a": ["skill:b"],
            "skill:b": ["skill:a"]
          }
        }
      )
    );

    assert.equal(result.summary.warnings, 2);
    assert.deepEqual(
      result.issues.map((issue) => issue.rule),
      ["relationship-cycle", "relationship-cycle"]
    );
  });

  it("warns when source upstream is not registered", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "recommended",
        audience: "default",
        stability: "stable",
        description: "中文摘要",
        source: {
          ...adaptedAgentSkillsSourceWithOrigin,
          upstream: "unknown-upstream"
        }
      }),
      {
        knownUpstreams: ["agent-skills", "toolkit-original"]
      }
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-source-upstream");
  });

  it("warns when adapted external assets do not keep full origin mapping", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "中文摘要",
        source: {
          ...adaptedAgentSkillsSource
        }
      })
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "missing-origin-mapping");
  });

  it("warns when origin mapping is only partially filled", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "recommended",
        audience: "default",
        stability: "stable",
        description: "中文摘要",
        source: {
          upstream: "agent-skills",
          strategy: "adapted",
          originName: "test-driven-development"
        }
      })
    );

    assert.equal(result.summary.warnings, 2);
    assert.deepEqual(
      result.issues.map((issue) => issue.rule),
      ["partial-origin-mapping", "missing-origin-mapping"]
    );
  });

  it("accepts inspired external assets when notes explain the absorption boundary", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "recommended",
        audience: "advanced",
        stability: "stable",
        description: "中文摘要",
        source: {
          upstream: "superpowers",
          strategy: "inspired",
          notes: "吸收方法学思路，不做一比一对象映射。"
        }
      })
    );

    assert.equal(result.summary.warnings, 0);
    assert.equal(result.summary.errors, 0);
  });

  it("warns when inspired external assets omit source notes", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "recommended",
        audience: "advanced",
        stability: "stable",
        description: "中文摘要",
        source: {
          upstream: "superpowers",
          strategy: "inspired"
        }
      })
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "missing-source-notes");
  });
});
