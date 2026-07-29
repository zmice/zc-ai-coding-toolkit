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

## Latest Remote Evidence

- remote head: `81af40761939056ab3dc54732fd4f562a27309d0`
- observed date: 2026-07-02
- evidence: `pnpm upstream -- report all --format md --with-remote`
- finding: upstream now carries a large `.agents/skills/` AI asset surface plus changed `README.md`, `commands/*`, and docs. Previous registry paths (`CLAUDE.md`, `docs`, `commands`) missed this AI asset directory and left it as unregistered churn.
- registry update: track `README.md`, `AGENTS.md`, `agents`, `skills`, `.agents/plugins/marketplace.json`, and `.agents/skills` in addition to existing `CLAUDE.md`, `docs`, and `commands`.

## Extractable Upgrades

- Codex custom agents should be registered through `[agents.*] config_file` rather than only writing agent TOML files.
- User-level `config.toml` updates should use add-only merge semantics and preserve existing user choices.
- Dry-run / backup / sanity-check patterns are useful for global Codex setup.
- Command registry coverage is a useful future validation idea for `toolkit lint`, but should be designed against this repo's manifest model rather than copied.
- Supply-chain IOC scanning belongs in release/security automation only after threat model and maintenance ownership are clear.
- Preview-pack smoke gates and operator readiness dashboards are useful references for a later `release:check` / platform install readiness phase, not for the current content-only sync.
- Newly visible `.agents/skills/` content is useful as source material for AI asset governance and discovery audits, especially benchmark methodology, brand/content, competitive analysis, and TDD workflow assets.

## Non-Adoption Boundary

- Do not import ECC's large prompt catalog, hooks runtime, MCP defaults, telemetry, or broad language rule packs by default.
- Keep `zc` user-level config writes conflict-safe until add-only merge is implemented.
- Do not import Ruby/Rails or Copilot prompt packs unless this toolkit adds explicit platform/rule-pack scope for them.
- Do not add Zed as a platform target until `packages/platform-*` has a scoped adapter design and tests.
- Do not import ECC's `.agents/skills`, top-level `skills`, `agents`, or rule packs wholesale; use them as review inputs and extract only durable, toolkit-shaped heuristics.

## Recommended Phase

- Phase 1: generate agent registration config and document conflict-safe behavior.
- Phase 2: implement add-only Codex config merge for global installs.
- Phase 3: evaluate Zed/platform readiness and release smoke dashboards after manifest-aware lint coverage has settled.

## Latest Remote Evidence 2026-07-29

- remote head: `591ab5cbd3f2f65860ea91c226e410b1502c8e2e`
- evidence: remote HEAD lookup followed by an independent shallow clone after the governance report's temporary content-fetch failure
- finding: the repository continues to broaden cross-platform adapters, agents, skills, hooks, and operator surfaces at a scale that would duplicate this toolkit

## Current Decision

- Keep it as a breadth and supply-chain reference.
- Do not absorb new runtime, prompt packs, hooks, or language catalogs in this cycle.
- Continue using it to test whether this workspace's registry, install receipts, and platform boundaries remain understandable under large-asset pressure.
