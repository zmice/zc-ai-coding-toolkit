---
name: sdd-tdd-workflow
description: Orchestrates the full SDD+TDD development lifecycle. Use when starting any new feature, project, or significant change. Enforces spec-first, test-first discipline through four gated phases - Specify, Plan, Build (TDD), Review. Also provides on-demand skills for debugging, context management, simplification, performance, security, API design, documentation, shipping, migration, frontend, and idea refinement. Triggers on /spec, /task-plan, /build, /quality-review, /debug, /ctx-health, /simplify, /perf, /secure, /api, /doc, /ship, /migrate, /ui, /idea, or /sdd-tdd for the full workflow.
---

# SDD + TDD Development Workflow

## Overview

This skill orchestrates the complete Spec-Driven Development + Test-Driven Development lifecycle. Every non-trivial development task flows through four gated phases. No phase advances until the previous one is validated.

```
/spec ──→ /task-plan ──→ /build ──→ /quality-review
  │          │         │          │
  ▼          ▼         ▼          ▼
Specify    Plan     Build+TDD   Review
(SDD)    (Tasks)   (Red→Green   (5-axis
                    →Refactor)   quality)

On-demand:  /debug (systematic troubleshooting)
            /ctx-health (long-session quality management)
```

## Commands

| Command | Phase | What It Does |
|---------|-------|-------------|
| `/sdd-tdd` | Full workflow | Run all 4 phases sequentially with gates |
| `/spec` | Phase 1 | Write specification before any code |
| `/task-plan` | Phase 2 | Break spec into verifiable tasks |
| `/build` | Phase 3 | Implement with strict TDD (Red-Green-Refactor) |
| `/quality-review` | Phase 4 | Five-axis code review before merge |
| `/debug` | On-demand | Systematic root-cause debugging (Stop-the-Line) |
| `/ctx-health` | On-demand | Context management for long sessions |
| `/simplify` | On-demand | Code simplification — reduce complexity, preserve behavior |
| `/perf` | On-demand | Performance optimization — measure first, then optimize |
| `/secure` | On-demand | Security hardening — OWASP Top 10, input validation |
| `/api` | On-demand | API & interface design — contract first, consistent errors |
| `/doc` | On-demand | Documentation & ADRs — record decisions, not just code |
| `/ship` | On-demand | Shipping & launch — pre-launch checklist, staged rollout |
| `/migrate` | On-demand | Deprecation & migration — strangler pattern, safe removal |
| `/ui` | On-demand | Frontend UI engineering — component patterns, accessibility |
| `/idea` | On-demand | Idea refinement — refine vague ideas into actionable specs |

## Phase 1: Specify (`/spec`)

Follow the `spec-driven-development` skill. Key actions:

1. **Surface assumptions** — List all assumptions explicitly, ask for confirmation
2. **Write spec** covering: Objective, Tech Stack, Commands, Project Structure, Code Style, Testing Strategy, Boundaries
3. **Reframe vague requirements** into concrete, testable success criteria
4. **Gate:** Human reviews and approves the spec before proceeding

```
ASSUMPTIONS I'M MAKING:
1. [assumption about requirements]
2. [assumption about tech stack]
3. [assumption about scope]
→ Correct me now or I'll proceed with these.
```

**Output:** A spec document saved to the repository.

## Phase 2: Plan (`/task-plan`)

Follow the `planning-and-task-breakdown` skill. Key actions:

1. **Read-only mode** — Analyze spec and codebase, do NOT write code
2. **Map dependency graph** — Identify what depends on what
3. **Slice vertically** — Each task delivers working, testable functionality
4. **Write tasks** with acceptance criteria, verification steps, and file estimates
5. **Gate:** Human reviews and approves the plan before proceeding

**Task sizing rule:** No task touches more than ~5 files. XL tasks must be broken down further.

**Output:** A plan document with ordered tasks and checkpoints.

## Phase 3: Build (`/build`)

Follow `incremental-implementation` + `test-driven-development` skills simultaneously.

### Mandatory TDD Cycle for Every Change

```
RED ──→ GREEN ──→ REFACTOR ──→ (repeat)
 │         │          │
 ▼         ▼          ▼
Write    Write      Clean up
failing  minimal    while tests
test     code       still pass
```

**Build rules:**
1. **Test first, always.** Write a failing test before any implementation code
2. **One slice at a time.** Implement → Test → Verify → Commit → Next slice
3. **Keep it compilable.** After each increment, build and tests must pass
4. **Simplicity first.** Ask "What is the simplest thing that could work?"
5. **Scope discipline.** Touch only what the task requires — no side quests
6. **Git discipline.** Atomic commits per slice, descriptive messages (follow `git-workflow-and-versioning`)

**Bug fixes use the Prove-It Pattern:**
```
Bug reported → Write reproduction test (FAILS) → Fix code → Test PASSES → Run full suite
```

**Quality checkpoint:** Every 3-5 tasks, trigger a mini `/quality-review` to catch drift early.

**Gate:** All tests pass, build succeeds, each slice committed.

## Phase 4: Review (`/quality-review`)

Follow the `code-review-and-quality` skill. Five-axis review:

1. **Correctness** — Does it match the spec? Edge cases handled?
2. **Readability** — Clear names, straightforward logic, no cleverness?
3. **Architecture** — Follows existing patterns? Clean boundaries?
4. **Security** — Input validated? No secrets? Auth checked?
5. **Performance** — No N+1? No unbounded operations?

