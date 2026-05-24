# Codex Multi-Agent Execution Plan

## Goal

Make multi-agent help easier to trigger in zc toolkit content, with Codex as the primary target.

The change should make read-only agent assistance appear earlier and more often, while allowing bounded low-risk write fan-out after an accepted plan, and preserving explicit confirmation for `zc team`.

## Evidence

- `pnpm upstream -- report all --format md --with-remote` showed no registered upstream drift on 2026-05-23.
- `references/notes/agent-skills.md` says trigger clarity, skill anatomy, on-demand loading, and accurate local skill names should be absorbed.
- `references/notes/superpowers.md` says parallel dispatch needs explicit task independence, file ownership, fan-in verification, worktree safety, and acceptance transcripts.
- `references/notes/gstack.md` says route-changing findings should become stop gates and implementation tasks.
- `references/notes/everything-claude-code.md` says Codex custom agents should use `[agents.*] config_file`, but broad hook runtimes and prompt catalogs should not be imported by default.

## Scope

In scope:

- Toolkit content wording and execution policy.
- Codex-first multi-agent routing semantics.
- Read-only agent trigger threshold.
- Fan-out, fan-in, review, regression, and worktree safety rules.

Out of scope:

- CLI runtime changes.
- New hooks.
- New platform surfaces.
- Automatic `zc team start`.
- Importing upstream prompt catalogs wholesale.

## Target Execution Contract

Use this plan as the implementation source for a later target-mode build.

- Keep edits narrow and content-only unless a test reveals schema or lint breakage.
- Prefer existing terminology: `agent_opportunity`, `readonly-consult`, `serial-subagent`, `context-fanout`, `zc-team`.
- Preserve current safety line with one relaxation: read-only can be notification-style when already authorized; low-risk write fan-out can be notification-style after an accepted plan defines ownership and fan-in; `zc team` still requires explicit confirmation.
- Do not loosen file ownership requirements for write agents.
- Do not imply `zc team` is the default implementation mode.

## Decision Log

Recommendation: make read-only multi-agent assistance easier to trigger because it improves review, planning, and risk discovery without touching files.

- Chosen: lower the threshold for `readonly-consult` and make `agent_opportunity` more common.
- Rejected alternative: automatically start write fan-out for complex tasks without accepted ownership and fan-in boundaries.
- Evidence: upstream notes favor clear triggers and fan-in discipline; current local content already has safety boundaries.
- Cost / risk: more frequent suggestions may add noise.
- Verification gate: content lint passes and examples preserve explicit confirmation for high-risk write fan-out and `zc team`.

Recommendation: absorb upstream multi-agent practices as local policy, not copied prompts.

- Chosen: rewrite local skill content in zc vocabulary.
- Rejected alternative: mirror upstream commands or prompt catalogs.
- Evidence: all upstream notes explicitly mark these projects as references, not direct source trees.
- Cost / risk: wording must stay consistent across several skills.
- Verification gate: explicit asset references remain valid under `toolkit lint`.

## Agent Opportunity

Recommended implementation mode:

```text
agent_opportunity:
- mode: serial-subagent
- trigger: five content files can be edited independently but must remain semantically consistent
- recommended agents/workers: primary implementer plus optional read-only code-reviewer after patch
- ownership: one implementer edits content; reviewer checks consistency and missing tests
- confirmation: no write fan-out needed
- fan-in gate: final diff review, toolkit lint, package test, git diff --check
```

Do not use `zc-team` for this implementation unless the scope expands into CLI runtime or platform generation code.

## Implementation Tasks

- [x] T1 (P1) - `start` - Lower multi-agent opportunity threshold
  - Source finding: user wants multi agent to be easier to trigger; `agent-skills` emphasizes clear activation metadata.
  - Files likely touched: `packages/toolkit/src/content/commands/start/body.md`
  - Acceptance criteria: `agent_opportunity` is expected for more than high-risk work; read-only consult is recommended for review, optimization, upstream absorption, Codex adaptation, install/update, and cross-surface verification tasks.
  - Verification: `toolkit lint --json` reports no content reference errors.
  - Dependencies: none.

- [x] T2 (P1) - Planning - Make agent opportunity an execution decision
  - Source finding: `gstack` notes say review findings and route changes should become stop gates or implementation tasks.
  - Files likely touched: `packages/toolkit/src/content/skills/planning-and-task-breakdown/body.md`
  - Acceptance criteria: plans must classify multi-agent mode, list matching Codex agents, state confirmation boundary, and produce fan-in gates before implementation.
  - Verification: inspect generated wording for `readonly-consult`, `context-fanout`, and `zc-team` safety distinctions.
  - Dependencies: T1.

