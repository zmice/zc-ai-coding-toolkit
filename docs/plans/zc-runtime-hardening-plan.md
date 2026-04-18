# Implementation Plan: zc Runtime Hardening

## Overview
This plan fixes `zc` in the smallest useful sequence: close the worker/task lifecycle, remove duplicate dispatch behavior, make shutdown/state persistence consistent, then stabilize tests and metadata so the package can verify cleanly.

## Architecture Decisions
- Track task completion explicitly in the runtime instead of inferring it from tmux pane existence.
- Keep orchestration ownership in `Orchestrator`; `WorkerManager` should expose worker state transitions rather than hiding completion logic.
- Use one dispatch model in normal execution to avoid race conditions.
- Make tests deterministic by mocking process boundaries instead of depending on host-installed CLIs or stale `dist/` artifacts.

## Dependency Graph
- Worker completion tracking
  - depends on: `WorkerManager` state API
  - unlocks: task completion transitions in `Orchestrator`
- Single dispatch loop
  - depends on: clear lifecycle ownership in `Orchestrator` + CLI entry
  - unlocks: stable runtime behavior
- Shutdown consistency
  - depends on: active assignment tracking being correct
  - unlocks: trustworthy persisted state
- Test stabilization and version consistency
  - depends on: final runtime behavior
  - unlocks: clean verification gate

## Task List

### Phase 1: Lifecycle Foundation

## Task 1: Add explicit worker completion/state transition hooks

**Description:** Refactor worker runtime state so a worker can move from `busy` back to `idle` after a task finishes, while preserving current task identity and failure visibility.

**Acceptance criteria:**
- [ ] `WorkerManager` exposes enough API to mark a worker idle or dead after command execution.
- [ ] Worker state no longer stays permanently `busy` after a normal task run.
- [ ] Existing worker manager tests cover the new state transitions.

**Verification:**
- [ ] Tests pass: `cd zc && npm test -- --run src/team/__tests__/worker-manager.test.ts`
- [ ] Type-check passes: `cd zc && npm run lint`

**Dependencies:** None

**Files likely touched:**
- `zc/src/team/worker-manager.ts`
- `zc/src/team/__tests__/worker-manager.test.ts`
- `zc/src/adapters/types.ts`

**Estimated scope:** Medium

## Task 2: Close the task lifecycle in the orchestrator

**Description:** Teach `Orchestrator` to detect successful worker completion, transition tasks to `completed`, release active assignments, and make workers reusable for later tasks.

**Acceptance criteria:**
- [ ] A successfully finished task transitions from `in_progress` to `completed`.
- [ ] The corresponding worker becomes `idle` and can receive another task.
- [ ] Worker death still marks the task as `failed`.

**Verification:**
- [ ] Tests pass: `cd zc && npm test -- --run src/team/__tests__/orchestrator.test.ts`
- [ ] Type-check passes: `cd zc && npm run lint`

**Dependencies:** Task 1

**Files likely touched:**
- `zc/src/team/orchestrator.ts`
- `zc/src/team/__tests__/orchestrator.test.ts`
- `zc/src/team/task-queue.ts`

**Estimated scope:** Medium

### Checkpoint: After Phase 1
- [ ] Worker/task lifecycle is closed end-to-end in tests
- [ ] No runtime path leaves a successful task stuck in `in_progress`
- [ ] Human review before proceeding

### Phase 2: Dispatch and Shutdown Consistency

## Task 3: Remove duplicate dispatch loop ownership

**Description:** Make normal execution use a single dispatch mechanism so `team start` does not run overlapping schedulers.

**Acceptance criteria:**
- [ ] Runtime uses one dispatch loop model in normal CLI execution.
- [ ] No code path starts both timer-driven dispatch and explicit while-loop dispatch simultaneously.
- [ ] Orchestrator tests cover the selected dispatch ownership model.

**Verification:**
- [ ] Tests pass: `cd zc && npm test -- --run src/team/__tests__/orchestrator.test.ts`
- [ ] Type-check passes: `cd zc && npm run lint`

