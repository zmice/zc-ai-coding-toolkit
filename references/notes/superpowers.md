# Superpowers

Source: `https://github.com/obra/superpowers`

## Status

Registered from historical upstream tracking. Initial baseline snapshot captured in the new governance layer.

## Historical Role

- Commit history previously tracked it as an architecture reference.
- It influenced review strategy, role decomposition, and "role as skill" thinking.

## Expected Downstream Value

- Review workflow patterns
- Role boundary design
- Multi-agent execution heuristics

## Boundaries

- Treat it as an architecture reference, not as a direct content source to mirror.

## Snapshot Baseline

- baseline: `references/snapshots/superpowers/2026-04-18T18-02-14-443Z-2026-04-19-baseline.json`
- current governance status: `active`

## Latest Reviewed Upstream

- remote head: `6efe32c9e2dd002d0c394e861e0529675d1ab32e`
- observed date: 2026-04-29
- notable upstream change: no HEAD change since the 2026-04-27 review; committed Codex plugin sync files and explicit worktree / parallel-agent workflow guidance remain the current absorbable delta

## Extractable Upgrades

- Worktree setup should select `.worktrees/` before `worktrees/`, then verify project-local directories are ignored.
- Parallel dispatch should require explicit task independence, file ownership, and fan-in verification.
- Shutdown is not branch closure; branch/worktree ownership must be resolved separately.

## Non-Adoption Boundary

- Do not copy Superpowers commands wholesale.
- Do not create hidden worktrees without proving ignore safety.

## Recommended Phase

- Phase 1: `zc team plan`, worktree safety checks, and fan-in status output.
- Phase 2: richer subagent review prompts after the team runtime is stable.
