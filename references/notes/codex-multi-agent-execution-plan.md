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
- Codex custom-agent scalar configuration and OS temporary worktree lifecycle.

Out of scope:

- Emulating host-injected thread lifecycle in the standalone CLI.
- New hooks.
- New platform surfaces.
- Automatic `zc team start`.
- Silent top-level `[agents]` config mutation.
- Nested `mcp_servers` / `skills.config` rendering in the first implementation slice.
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

## 2026-08-17 Alignment Review

The T1-T8 checklist above describes the delivered first phase: easier opportunity detection, safer role selection, ownership, bounded loops, and fan-in discipline. It does not describe full alignment with the current Codex subagent runtime.

### Current Evidence

- `pnpm upstream -- report all --format md --with-remote` refreshed all 12 registered upstreams on 2026-08-17.
- `openai/plugins` remains at `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`, but OpenAI archived it on 2026-08-16. It is now a historical plugin-layout reference.
- current Codex Subagents documentation says subagent workflows are enabled by default and can be triggered by direct requests or applicable `AGENTS.md` / skill instructions.
- the documented runtime owns spawning, follow-up routing, waiting, steering, interruption, thread visibility, and closure.
- standalone custom-agent TOML can set `model`, `model_reasoning_effort`, `sandbox_mode`, `mcp_servers`, and `skills.config`.
- `[agents]` supports `enabled`, `max_concurrent_threads_per_session`, default subagent model / reasoning effort, and `interrupt_message`.
- local verification used `codex-cli 0.146.0`: `multi_agent` reports `stable=true`; `multi_agent_v2` is present but `stable=false`. The current Desktop host nevertheless exposes the newer collaboration lifecycle. Internal feature labels must not be treated as the public stability contract.

### Project Alignment Status

| Area | Status | Current Project State | Gap |
|---|---|---|---|
| Role catalog | aligned | nine `zc_*` roles exist; canonical metadata and standalone/companion TOML carry model, reasoning effort and sandbox defaults | nested MCP/skills configuration and runtime compatibility smoke remain |
| Distribution | aligned with explicit config bridge | Git marketplace plugin, commands, skills, Markdown agents, companion manifest, receipt and lifecycle checks exist | Markdown-agent discovery and standalone TOML effective-config smoke remain distinct runtime checks |
| Trigger policy | aligned at policy layer | `dispatch_now`, native lifecycle mapping, direct read-only dispatch and runtime-capacity fan-out exist | automated host behavioral smoke is still missing |
| Safety and fan-in | aligned at policy level | file ownership, loop budget, runtime state vocabulary, interruption handling and controller-owned fan-in gates exist | standalone controller artifacts do not ingest host thread state automatically; runtime smoke remains |
| Controller artifacts | aligned with native boundary | `zc agent plan` is optional for write-heavy, resumable or audited runs and does not spawn workers | persistent host transcript ingestion remains open |
| Thread lifecycle | aligned at policy layer | spawn, follow-up, message injection, wait, list, interrupt, terminal states and fallback are mapped | runtime eval and persistent thread transcript remain |
| Context fork | aligned at policy layer | `none` / recent-N / full-history selection follows minimum sufficient context | host smoke must prove supported fork values |
| Agent reuse | aligned at policy layer | independent task starts fresh; same-task clarification, rework and regression resume the owning thread | behavioral eval remains |
| Concurrency | aligned at policy layer | fixed counts were replaced by live available-slot batching with controller capacity preserved | top-level `[agents]` config remains user-owned |
| Model and permissions | partially aligned | nine roles render model, effort and sandbox into standalone/companion TOML; plugin Markdown intentionally omits these unsupported session fields | nested MCP/skills config, effective-model smoke, approval-failure smoke and live override verification remain |
| Temporary worktree | implemented | Codex-only OS temp lease, dirty-source acknowledgement, receipt ownership, non-force cleanup, TOCTOU guard, stale-lock recovery and receipt-driven recover/finalize are covered by tests | host worker workdir smoke remains |
| Nested delegation | aligned at policy level | one extra layer, live-capacity use, ownership narrowing, shared budget and parent/global fan-in are explicit | host nested-dispatch smoke remains |
| Verification | package-level only | generation, companion and CLI tests validate artifacts | no runtime smoke for spawn, reuse, steer, interrupt, nested delegation or approval failure |

### Upgrade Decision

