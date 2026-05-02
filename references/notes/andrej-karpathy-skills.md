# Andrej Karpathy Skills

Source: `https://github.com/multica-ai/andrej-karpathy-skills`

## Status

Registered for manual review. Initial baseline snapshot captured in the governance layer.

## Why Track It

- It packages a compact set of agent-behavior guidelines derived from Andrej Karpathy's public observations on LLM coding failure modes.
- It is relevant to `toolkit` governance because it overlaps with our existing interests in:
  - explicit assumptions
  - simplicity-first implementation
  - surgical changes
  - goal-driven execution

## Observed Surface

Current repo surface observed at registration time:

- `CLAUDE.md`
- `README.md`
- `EXAMPLES.md`
- `skills/karpathy-guidelines`

## Expected Downstream Value

- Compare its "single-file guidance" style with our structured `toolkit` content model.
- Evaluate whether any principles should be absorbed as:
  - `toolkit` metadata conventions
  - command/skill wording improvements
  - platform-specific guidance excerpts

## Boundaries

- Do not copy content directly into `packages/toolkit` without manual review.
- Prefer extracting reusable principles instead of mirroring repository structure.
- Use snapshots and diff reports before any adoption decision.

## Snapshot Baseline

- baseline: `references/snapshots/andrej-karpathy-skills/2026-04-18T18-02-14-443Z-2026-04-19-baseline.json`
- current governance status: `active`

## Next Step

- Run `pnpm upstream -- diff andrej-karpathy-skills` against the baseline
- Continue extracting reusable principles instead of mirroring upstream structure

## Latest Reviewed Upstream

- remote head: `2c606141936f1eeef17fa3043a72095b4765b9c2`
- observed date: 2026-04-29
- notable upstream change: no HEAD change since the 2026-04-27 review; Chinese README sync and continued cross-editor packaging guidance remain the current absorbable delta

## Extractable Upgrades

- Existing `engineering-principles` already covers the core: assumptions, simplicity, surgical changes, and verification.
- The main useful delta is wording pressure: force unclear assumptions into explicit questions before implementation.
- Goal-driven execution should remain tied to concrete verification commands.

## Non-Adoption Boundary

- Do not add a duplicate Karpathy-specific skill.
- Do not copy the CLAUDE.md wholesale; keep the principles integrated into existing zc workflow language.

## Recommended Phase

- Phase 1: minor wording alignment in existing principles if needed.
- No separate content asset unless future review finds a non-overlapping workflow.
