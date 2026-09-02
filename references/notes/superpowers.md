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

## Latest Remote Evidence

- remote head: `896224c4b1879920ab573417e68fd51d2ccc9072`
- observed date: 2026-06-29
- evidence: `pnpm upstream -- report superpowers --format json --with-remote`
- finding: previous `source_paths` (`prompts`, `instructions`, `agents`) missed all registered-path changes while upstream had 130 changed paths.
- registry update: track current useful surfaces including `skills`, `docs`, `hooks`, `scripts`, `tests`, `.claude-plugin`, `.codex-plugin`, `.opencode`, `README.md`, `CLAUDE.md`, release notes, and `package.json`.

## Latest Remote Evidence 2026-07-02

- remote head: `f268f7c953744036f0fa7e9d4b73535c04e57cb8`
- evidence: `pnpm upstream -- report all --format md --with-remote`
- finding: registered paths changed in 122 files. The most relevant deltas are `writing-skills` guidance, new-harness portability docs, Codex plugin sync surface, and subagent-driven development review package / task brief mechanics.

## Extractable Upgrades

- Worktree setup should select `.worktrees/` before `worktrees/`, then verify project-local directories are ignored.
- Parallel dispatch should require explicit task independence, file ownership, and fan-in verification.
- Shutdown is not branch closure; branch/worktree ownership must be resolved separately.
- Worktree cleanup text must not imply that deleting a worktree is always lossless; inspect status and decide merge / keep / discard first.
- New-harness or multi-worker work should leave an acceptance transcript: task ownership, changed files, evidence, conflicts, and cleanup state.
- Skill authoring should treat guidance as behavior-shaping assets: classify the baseline failure first, choose the guidance form that fits, micro-test wording against no-guidance controls, and avoid workflow summaries in discovery descriptions.
- Cross-harness support should keep skill bodies action-oriented and platform-neutral; platform adapters provide tool mapping and bootstrap/install delivery.
- Subagent review can reduce context and cost by handing task briefs, reports, review packages, and progress ledgers as files instead of pasting accumulated history into prompts.

## Non-Adoption Boundary

- Do not copy Superpowers commands wholesale.
- Do not create hidden worktrees without proving ignore safety.
- Do not import Superpowers scripts or prompts directly; convert the durable mechanics into this repo's `zc agent plan` controller model and toolkit content.

## Recommended Phase

- Phase 1: `zc team plan`, worktree safety checks, fan-in status output, and safer worktree cleanup wording in toolkit content.
- Phase 2: richer subagent review prompts after the team runtime is stable.

## Latest Remote Evidence 2026-07-29

- remote head: `44c9b2d6e889982ac18c27d05a19fefe335194e1`
- evidence: `pnpm upstream -- report all --format json --with-remote` plus shallow-clone content review
- finding: upstream added plan-scoped scratch workspaces, resumable fix loops, scoped re-review, a circuit breaker, and a positive guide for falsifiable tests
- finding: Codex packaging now declares an explicit empty hook surface when hooks should not be auto-discovered

## Absorbed 2026-07-29

- Compress `subagent-driven-development` around a controller-owned, plan-scoped ledger and file-based handoffs.
- Resume the original producer only when the next round changes its input; after the local loop budget, adjudicate rather than retry forever.
- Add a high-signal test reference that requires independently derived expectations, observable behavior, and a mutation check.

## Retained Local Boundary 2026-07-29

- Keep the local default at two fix rounds instead of copying the upstream five-round loop.
- Do not copy `.superpowers/` paths, scripts, model names, or prompt templates.
- Preserve platform-neutral role contracts and let each adapter map them to available agent tools.

## Review Update 2026-09-01

- remote head: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`
- useful classification: distinguish spike, bounded and architectural work, and only upgrade the design gate when hidden complexity changes the route
- local adaptation: clear, local and reversible tasks may proceed under existing authorization; universal 2-3-option and approval gates are not adopted
- worktree cleanup remains fail-closed: when removal is refused, inspect complete status and present commit/move/delete choices; never force removal by default
- do not copy the upstream five-round fix loop, controller-overrides-user rulings, platform-specific model settings or adapter prose
