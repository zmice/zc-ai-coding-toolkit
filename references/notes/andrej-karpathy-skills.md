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
