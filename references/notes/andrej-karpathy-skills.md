# Andrej Karpathy Skills

Source: `https://github.com/multica-ai/andrej-karpathy-skills`

## Status

Registered for manual review. No local snapshot captured yet.

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

## Next Step

- Capture the first immutable snapshot under `references/snapshots/andrej-karpathy-skills/`
- Run `zc upstream diff andrej-karpathy-skills` after the first baseline is available
