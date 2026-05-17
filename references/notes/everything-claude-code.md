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

- remote head: `3539bdbef682ab3884146a6f52aa6eab712b0626`
- observed date: 2026-05-18
- notable upstream change: upstream added Zed install support, preview-pack smoke/readiness gates, supply-chain watch/advisory refresh work, operator readiness dashboards, continued command registry / hook hardening, and a late rc1 launch-readiness copy refresh.

## Extractable Upgrades

- Codex custom agents should be registered through `[agents.*] config_file` rather than only writing agent TOML files.
- User-level `config.toml` updates should use add-only merge semantics and preserve existing user choices.
- Dry-run / backup / sanity-check patterns are useful for global Codex setup.
- Command registry coverage is a useful future validation idea for `toolkit lint`, but should be designed against this repo's manifest model rather than copied.
- Supply-chain IOC scanning belongs in release/security automation only after threat model and maintenance ownership are clear.
- Preview-pack smoke gates and operator readiness dashboards are useful references for a later `release:check` / platform install readiness phase, not for the current content-only sync.

## Non-Adoption Boundary

- Do not import ECC's large prompt catalog, hooks runtime, MCP defaults, telemetry, or broad language rule packs by default.
- Keep `zc` user-level config writes conflict-safe until add-only merge is implemented.
- Do not import Ruby/Rails or Copilot prompt packs unless this toolkit adds explicit platform/rule-pack scope for them.
- Do not add Zed as a platform target until `packages/platform-*` has a scoped adapter design and tests.

## Recommended Phase

- Phase 1: generate agent registration config and document conflict-safe behavior.
- Phase 2: implement add-only Codex config merge for global installs.
- Phase 3: evaluate Zed/platform readiness and release smoke dashboards after manifest-aware lint coverage has settled.
