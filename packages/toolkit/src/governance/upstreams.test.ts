import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  extractKnownUpstreamIds,
  loadKnownUpstreamIds
} from "./upstreams.js";

describe("upstream governance helpers", () => {
  it("extracts upstream ids from the registry and keeps internal sources", () => {
    const ids = extractKnownUpstreamIds(`
schema_version: 1
upstreams:
  - id: agent-skills
    title: Agent Skills
  - id: superpowers
    title: Superpowers
`);

    assert.deepEqual([...ids].sort(), ["agent-skills", "superpowers", "toolkit-original"]);
  });

  it("loads the workspace upstream registry", async () => {
    const ids = await loadKnownUpstreamIds();

    assert.ok(ids.includes("agent-skills"));
    assert.ok(ids.includes("andrej-karpathy-skills"));
    assert.ok(ids.includes("toolkit-original"));
  });
});
