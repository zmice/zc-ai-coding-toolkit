---
name: sprint-retrospective
description: Conducts structured sprint retrospectives after development cycles. Use after completing an SDD+TDD cycle, finishing a week of work, reaching a milestone, or recovering from an incident. Collects git-based metrics, identifies wins and bottlenecks, checks spec drift, and produces actionable improvement items.
---

# Sprint Retrospective

## Overview

The retrospective closes the feedback loop: **Think → Plan → Build → Review → Reflect**. Without it, you repeat mistakes, forget wins, and let process drift go unnoticed.

A good retro is not a blame session. It's a data-driven inspection of what happened, why it happened, and what concrete actions follow. The output is a short list of improvements with owners and deadlines — not a philosophical essay about team culture.

**The standard:** Every retro produces at least one measurable action item that changes how the next cycle works. If a retro produces zero changes, it was theater.

## When to Use

- After completing an SDD+TDD cycle (the natural "Reflect" phase)
- After finishing a week-long development sprint
- After a project milestone is delivered
- After a production incident or major unexpected change
- When you notice recurring friction but can't pinpoint the cause
- Before starting a new major initiative (retrospect on the last one first)

## The Retrospective Flow

### Step 1: Data Collection — Git & Project Metrics

Start with facts, not feelings. Gather quantitative data before any discussion.

**Git statistics to collect:**
```
git log --oneline --since="<sprint-start>" --until="<sprint-end>" | wc -l   # commit count
git diff --stat <start-sha>..<end-sha>                                       # files changed, insertions/deletions
git shortlog -sn --since="<sprint-start>"                                    # commits per author/agent
```

**Key metrics to extract:**
```
SPRINT DATA COLLECTION:
- Total commits: ___
- Files changed: ___
- Lines added: ___
- Lines deleted: ___
- Net LOC change: ___ (added minus deleted)
- Test files added/modified: ___
- Spec files created/updated: ___
- Number of PRs/merges: ___
- Average PR size (lines changed): ___
```

**Automation tip:** If using a monorepo, scope stats to the relevant package or directory. Noise from unrelated areas corrupts the analysis.

**Test coverage delta:**
```
Coverage at sprint start: ___%
Coverage at sprint end:   ___%
Delta:                    ___% (positive = improvement)
```

### Step 2: What Went Well

Identify decisions, practices, and patterns that worked. Be specific — "good teamwork" is useless; "splitting the auth module into three focused PRs made review 3x faster" is actionable.

**Questions to answer:**
- Which technical decisions paid off? Why?
- Which process practices saved time or caught issues early?
- Were there moments where TDD or spec-first approach prevented bugs?
- Did any tool, pattern, or convention prove especially valuable?
- What would you deliberately repeat in the next cycle?

**Format each item as:**
```
✓ [What happened] → [Why it worked] → [How to reinforce it]
Example:
✓ Writing integration tests before refactoring the payment module
  → Caught 3 regression bugs during refactoring that unit tests missed
  → Continue requiring integration tests for any module with external dependencies
```

### Step 3: What Didn't Go Well

Identify problems, bottlenecks, surprises, and friction. No blame — focus on systemic causes, not individual mistakes.

**Questions to answer:**
- Where did you spend time that didn't produce value?
- What tasks took significantly longer than estimated? Why?
- Were there repeated context switches or interruptions?
- Did any technical decision create unexpected problems?
- Were there communication gaps (unclear specs, missing context)?
- Did any dependency or external factor block progress?

**Format each item as:**
```
✗ [What happened] → [Root cause] → [Impact]
Example:
✗ Database migration failed in staging after passing locally
  → Root cause: local DB had stale test data that masked a constraint violation
  → Impact: 4 hours debugging + delayed the release by 1 day
```

**The Five Whys:** For significant problems, ask "why" five times to find the root cause. Surface symptoms hide systemic issues.

### Step 4: Spec Drift Check

Compare the final deliverable against the original specification. Drift is normal — unacknowledged drift is dangerous.

```
SPEC DRIFT ANALYSIS:
- Original spec items:        ___
- Delivered as specified:      ___
- Delivered with modifications: ___
- Deferred to next cycle:      ___
- Added (not in original spec): ___
- Dropped (decided not to do):  ___

Drift rate: (modified + deferred + added + dropped) / original × 100 = ___%
```

