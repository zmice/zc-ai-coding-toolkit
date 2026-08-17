# Codex Multi-Agent Controller

## Goal

Multi-agent work should trigger from task shape, not from a vague prompt hint.

The controller must decide whether parallel agents are useful, create isolated task briefs, collect reports, and own fan-in. A worker agent should not decide the final merge or silently edit outside its ownership.

## Trigger Model

`agent_opportunity.dispatch_now` remains a signal, not the whole system.

Dispatch is allowed only when all are true:

- tasks are independent enough to run in parallel
- each worker has clear file ownership or read-only scope
- the platform has a real agent runtime available
- the controller can collect reports and validate fan-in

If the platform cannot spawn usable Codex custom agents, the controller must say so and downgrade to a serial or manual workflow.

## Modes

- `none`: no agent split
- `readonly-consult`: agents inspect and report, but do not write
- `serial-subagent`: one worker at a time, controller reviews after each step
- `context-fanout`: multiple read-only or low-conflict workers collect evidence
- `context-fanout` + `isolation=codex-temp-worktree`: host-native workers use receipt-backed OS temporary worktrees
- `worktree-team`: tmux / multi-CLI writable workers in repository-managed worktrees, explicit user approval required

`worktree-team` is the heavy mode. It should not be the default for ordinary tasks.

## Run Artifacts

Each run has a controller-owned workspace, defaulting to ignored local state such as `.codex/work/<run-id>/`.

Minimum files:

- `plan.json`: task graph, mode, ownership, budgets, and verification gates
- `tasks/task-<n>.md`: worker brief with scope, allowed paths, forbidden paths, loop budget, and output contract
- `reports/task-<n>.md`: worker result, evidence, changed paths, tests, and open risks
- `review-packages/task-<n>.md`: scoped reviewer handoff with changed files, diff summary, verification evidence, and unresolved risks
- `reviews/task-<n>.md`: controller or reviewer notes
- `ledger.md`: status timeline and blocking conditions
- `fan-in.md`: final merge decision and verification evidence

Only stable decisions or reusable project facts should be promoted into `docs/` or `.codex/context/**`.

Reviewer handoff rules:

- reviewer reads the brief, report, changed files, and scoped diff package; it does not need pasted chat history
- task review stays scoped to that task; only final fan-in performs cross-task integration review
- reviewer should not re-run implementer tests unless evidence is missing, stale, suspicious, or the finding requires reproduction
- controller records findings without pre-judging them, then routes accepted findings back through `producer owns fix` and `reviewer owns regression`

Current CLI implementation:

- `zc agent plan`: creates a dry-run controller plan
- `zc agent plan --write`: writes local run artifacts under `.codex/work/agent-runs/<run-id>/`
- `zc agent worktree prepare`: dry-runs a Codex-only OS temporary worktree lease; `--apply` creates it
- `zc agent worktree cleanup`: dry-runs receipt, Git, thread-state and fan-in gates; `--apply` performs non-force cleanup
- `zc agent worktree recover`: dry-runs exact interrupted-lease/finalize actions; `--apply` promotes completed allocation or releases safe orphan/merged recovery metadata
- `zc team plan/start`: remains the heavier worktree/tmux runtime and is not the default controller path

`zc agent plan` does not spawn Codex workers. It establishes the controller contract first: mode, ownership, loop budget, artifacts, conflicts, and fan-in gates.

Current Codex runtime boundary:

- current Codex releases can spawn subagents after a direct user request or an applicable `AGENTS.md` / skill instruction
- the host owns agent-thread lifecycle, including spawn, follow-up routing, waiting, steering, interruption, status visibility, and thread closure
- standalone `~/.codex/agents/*.toml` / `.codex/agents/*.toml` files can request model, reasoning effort, sandbox, MCP servers, and skills; omitted settings inherit through the Codex configuration chain, while the parent turn's live sandbox / approval override remains authoritative
- session concurrency is runtime-configured through `[agents]`; controller content must not hardcode a universal worker count
- the current host integration also exposes context-fork and reusable-thread controls, but their tool-level schema is Codex-specific and must stay out of the cross-platform canonical contract

Toolkit execution policy now maps these controls to the current Codex lifecycle: independent tasks spawn new threads; same-task clarification and rework reuse the owning thread; context injection, waiting, interruption, partial success and context-fork selection are explicit. The standalone `zc` Node CLI still does not pretend to own or emulate host-injected thread tools.

`zc agent plan` therefore remains useful for write-heavy, resumable, or audited runs. It is no longer the mandatory first step for ordinary read-only Codex fan-out.

## Runtime Capacity

Codex dispatch does not use a universal `1-3` or `max 5` worker limit. The controller reads the current host session capacity, subtracts capacity-consuming child threads reported by that host, and fills only useful independent slots. It preserves the primary thread as controller/integrator, refills from the ready queue as agents finish, and degrades to batched or serial execution when capacity is exhausted.

`zc` does not silently merge a top-level `[agents]` table into user config because the current receipt owns only `[agents.zc_*]` role registrations. Users who intentionally want a broader local ceiling can merge a reviewed setting themselves, for example:

```toml
[agents]
enabled = true
max_concurrent_threads_per_session = 6
default_subagent_model = "gpt-5.6-terra"
default_subagent_reasoning_effort = "medium"
interrupt_message = true
```