**Dependencies:** Task 2

**Files likely touched:**
- `zc/src/team/orchestrator.ts`
- `zc/src/cli/team.ts`
- `zc/src/team/__tests__/orchestrator.test.ts`

**Estimated scope:** Medium

## Task 4: Make shutdown and persisted state truthful

**Description:** Ensure shutdown releases or finalizes active assignments correctly and does not leave misleading team state behind.

**Acceptance criteria:**
- [ ] Shutdown clears active assignments consistently.
- [ ] Persisted state reflects the real post-shutdown situation.
- [ ] `team status` / `team log` do not rely on misleading stale runtime data for a terminated team.

**Verification:**
- [ ] Tests pass: `cd zc && npm test -- --run src/team/__tests__/orchestrator.test.ts src/__tests__/integration.test.ts`
- [ ] Type-check passes: `cd zc && npm run lint`

**Dependencies:** Task 3

**Files likely touched:**
- `zc/src/team/orchestrator.ts`
- `zc/src/cli/team.ts`
- `zc/src/__tests__/integration.test.ts`

**Estimated scope:** Medium

### Checkpoint: After Phase 2
- [ ] Dispatch loop ownership is singular and explicit
- [ ] Shutdown behavior is coherent for operators
- [ ] Human review before proceeding

### Phase 3: Verification Stability and Metadata

## Task 5: Stabilize adapter and CLI integration tests

**Description:** Remove environment-sensitive assumptions from tests so verification is deterministic across machines and CI.

**Acceptance criteria:**
- [ ] Adapter tests do not require the host machine to have a particular CLI output shape.
- [ ] CLI integration tests do not fail because `dist/` is stale or because another test polluted process execution boundaries.
- [ ] Test failures, if any, point to product behavior rather than harness fragility.

**Verification:**
- [ ] Tests pass: `cd zc && npm test -- --run src/adapters/__tests__/adapters.test.ts src/__tests__/integration.test.ts`
- [ ] Type-check passes: `cd zc && npm run lint`

**Dependencies:** Task 4

**Files likely touched:**
- `zc/src/adapters/__tests__/adapters.test.ts`
- `zc/src/__tests__/integration.test.ts`
- `zc/src/cli/index.ts`

**Estimated scope:** Medium

## Task 6: Align package metadata and run full verification

**Description:** Fix version/reporting inconsistencies and confirm the whole `zc` package is green under the required commands.

**Acceptance criteria:**
- [ ] CLI version output matches package metadata.
- [ ] Full lint, test, and build commands pass.
- [ ] Smoke checks for `--help` and `--version` behave correctly after build.

**Verification:**
- [ ] Type-check passes: `cd zc && npm run lint`
- [ ] Tests pass: `cd zc && npm test -- --run`
- [ ] Build succeeds: `cd zc && npm run build`
- [ ] Manual check: `node zc/dist/cli/index.js --help`
- [ ] Manual check: `node zc/dist/cli/index.js --version`

**Dependencies:** Task 5

**Files likely touched:**
- `zc/src/cli/index.ts`
- `zc/package.json`
- `zc/src/__tests__/integration.test.ts`

**Estimated scope:** Small

### Checkpoint: Complete
- [ ] All `zc` runtime success criteria from the spec are satisfied
- [ ] Verification commands are green
- [ ] Ready for `/quality-review`

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Completion detection tied too tightly to one adapter/process model | High | Keep completion tracking at a generic worker/runtime boundary and cover it with unit tests |
| Dispatch refactor breaks current CLI behavior | High | Change one ownership path only, then regression-test `team start` orchestration behavior |
| Test stabilization hides real integration issues | Medium | Mock only process boundaries; keep queue/orchestrator behavior assertions intact |
| Dirty worktree causes accidental scope creep | Medium | Restrict edits to `zc/` and plan docs during this iteration |

## Open Questions
- None for the `zc` runtime slice. Repository structure optimization is deferred to a separate discussion after `zc` is stable.
