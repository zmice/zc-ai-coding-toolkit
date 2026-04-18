import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { lintToolkitManifest } from "./lint/content-lint.js";
import type { ToolkitManifest } from "./types.js";

function makeManifest(
  overrides: Partial<ToolkitManifest["assets"][number]["meta"]>,
  relationships?: Partial<ToolkitManifest["byRelationship"]>
): ToolkitManifest {
  return {
    version: 1,
    generatedAt: "2026-04-19T00:00:00.000Z",
    contentRoot: "/tmp/toolkit",
    counts: {
      skills: 1,
      commands: 0,
      agents: 0,
      total: 1
    },
    assets: [
      {
        id: "skill:test",
        meta: {
          kind: "skill",
          name: "test",
          title: "test",
          description: "test asset",
          ...overrides
        },
        body: "body",
        attachments: [],
        source: {
          directory: "/tmp/toolkit/skills/test",
          meta: "/tmp/toolkit/skills/test/meta.yaml",
          body: "/tmp/toolkit/skills/test/body.md",
          assets: "/tmp/toolkit/skills/test/assets"
        }
      }
    ],
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
});