Native Multi-agent V2 alignment is the next Codex platform priority. Keep the existing safety rules, role catalog, companion rollback path, and `zc agent plan`; replace the assumption that every Codex multi-agent run starts from dry-run artifacts.

The architecture boundary is:

- toolkit canonical content defines platform-neutral opportunity, ownership, budget, safety, and fan-in semantics
- a Codex-specific reference maps those semantics to host-provided collaboration tools and thread states
- `packages/platform-codex` generates supported custom-agent configuration and plugin artifacts
- `zc agent plan` remains an optional plan/artifact generator for write-heavy, resumable, or audited work
- the standalone Node CLI does not emulate host-injected agent lifecycle tools

### Upgrade Backlog

- [x] V2-01 (P0) - Add a Codex-native lifecycle reference covering spawn, list/status, wait, context injection, follow-up, steering/interruption, reuse, closure boundary, fallback, and fan-in.
  - likely surfaces: `parallel-agent-dispatch`, `subagent-driven-development`, `start`, planning and full-delivery workflows
  - acceptance: `dispatch_now: yes` maps to a real host action when available and records the actual result state

- [x] V2-02 (P0) - Remove stale mandatory `zc agent plan` wording for ordinary read-only fan-out.
  - acceptance: native read-only consult can dispatch directly; write-heavy or resumable work can still choose controller artifacts

- [x] V2-03 (P0) - Replace fixed agent-count assumptions with runtime-capacity policy.
  - acceptance: the controller honors current session limits, accounts for already-open threads, and explains serial degradation

- [x] V2-04 (P1) - Define thread identity, reuse, and bounded rework semantics.
  - acceptance: independent task starts fresh; same-task clarification or fix resumes the owning thread; message injection does not accidentally start a new turn

- [x] V2-05 (P1) - Define context-fork policy.
  - acceptance: read-heavy explorers receive minimal context by default; reviewers and fix owners receive only the required recent history or task package; full history requires justification

- [ ] V2-06 (P1) - Extend agent metadata and Codex rendering for supported role configuration.
  - likely surfaces: toolkit schema/types, agent `meta.yaml`, `packages/platform-codex`, generation and companion tests
  - acceptance: model, reasoning effort, sandbox, MCP and skills overrides follow documented precedence without inventing unsupported TOML keys
  - status: scalar model / reasoning / sandbox support is complete; nested MCP and skills config remains open

- [ ] V2-07 (P1) - Add runtime thread state to controller fan-in.
  - acceptance: missing, running, completed, interrupted, failed and blocked agent outcomes are distinguishable; partial success is preserved

- [ ] V2-08 (P1) - Add permission and approval failure rules.
  - acceptance: live parent permission overrides win; read-only roles stay constrained; non-interactive approval failures return to the controller instead of being reported as worker completion

- [x] V2-09 (P2) - Bound nested delegation.
  - acceptance: maximum depth, child concurrency, ownership inheritance, token/loop budget and parent fan-in are explicit

- [ ] V2-10 (P1) - Add end-to-end Codex smoke and behavioral evals.
  - acceptance: cover named-role spawn, status visibility, follow-up reuse, message injection, interruption, context-fork choice, nested child dispatch, permission inheritance, approval failure, and write-conflict rejection

- [ ] V2-11 (P2) - Update user-facing CLI/platform documentation after behavior is implemented.
  - acceptance: README, usage guide, capability matrix, upgrade/rollback notes and release checklist describe verified behavior only

- [x] V2-12 (P1) - Add Codex-only OS temporary worktree leases.
  - acceptance: default dry-run, exact receipt ownership, no repo / `$CODEX_HOME/worktrees` placement, dirty-source acknowledgement, non-force cleanup, dirty/TOCTOU gates, automatic removal of unnecessary dirs/branches, stale-lock recovery, recovery anchors for unmerged commits and receipt-driven finalize after merge

### Implementation Stop Gates

- STOP if a tool-level field is available only in the current Desktop host but not documented or reproducible in the supported Codex release; keep it in the Codex-specific reference and mark it evolving.
- STOP if adding role configuration would serialize unsupported keys into standalone TOML or plugin Markdown.
- STOP if plugin-agent discovery cannot be proven after install/upgrade; retain the companion path and report the runtime gap.
- STOP if parallel writes cannot establish non-overlapping ownership and a fresh fan-in verification command.
- STOP if the implementation would make the standalone `zc` CLI responsible for a host-owned thread lifecycle.
