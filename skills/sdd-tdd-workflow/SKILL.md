---
name: sdd-tdd-workflow
description: Orchestrates the full SDD+TDD development lifecycle. Use when starting any new feature, project, or significant change. Enforces spec-first, test-first discipline through five gated phases - Brainstorm (optional), Specify, Plan, Build (TDD with optional subagent-driven mode), Review. Also provides on-demand skills for debugging, context management, verification, onboarding, simplification, performance, security, API design, documentation, shipping, CI/CD, git commit, migration, frontend, and idea refinement. Triggers on /spec, /task-plan, /build, /quality-review, /verify, /onboard, /debug, /ctx-health, /simplify, /perf, /secure, /api, /doc, /ship, /ci, /commit, /migrate, /ui, /idea, or /sdd-tdd for the full workflow.
---

# SDD + TDD Development Workflow

## Overview

This skill orchestrates the complete Spec-Driven Development + Test-Driven Development lifecycle. Every non-trivial development task flows through gated phases. No phase advances until the previous one is validated.

```
[/idea] ──→ [brainstorm] ──→ /spec ──→ /task-plan ──→ /build ──→ /quality-review ──→ /retro
 (optional)   (optional)       │          │            │          │                    │
                               ▼          ▼            ▼          ▼                    ▼
                            Specify    Plan        Build+TDD   Review              Reflect
                            (SDD)    (Tasks)      (Red→Green   (5-axis            (Retro
                                                   →Refactor)   quality)            +Learn)

 Build modes:  Manual (default) or Subagent-Driven (for independent tasks)
 On-demand:    /debug /ctx-health /verify /onboard /simplify /perf /secure
               /api /doc /ship /ci /commit /migrate /ui /idea /careful /freeze /guard /qa /plan-review
```

完整 Sprint 生命周期（v2）:

```
/spec → /plan-review → /task-plan → /build → /quality-review → /retro
  |         |              |           |            |              |
  v         v              v           v            v              v
Specify  Multi-View     Plan      Build+TDD     5-Axis        Retro
(SDD)    Review       (Tasks)   (Red→Green    Review       (Reflect
                                 →Refactor)                  +Learn)
```

## Commands

| Command | Phase | What It Does |
|---------|-------|-------------|
| `/sdd-tdd` | Full workflow | Run all phases sequentially with gates |
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
| `/ci` | On-demand | CI/CD 管道搭建与优化，质量门禁配置 |
| `/commit` | On-demand | 规范化 Git 提交，原子提交 + 描述性消息 |
| `/migrate` | On-demand | Deprecation & migration — strangler pattern, safe removal |
| `/ui` | On-demand | Frontend UI engineering — component patterns, accessibility |
| `/idea` | On-demand | Idea refinement — refine vague ideas into actionable specs |
| `/verify` | On-demand | Verification before completion — evidence before assertions |
| `/onboard` | On-demand | Codebase onboarding — systematically understand a new project |
| `/retro` | Phase 5 | Sprint 回顾，统计产出和改进项 |
| `/learn` | On-demand | 手动触发会话模式提取与学习 |
| `/careful` | On-demand | 激活危险命令预警模式 |
| `/freeze` | On-demand | 锁定指定目录/文件禁止编辑 |
| `/guard` | On-demand | 同时激活 careful + freeze 全面防护 |
| `/qa` | On-demand | 执行浏览器 QA 测试 |
| `/plan-review` | Phase 1→2 | 多视角计划评审（产品/工程/设计/DevEx） |

## Phase 0 (Optional): Brainstorm

When requirements are vague or multiple approaches exist, use `brainstorming-and-design` skill before writing a formal spec:

1. **Explore project context** — Check files, docs, recent commits
2. **Ask clarifying questions** — One at a time, understand purpose/constraints
3. **Propose 2-3 approaches** — With trade-offs and your recommendation
4. **Present design** — In sections, get user approval
5. **Gate:** User approves the design before proceeding to spec

Skip this phase when requirements are already clear and specific.

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

**Build modes:**

- **Manual (default):** You implement each task directly, one at a time
- **Subagent-Driven:** When tasks are mostly independent, use `subagent-driven-development` to dispatch fresh subagent per task with two-stage review (spec compliance → code quality)
- **Parallel:** When tasks are independent AND >2, use `parallel-agent-dispatch` for concurrent execution
- **Cascade:** When tasks have layered dependencies, use `parallel-agent-dispatch` Cascade mode — parallel within layers, serial between layers, with gate verification at each level

**Build rules:**
1. **Test first, always.** Write a failing test before any implementation code
2. **One slice at a time.** Implement → Test → Verify → Commit → Next slice
3. **Keep it compilable.** After each increment, build and tests must pass
4. **Simplicity first.** Ask "What is the simplest thing that could work?"
5. **Scope discipline.** Touch only what the task requires — no side quests
6. **Git discipline.** Atomic commits per slice, descriptive messages (follow `git-workflow-and-versioning`)
7. **Verify before claiming done.** Follow `verification-before-completion` — run the command, read the output, then claim (see `/verify`)

