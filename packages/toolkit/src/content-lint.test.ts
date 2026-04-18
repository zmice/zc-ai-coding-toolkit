import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { lintToolkitManifest } from "./lint/content-lint.js";
import type { ToolkitManifest } from "./types.js";

interface ManifestAssetInput {
  id?: string;
  meta?: Partial<ToolkitManifest["assets"][number]["meta"]>;
  body?: string;
}

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
      body: asset.body ?? "body",
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
        source: {
          upstream: "agent-skills",
          strategy: "adapted"
        }
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
        source: {
          upstream: "agent-skills",
          strategy: "adapted"
        }
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
        source: {
          upstream: "agent-skills",
          strategy: "adapted"
        }
      })
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "missing-chinese-summary");
  });

  it("warns when summaries mix long English fragments into Chinese text", () => {
    const result = lintToolkitManifest(
      makeManifest({
        tier: "core",
        audience: "default",
        stability: "stable",
        description: "先写测试，再按 Red Green Refactor loop 持续推进并验证结果。",
        source: {
          upstream: "agent-skills",
          strategy: "adapted"
        }
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
            source: {
              upstream: "agent-skills",
              strategy: "adapted"
            }
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
            source: {
              upstream: "agent-skills",
              strategy: "adapted"
            }
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
              source: {
                upstream: "agent-skills",
                strategy: "adapted"
              }
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
              source: {
                upstream: "agent-skills",
                strategy: "adapted"
              }
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
          upstream: "unknown-upstream",
          strategy: "adapted"
        }
      }),
      {
        knownUpstreams: ["agent-skills", "toolkit-original"]
      }
    );

    assert.equal(result.summary.warnings, 1);
    assert.equal(result.issues[0]?.rule, "unknown-source-upstream");
  });
});