**Acceptable drift:** 10–20% is normal for a healthy cycle. Scope adjustments happen.

**Warning signs:**
- Drift > 30%: Specs are not detailed enough, or requirements changed mid-cycle without formal acknowledgment
- Many "added" items: Scope creep — features being added without cutting something else
- Many "deferred" items: Over-commitment — planning more than capacity allows
- Modifications without spec updates: The spec is now a lie — update it or delete it

### Step 5: Process Health Metrics

Evaluate how well the development process itself performed.

```
PROCESS HEALTH:
- TDD compliance rate:    ___% (changes with tests written first / total changes)
- Spec coverage:          ___% (features with specs / total features)
- Review pass rate:       ___% (PRs approved on first review / total PRs)
- Build stability:        ___% (green builds / total builds)
- Verification pass rate: ___% (changes passing verification on first attempt)
- Avg time from PR open to merge: ___
- Rework rate:            ___% (commits that fix issues in same-sprint code)
```

**Healthy benchmarks:**
| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| TDD compliance | >80% | 50–80% | <50% |
| Review pass rate | >60% | 30–60% | <30% |
| Build stability | >90% | 70–90% | <70% |
| Spec drift | <20% | 20–30% | >30% |
| Rework rate | <15% | 15–30% | >30% |

### Step 6: Action Items

The most important step. Every problem identified must either get an action item or an explicit "accepted — not worth fixing."

**Each action item must have:**
```
ACTION ITEM:
- What:     [Specific, measurable change]
- Why:      [Which problem from Steps 3–5 does this address]
- Owner:    [Who is responsible for implementing this]
- Deadline: [When will this be done — must be before next retro]
- Success:  [How do we know it worked]
```

**Rules for action items:**
1. **Maximum 3–5 items per retro.** More than 5 means nothing gets done. Prioritize ruthlessly.
2. **Must be specific.** "Improve testing" is not an action item. "Add integration tests for all payment endpoints by Friday" is.
3. **Must have an owner.** Unowned items are wishes, not actions.
4. **Must have a deadline.** Items without deadlines drift indefinitely.
5. **Review last retro's items first.** Before creating new items, check: did last cycle's actions get completed? If not, why?

**Anti-patterns in action items:**
| Bad | Good |
|-----|------|
| "Write more tests" | "Achieve 80% coverage on `src/core/` by end of next sprint" |
| "Improve code review" | "Add a review checklist to the PR template by Wednesday" |
| "Be more careful with migrations" | "Add a staging migration dry-run step to CI pipeline by Friday" |
| "Communicate better" | "Write a 3-line summary in each PR description explaining the 'why'" |

### Step 7: Knowledge Capture

Record lessons that have value beyond this sprint. These become organizational memory.

**What to capture:**
- Technical discoveries (performance tricks, library gotchas, infrastructure quirks)
- Process insights (what made this cycle smoother or harder than usual)
- Decision rationale (why did we choose approach A over B — future you will ask)
- Reusable patterns (solutions that should become templates or utilities)

**Format:**
```
LESSON LEARNED:
- Context: [Situation that triggered the learning]
- Insight: [What we now know]
- Application: [How to apply this going forward]
- Tags: [Keywords for future retrieval]
```

**Where to store:** Use the AI memory system, project wiki, or ADR (Architecture Decision Records) depending on the type of knowledge. Technical decisions → ADR. Process insights → retro archive. Reusable code patterns → shared utilities.

## Output Template

```markdown
# Sprint Retrospective: [Sprint Name / Date Range]

## Period
- Start: YYYY-MM-DD
- End: YYYY-MM-DD

## Metrics Summary
| Metric | Value | Trend |
|--------|-------|-------|
| Commits | ___ | ↑/↓/→ |
| Lines added | ___ | |
| Lines deleted | ___ | |
| Net LOC | ___ | |
| Test coverage | ___% | |
| PR count | ___ | |
| Avg PR size | ___ lines | |

## What Went Well
1. ...
2. ...

## What Didn't Go Well
1. ...
2. ...

## Spec Drift
- Drift rate: ___%
- Key deviations: ...

## Process Health
| Metric | Value | Status |
|--------|-------|--------|
| TDD compliance | ___% | ✓/⚠/✗ |
| Review pass rate | ___% | ✓/⚠/✗ |
| Build stability | ___% | ✓/⚠/✗ |
| Rework rate | ___% | ✓/⚠/✗ |

## Previous Action Items Review
- [ ] [Item from last retro] — Status: Done/In Progress/Not Started

## New Action Items
1. **[What]** — Owner: ___ — Deadline: ___ — Addresses: [problem ref]
2. ...
3. ...

## Lessons Learned
1. ...
```