Six is a starting point for a host that actually exposes that capacity, not a guaranteed runtime value. The controller still uses live available slots, and each additional agent consumes tokens.

## Role Model Policy

Canonical agent metadata now carries the three documented scalar custom-agent settings and the Codex renderer writes them into standalone / companion TOML:

| Role | Model | Effort | Sandbox | Intent |
|---|---|---|---|---|
| `zc_architect` | `gpt-5.6-sol` | `high` | `read-only` | high-impact architecture decisions |
| `zc_security_auditor` | `gpt-5.6-sol` | `high` | `read-only` | security and trust-boundary analysis |
| `zc_code_reviewer` | `gpt-5.6-terra` | `high` | `read-only` | correctness and regression review |
| `zc_performance_engineer` | `gpt-5.6-terra` | `high` | `read-only` | profiling and performance diagnosis |
| `zc_backend_specialist` | `gpt-5.6-terra` | `medium` | `workspace-write` | bounded backend implementation |
| `zc_frontend_specialist` | `gpt-5.6-terra` | `medium` | `workspace-write` | bounded frontend implementation |
| `zc_test_engineer` | `gpt-5.6-terra` | `medium` | `workspace-write` | tests and coverage implementation |
| `zc_product_owner` | `gpt-5.6-terra` | `medium` | `read-only` | scope and acceptance decisions |
| `zc_context_steward` | `gpt-5.6-luna` | `medium` | `workspace-write` | narrow context-index maintenance |

All nine roles intentionally hard-pin model and reasoning effort. Those two fields have higher precedence than explicit spawn and `[agents]` defaults, so a caller cannot temporarily upgrade them through spawn alone; it must select another role or an unpinned generic worker. `sandbox_mode` is a requested role default, not an authority boundary: the parent turn's live sandbox / approval override is reapplied and actual host permissions govern every write. The scalar schema accepts model IDs without enumerating them so a future model refresh does not require a schema release. `mcp_servers` and `skills.config` need a separate nested-table design and are not generated yet.

## Temporary Worktree Lifecycle

Codex child worktrees live under `<os.tmpdir()>/zc-codex-worktrees/<repo-hash>/<run>/<task>`. They never use repository `.worktrees/` or Codex Desktop's `$CODEX_HOME/worktrees` namespace. A durable receipt under `.codex/work/agent-runs/<run>/worktrees/` binds repo root, common Git dir, path, branch, base/head commit, source dirty state and lease state. Existing parent components for both surfaces must be symlink-free, and canonical containment is rechecked before mutation or removal.

Dirty source repositories are blocked by default because a Git worktree starts from committed `HEAD`, not the source directory's uncommitted files. `--allow-dirty-source` is an explicit controller acknowledgement that those changes are unrelated to the child task; the receipt records the dirty paths and acknowledgement.

Cleanup requires exact receipt ownership, matching Git registry and branch, an agent terminal state, collected fan-in evidence, a clean worktree and an unchanged cleanup fingerprint. It never calls `git worktree remove --force` or global `git worktree prune`.

- unchanged / already merged work: remove worktree, receipt, empty temp directories and branch
- unmerged commits: remove the directory, preserve named branch plus receipt as a recovery anchor
- dirty, missing or mismatched state: block cleanup and keep evidence
- interrupted allocation or later-merged recovery branch: `recover` rechecks receipt, Git registry, branch ancestry and lock ownership before promotion or release

Chat-level worktrees created by Codex Desktop remain app-managed and are outside this manager's ownership.

## Ownership

Every writable task must declare:

- allowed files or directories
- forbidden files or directories
- expected line ranges when practical
- intent set, such as `tests-only`, `docs-only`, `module-a-impl`
- agent role and model, or the explicit `platform-default` fallback
- loop budget
- verification command

Before dispatch and before fan-in, the controller checks:

- overlapping writable paths
- nearby line ranges
- incompatible intents
- missing reports
- tests or checks that were skipped

## Fan-In Rules

The controller owns fan-in.

Fan-in must stop when:

- a worker changed unowned files
- reports are missing or incomplete
- diffs conflict semantically or textually
- required verification did not run
- context or docs gates are unresolved

Successful fan-in must leave a concise summary:

- accepted changes
- rejected changes
- verification evidence
- docs/context follow-up
- remaining risks

## Implementation Stages

1. Done: dry-run planning and run artifact schema through `zc agent plan`.
2. Done at policy layer: native dispatch, follow-up, context injection, waiting, interruption, reusable-thread, context-fork and runtime-capacity mapping.
3. Done: scalar role model / reasoning / sandbox metadata and Codex TOML rendering.
4. Done: Codex-only OS temporary worktree lease, cleanup gates and recovery branch policy.
5. Next: automated host runtime behavioral smoke for named-role spawn, reuse, interrupt, nested delegation and approval failure.
6. Next: add host thread outcomes to persistent controller artifacts and extend proximity checks to line-range / intent collisions.
7. Deferred: nested `mcp_servers` / `skills.config` rendering and ownership-aware top-level `[agents]` config merge.

Detailed alignment status and the next upgrade backlog live in `references/notes/codex-multi-agent-execution-plan.md`.