**Bug fixes use the Prove-It Pattern:**
```
Bug reported → Write reproduction test (FAILS) → Fix code → Test PASSES → Run full suite
```

**Quality checkpoint:** Every 3-5 tasks, trigger a mini `/quality-review` to catch drift early.

**Gate:** All tests pass, build succeeds, each slice committed. Run `/verify` to confirm with evidence.

**Context budget check:** If the session is getting long, run `context-budget-audit` to assess context headroom before continuing.

## Phase 4: Review (`/quality-review`)

Follow the `code-review-and-quality` skill. Five-axis review:

1. **Correctness** — Does it match the spec? Edge cases handled?
2. **Readability** — Clear names, straightforward logic, no cleverness?
3. **Architecture** — Follows existing patterns? Clean boundaries?
4. **Security** — Input validated? No secrets? Auth checked?
5. **Performance** — No N+1? No unbounded operations?

**Gate:** All Critical/Important issues resolved before merge.

## Phase 5: Reflect (`/retro`)

Follow the `sprint-retrospective` skill. Key actions:

1. **Collect data** — Git statistics, test coverage changes, LOC metrics
2. **Review outcomes** — What went well, what didn't, key decisions
3. **Check spec drift** — Compare final delivery against original spec
4. **Assess process health** — TDD compliance, verification pass rate, review pass rate
5. **Generate action items** — Concrete improvements with owners and deadlines
6. **Capture learnings** — Document lessons for future reference
7. **Extract instincts** — Run `/learn` to extract reusable patterns from this cycle into instincts. Auto-sync high-confidence instincts to Agent Memory for cross-session persistence.

**Gate:** Action items reviewed and assigned before starting next sprint.

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

When triggered, execute all 5 phases with explicit gates:

```
1. /spec        → Write and validate spec              → [Human approves]
2. /plan-review → Multi-perspective review (optional)   → [Human approves]
3. /task-plan   → Break into tasks                      → [Human approves]
4. /build       → Implement each task with TDD          → [Tests pass per slice]
   ├── After every 3-5 tasks: Quality Checkpoint
   └── On any failure: /debug (Stop-the-Line)
5. /quality-review → Five-axis review                   → [All issues resolved]
6. /retro       → Sprint retrospective                  → [Action items assigned]
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
| `/ci` | ci-cd-and-automation | 搭建或优化 CI/CD 管道，配置质量门禁、部署策略、CI 失败反馈循环。 |
| `/commit` | git-workflow-and-versioning | 引导规范化 Git 提交，原子提交、描述性消息、提交前检查。 |
| `/migrate` | deprecation-and-migration | Replacing old systems, sunsetting features, or removing dead code. |
| `/ui` | frontend-ui-engineering | Building UI components, handling accessibility, responsive design. |
| `/idea` | idea-refine | Turning vague ideas into concrete, actionable specifications. |
| `/verify` | verification-before-completion | Before claiming work is done — evidence before assertions. |
| `/onboard` | codebase-onboarding | Entering an unfamiliar codebase — systematic project understanding. |
| `/careful` | safety-guardrails | 操作生产环境或关键基础设施，需要预防破坏性误操作 |
| `/freeze` | safety-guardrails | 需要锁定关键文件/目录防止意外修改 |
| `/guard` | safety-guardrails | 组合防护模式，同时激活预警和锁定 |
| `/qa` | browser-qa-testing | 前端开发完成后，需要真实浏览器 QA 验证 |
| `/plan-review` | multi-perspective-review | Spec/Plan 完成后，需要多视角评审发现盲点 |
| `/retro` | sprint-retrospective | Sprint/开发周期结束后，回顾总结和持续改进 |
| `/learn` | continuous-learning | 手动触发会话模式提取，生成 instincts 并持久化到 Memory |

These are invoked on-demand and do not require the full SDD-TDD gate flow.

## Subagent Skills (Advanced)

| Skill | When to Use |
|-------|------------|
| `subagent-driven-development` | Executing plans with independent tasks — fresh subagent per task with 2-stage review |
| `parallel-agent-dispatch` | Multiple independent tasks that can run concurrently — fan-out/fan-in pattern, Worktree isolation, or Cascade layered execution |
| `brainstorming-and-design` | Before spec phase when requirements are vague — collaborative design exploration |
| `context-budget-audit` | Session feels sluggish or after adding components — quantify context overhead |

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
- Claiming "done" without running verification commands
- Trusting subagent success reports without independent verification
- Parallel tasks modifying the same files
- Skipping `/learn` at the end of a development cycle (missing learning opportunities)
- Cascade mode without layer-gate verification