## Quantitative Indicators to Track Over Time

Track these across sprints to spot trends:

**Velocity indicators:**
- Commits per sprint (is pace sustainable?)
- Net LOC change (is codebase growing/shrinking appropriately?)
- Features delivered vs. planned (commitment accuracy)

**Quality indicators:**
- Test coverage trend (improving or degrading?)
- Rework rate (are we fixing our own bugs within the sprint?)
- Review pass rate (is code quality at submission improving?)
- Build break frequency (is CI staying green?)

**Process indicators:**
- Spec drift rate (are we getting better at planning?)
- TDD compliance (are we actually doing what we say we do?)
- Time from PR open to merge (is review a bottleneck?)
- Action item completion rate from previous retros (do retros actually change anything?)

## Red Flags

These signals mean the process needs immediate attention:

- **Retro produces no action items** — The retro was performative, not useful
- **Same problems appear in consecutive retros** — Action items aren't working or aren't being implemented
- **Action item completion rate < 50%** — You're creating items you can't or won't do
- **Spec drift > 40%** — Planning is disconnected from reality
- **Rework rate > 30%** — Quality at first submission is too low
- **Test coverage declining sprint over sprint** — Technical debt is accumulating
- **Build stability < 70%** — The CI pipeline is unreliable and people stop trusting it
- **No one can name what went well** — Morale problem or lack of awareness of team wins
- **Retro skipped "because we're too busy"** — The team most needing reflection is avoiding it
- **All action items are vague or lack owners** — The retro is generating wishes, not commitments

## Integration with SDD+TDD Workflow

The retrospective is **Phase 5: Reflect** in the full development cycle:

```
Phase 1: Spec    → Define what to build (spec-driven-development)
Phase 2: Design  → Design the solution (sdd-tdd-workflow)
Phase 3: Build   → Implement with TDD (test-driven-development)
Phase 4: Review  → Verify quality (code-review-and-quality)
Phase 5: Reflect → Retrospect and improve (this skill)
    │
    └──→ Feed improvements back into Phase 1 of the next cycle
```

**What flows from retro back into the next cycle:**
- Spec drift insights → Better spec writing in Phase 1
- Review feedback patterns → Updated review checklists in Phase 4
- TDD compliance gaps → Adjusted TDD practices in Phase 3
- Process bottlenecks → Workflow changes for the next sprint
- Technical lessons → Updated conventions and patterns

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We don't have time for retros" | You don't have time to keep making the same mistakes. A 30-minute retro saves hours of repeated friction. |
| "Everything went fine, nothing to discuss" | No sprint is perfect. If you can't find improvements, you're not looking hard enough. |
| "We already know what to improve" | Knowing and doing are different. The retro creates accountability through action items with owners. |
| "Metrics don't apply to our work" | If you can't measure it, you can't improve it. Even rough numbers beat no numbers. |
| "Action items from last retro weren't relevant anymore" | Then the retro failed at creating durable improvements. Make items smaller and more immediate. |

## See Also

- For spec-driven development workflow, see `spec-driven-development`
- For TDD practices, see `test-driven-development`
- For code review process, see `code-review-and-quality`
- For SDD+TDD combined workflow, see `sdd-tdd-workflow`
- For task planning and breakdown, see `planning-and-task-breakdown`

## Verification

After completing a retrospective:

- [ ] Git metrics collected and documented
- [ ] What went well — at least 3 specific items identified
- [ ] What didn't go well — root causes analyzed (not just symptoms)
- [ ] Spec drift calculated and analyzed
- [ ] Process health metrics computed against benchmarks
- [ ] Previous retro's action items reviewed for completion
- [ ] New action items created (3–5 max, each with owner + deadline)
- [ ] Lessons captured in appropriate knowledge stores
- [ ] Retro report saved in project archive
