# Everything Claude Code

Source: `https://github.com/affaan-m/everything-claude-code`

## Status

Registered from historical upstream tracking. Initial baseline snapshot captured in the new governance layer.

## Historical Role

- Commit history previously tracked it as an architecture and cautionary reference.
- It informed instinct architecture ideas and also highlighted agent sprawl risks.

## Expected Downstream Value

- Context / instinct design references
- Governance lessons about prompt and agent bloat
- Command and instruction organization ideas

## Boundaries

- Prefer extracting principles and anti-patterns rather than importing structure wholesale.

## Snapshot Baseline

- baseline: `references/snapshots/everything-claude-code/2026-04-18T18-02-14-443Z-2026-04-19-baseline.json`
- current governance status: `active`

## Latest Reviewed Upstream

- remote head: `4e66b2882da9afb9747468b08a253ca2f09c85f3`
- observed date: 2026-04-29
- notable upstream change: no HEAD change since the 2026-04-27 review; Codex reference config, custom agent role registration, add-only config merge scripts, and Codex sync tooling remain the current absorbable delta

## Extractable Upgrades

- Codex custom agents should be registered through `[agents.*] config_file` rather than only writing agent TOML files.
- User-level `config.toml` updates should use add-only merge semantics and preserve existing user choices.
- Dry-run / backup / sanity-check patterns are useful for global Codex setup.

## Non-Adoption Boundary

- Do not import ECC's large prompt catalog, hooks runtime, MCP defaults, telemetry, or broad language rule packs by default.
- Keep `zc` user-level config writes conflict-safe until add-only merge is implemented.

## Recommended Phase

- Phase 1: generate agent registration config and document conflict-safe behavior.
- Phase 2: implement add-only Codex config merge for global installs.
