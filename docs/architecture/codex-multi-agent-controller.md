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
- `worktree-team`: writable workers in separate worktrees, explicit user approval required

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
- `zc team plan/start`: remains the heavier worktree/tmux runtime and is not the default controller path

`zc agent plan` does not spawn Codex workers. It establishes the controller contract first: mode, ownership, loop budget, artifacts, conflicts, and fan-in gates.

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

1. Done: add dry-run planning and run artifact schema through `zc agent plan`.
2. Add read-only fan-out dispatch when Codex exposes a suitable runtime.
3. Add controller fan-in validation for local changes.
4. Add writable worktree-team mode only after ownership checks and cleanup are reliable.
5. Extend proximity checks from file/directory ownership to line-range and intent collisions.
