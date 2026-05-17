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

- remote head: `f2cbfbefebbfef77321e4c9abc9e949826bea9d7`
- observed date: 2026-05-15
- notable upstream change: v5.1.0 refreshes worktree guidance, code-reviewer prompt material, Codex / OpenCode plugin sync surfaces, and release notes. The most relevant delta is still worktree lifecycle clarity and explicit transcript-style verification.

## Extractable Upgrades

- Worktree setup should select `.worktrees/` before `worktrees/`, then verify project-local directories are ignored.
- Parallel dispatch should require explicit task independence, file ownership, and fan-in verification.
- Shutdown is not branch closure; branch/worktree ownership must be resolved separately.
- Worktree cleanup text must not imply that deleting a worktree is always lossless; inspect status and decide merge / keep / discard first.
- New-harness or multi-worker work should leave an acceptance transcript: task ownership, changed files, evidence, conflicts, and cleanup state.

## Non-Adoption Boundary

- Do not copy Superpowers commands wholesale.
- Do not create hidden worktrees without proving ignore safety.

## Recommended Phase

- Phase 1: `zc team plan`, worktree safety checks, fan-in status output, and safer worktree cleanup wording in toolkit content.
- Phase 2: richer subagent review prompts after the team runtime is stable.