- [x] T3 (P1) - Full delivery - Prefer read-only consult before heavier parallelism
  - Source finding: user wants easier multi-agent triggering, and later allowed bounded low-risk write fan-out to be relaxed after an accepted plan.
  - Files likely touched: `packages/toolkit/src/content/skills/sdd-tdd-workflow/body.md`
  - Acceptance criteria: build-mode selection explicitly says read-only consult should be considered early for complex tasks; low-risk write fan-out can use accepted-plan preauthorization; high-risk write fan-out remains gated by explicit confirmation, file ownership, and fan-in verification.
  - Verification: `toolkit lint --json` and manual diff review.
  - Dependencies: T1.

- [x] T4 (P1) - Parallel dispatch - Strengthen read-only first and fan-in transcript rules
  - Source finding: `superpowers` notes emphasize task independence, file ownership, fan-in verification, and acceptance transcripts.
  - Files likely touched: `packages/toolkit/src/content/skills/parallel-agent-dispatch/body.md`
  - Acceptance criteria: read-only fan-out is positioned as the low-risk first step; write fan-out requires ownership and verification, with accepted-plan preauthorization allowed for low-risk bounded work; transcript captures task ownership, changed files, evidence, conflicts, findings, fixes, regression, and follow-up.
  - Verification: content lint plus manual check that no wording permits unbounded or high-risk unconfirmed write fan-out.
  - Dependencies: T2.

- [x] T5 (P2) - Subagent flow - Clarify producer/reviewer/controller responsibilities
  - Source finding: previous project policy and upstream review patterns require `producer owns fix`, `reviewer owns regression`, `controller owns fan-in`.
  - Files likely touched: `packages/toolkit/src/content/skills/subagent-driven-development/body.md`
  - Acceptance criteria: serial subagent workflow explains when to use Codex custom agents, how findings return to the producer, and how reviewers provide regression evidence.
  - Verification: manual consistency review with T4 wording.
  - Dependencies: T2.

- [x] T6 (P2) - Team orchestration - Keep `zc team` as explicit heavy mode
  - Source finding: `superpowers` notes warn that shutdown is not branch closure and worktree cleanup must inspect status first.
  - Files likely touched: `packages/toolkit/src/content/skills/team-orchestration/body.md`
  - Acceptance criteria: `zc team` remains opt-in; `.worktrees/` ignore check stays mandatory; shutdown plan is described as fan-in evidence, not permission to delete dirty worktrees.
  - Verification: manual check against `zc team plan` examples and existing safety wording.
  - Dependencies: T4.

- [x] T7 (P2) - Cross-content consistency - Align examples and terminology
  - Source finding: multi-agent terminology is repeated across several skills.
  - Files likely touched: same files as T1-T6.
  - Acceptance criteria: all touched content uses the same mode names, confirmation words, and fan-in ownership language.
  - Verification: `rg -n "readonly-consult|context-fanout|zc-team|producer owns fix|reviewer owns regression|controller owns fan-in" packages/toolkit/src/content`.
  - Dependencies: T1-T6.

- [x] T8 (P1) - Verification - Prove content remains valid
  - Source finding: repository requires evidence before completion.
  - Files likely touched: none expected.
  - Acceptance criteria: validation commands complete successfully or failures are explained with exact scope.
  - Verification:
    - `node apps/cli/dist/cli/index.js toolkit lint --json`
    - `pnpm --dir packages/toolkit test`
    - `git diff --check`
  - Dependencies: T1-T7.

## Stop Gates

- STOP: implementation discovers that content lint requires schema changes.
  - Impact: task is no longer content-only.
  - Required decision: either add schema/test work to scope or keep changes within existing fields.

- STOP: wording would imply unbounded write fan-out, high-risk unconfirmed write fan-out, or automatic `zc team start`.
  - Impact: violates current safety boundary.
  - Required decision: rewrite to accepted-plan preauthorization or explicit-confirmation wording.

- STOP: Codex-specific terms conflict with Qwen / Claude / OpenCode platform wording.
  - Impact: could break platform-neutral toolkit content.
  - Required decision: phrase Codex as primary path but keep generic mode names.

## Fan-In Gate

Before claiming done:

- Review every touched content file for consistent trigger threshold and safety wording.
- Confirm no task suggests write agents can modify shared files without file ownership or accepted-plan preauthorization.
- Confirm `zc team` remains opt-in and dry-run first.
- Run the three verification commands in T8.
- Summarize changes by behavior, not just file names.