**Gate:** All Critical/Important issues resolved before merge.

## On-Demand: Debug (`/debug`)

Follow the `debugging-and-error-recovery` skill. Use when anything unexpected happens.

**Stop-the-Line Rule:**
```
1. STOP adding features or making changes
2. PRESERVE evidence (error output, logs, repro steps)
3. DIAGNOSE using triage: Reproduce → Localize → Reduce → Fix → Guard
4. GUARD against recurrence with a regression test
5. RESUME only after full verification passes
```

**Key principle:** Fix the root cause, not the symptom. Never skip a failing test to work on new features.

## On-Demand: Context Management (`/ctx-health`)

Follow the `context-engineering` skill. Use to maintain output quality in long sessions.

**When to use:**
- Agent output quality is declining (wrong patterns, hallucinated APIs)
- Switching between different parts of the codebase
- Starting a new task within a long session

**Context hierarchy (most persistent → most transient):**
```
1. Rules Files        ← Always loaded, project-wide
2. Spec / Architecture ← Loaded per feature/session
3. Relevant Source     ← Loaded per task
4. Error Output        ← Loaded per iteration
5. Conversation History ← Accumulates, compacts
```

## Long Session Keepalive Protocol

To maintain quality across long development sessions:

### After completing each task, output a structured summary:

```
TASK COMPLETE: [Task N - Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Changes made:
- [file]: [what changed]
- [file]: [what changed]

Tests: [X passed, Y added]
Build: [clean/warnings]

Decisions made:
- [key decision and rationale]

Next task: [Task N+1 - Title]
Dependencies satisfied: [yes/no]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Before starting each new task, reload context:

```
CONTEXT RELOAD for Task [N]:
- Spec section: [relevant section]
- Files to modify: [list]
- Pattern to follow: [existing example in codebase]
- Constraints: [from spec boundaries]
```

### Quality review checkpoints:

Every 3-5 completed tasks, perform a mini-review:
```
QUALITY CHECKPOINT after Tasks [X-Y]:
- [ ] All tests still pass (full suite)
- [ ] Build is clean
- [ ] No accumulated tech debt or shortcuts
- [ ] Spec compliance verified
- [ ] No scope creep beyond plan
→ Issues found? Address before continuing.
```

## Full Workflow (`/sdd-tdd`)

When triggered, execute all 4 phases with explicit gates:

```
1. /spec    → Write and validate spec         → [Human approves]
2. /task-plan → Break into tasks                → [Human approves]
3. /build   → Implement each task with TDD    → [Tests pass per slice]
   ├── After every 3-5 tasks: Quality Checkpoint
   └── On any failure: /debug (Stop-the-Line)
4. /quality-review → Five-axis review                → [All issues resolved]
```

At each gate, **STOP and wait for human confirmation** before proceeding.

## When NOT to Use Full Workflow

- **Single-line fixes / typo corrections:** Just fix it
- **Pure config changes:** No behavioral impact, no TDD needed
- **Documentation-only updates:** No spec needed

For these cases, use individual commands (`/build` for small fixes, `/quality-review` for any change).

## Core Behaviors (Always Active)

1. **Surface assumptions** — Never silently fill in ambiguity
2. **Manage confusion** — STOP when encountering inconsistencies, ask before proceeding
3. **Push back** — Point out problems directly, propose alternatives
4. **Enforce simplicity** — If 100 lines suffice, 1000 lines is a failure
5. **Verify, don't assume** — Every phase has a verification step; "seems right" is never done
6. **Scope discipline** — Touch only what the task requires; note but don't fix unrelated issues
7. **Context awareness** — Reload relevant context when switching tasks; summarize progress at boundaries

## On-Demand Skills (Extended Toolkit)

| Command | Skill | When to Use |
|---------|-------|------------|
| `/simplify` | code-simplification | Code works but is harder to read/maintain than it should be. Refactoring for clarity. |
| `/perf` | performance-optimization | Performance requirements exist, users report slowness, or Core Web Vitals need improvement. |
| `/secure` | security-and-hardening | Handling user input, auth, data storage, or external integrations. |
| `/api` | api-and-interface-design | Designing new APIs, module boundaries, or component interfaces. |
| `/doc` | documentation-and-adrs | Making architectural decisions, changing public APIs, or recording context for the future. |
| `/ship` | shipping-and-launch | Preparing to deploy — pre-launch checklist, feature flags, rollback strategy. |
| `/migrate` | deprecation-and-migration | Replacing old systems, sunsetting features, or removing dead code. |
| `/ui` | frontend-ui-engineering | Building UI components, handling accessibility, responsive design. |
| `/idea` | idea-refine | Turning vague ideas into concrete, actionable specifications. |

These are invoked on-demand and do not require the full SDD-TDD gate flow.

## Red Flags

- Writing code before spec exists
- Skipping tests to "save time"
- Tests that pass on first run without any implementation
- Large uncommitted changes accumulating
- "I'll test it all at the end"
- Implementing features not in the spec
- Agent output quality declining without context reload
- Pushing past failures instead of stopping to debug
- No structured summary between tasks in long sessions
- Optimizing without measurement data
- Security added as an afterthought
- API design without contract-first approach
