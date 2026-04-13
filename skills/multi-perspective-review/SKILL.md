---
name: multi-perspective-review
description: Evaluates plans and specs from four distinct viewpoints — product, engineering, design, and developer experience — before implementation begins. Use when reviewing specs, architecture decisions, or any change that crosses team boundaries. Catches blind spots that single-perspective reviews miss.
---

# Multi-Perspective Review

## Overview

Engineering reviews catch engineering problems. But most feature failures aren't engineering failures — they're product failures (solving the wrong problem), design failures (unusable interface), or developer experience failures (impossible to integrate). A single-perspective review, no matter how thorough, has structural blind spots.

Multi-perspective review applies four distinct lenses to a plan or spec before implementation begins. The goal is to surface problems when they're cheap to fix (in the spec) rather than expensive to fix (in the code). Each perspective asks fundamentally different questions, and the combination produces a review that no single viewpoint can achieve alone.

**Cost of late discovery:**

```
Spec phase fix     →  ~1 hour (rewrite a paragraph)
Design phase fix   →  ~4 hours (revise wireframes + spec)
Implementation fix →  ~2 days (rewrite code + tests)
Post-launch fix    →  ~1 week (hotfix + incident response + customer communication)
```

## When to Use

- **After a spec or plan is written, before implementation starts** — the primary use case
- Before major architecture decisions that affect multiple teams or services
- When a product direction change affects existing features
- For cross-team changes where no single person has full context
- When a proposal "feels right" but hasn't been stress-tested from multiple angles
- Before investing significant engineering effort (>1 week of work)

## The Four Review Perspectives

### A. Product Review — "Are we solving the right problem?"

This perspective evaluates business value, user need, and strategic alignment. It prevents building technically excellent solutions to the wrong problems.

#### Key Questions

**Problem Validation:**
- What specific user problem does this solve? What's the evidence (data, research, support tickets)?
- How are users solving this problem today without this feature?
- What happens if we don't build this? What's the cost of inaction?

**Scope and MVP:**
- Can the scope be reduced while still delivering the core value?
- What's the smallest version that validates the hypothesis?
- What features can be deferred to v2 without losing the core value proposition?
- Are there hidden assumptions about user behavior that should be tested first?

**ROI Assessment:**
- Engineering cost estimate (time, complexity, maintenance burden)
- Expected impact (users affected, frequency of use, revenue impact)
- Is the ratio justified compared to other items on the roadmap?

**Strategic Alignment:**
- Does this align with the current product roadmap and company strategy?
- Does this create platform value (reusable for future features) or is it a one-off?
- How do competitors handle this? What's our differentiation?

#### Product Review Checklist

```markdown
### Product Review — [Feature Name]

#### Problem
- [ ] User problem is clearly articulated with evidence
- [ ] Current workarounds are documented
- [ ] Cost of inaction is understood

#### Scope
- [ ] MVP is defined — minimum scope that delivers core value
- [ ] v2 features are explicitly deferred, not forgotten
- [ ] Hidden assumptions are identified and have validation plans

#### ROI
- [ ] Engineering cost is estimated (days/weeks, not "small/medium/large")
- [ ] Expected user impact is quantified
- [ ] Compared against alternative investments of same effort

#### Strategy
- [ ] Aligns with current roadmap priorities
- [ ] Competitive landscape is understood
- [ ] Platform vs one-off trade-off is explicit

#### Verdict: [GO / REVISE / NO-GO]
#### Key concerns:
```

---

### B. Engineering Review — "Can we build this reliably?"

This perspective evaluates technical feasibility, architecture fit, risk, and maintainability. It prevents underestimating complexity and missing failure modes.

#### Key Questions

**Architecture Fit:**
- Does the proposed design fit the existing system architecture?
- Are component/service boundaries clean, or does this create awkward coupling?
- What existing code needs to change? What's the blast radius?

**Data Flow:**
- How does data move through the system for this feature?
- Document with an ASCII diagram:

```
User Action → Frontend Component → API Call → Backend Handler
    → Database Query → Response → UI Update → User Sees Result
```

**State Management:**
- What new state does this feature introduce?
- Where does that state live (client, server, URL, local storage)?
- What are the state transitions? Draw the state machine:

```
IDLE → LOADING → SUCCESS → IDLE
              → ERROR → RETRY → LOADING
                     → IDLE (user dismisses)
```

**Failure Analysis:**
- What can go wrong? List every failure mode:
  - Network failure during critical operation
  - Partial data (some fields missing)
  - Concurrent modifications (two users editing same resource)
  - Timeout on long-running operations
  - Invalid state from corrupted data
- For each failure: What does the user see? Is it recoverable?

**Test Strategy:**
- What's the test matrix?

```
| Scenario              | Unit | Integration | E2E | Manual |
|-----------------------|------|-------------|-----|--------|
| Happy path            | ✓    | ✓           | ✓   |        |
| Validation errors     | ✓    | ✓           |     |        |
| Network failure       | ✓    |             | ✓   |        |
| Concurrent access     |      | ✓           |     | ✓      |
| Permission denied     | ✓    | ✓           |     |        |
```

**Performance Impact:**
- Does this add queries, API calls, or bundle size?
- What's the expected load? (requests/sec, data volume)
- Are there operations that could become slow at scale?

**Security:**
- Does this introduce new attack surfaces?
- Are there new authentication/authorization requirements?
- Is sensitive data involved? How is it protected?

#### Engineering Review Checklist

```markdown
### Engineering Review — [Feature Name]

#### Architecture
- [ ] Fits existing patterns or new pattern is justified
- [ ] Component boundaries are clean
- [ ] Blast radius of changes is understood

#### Data & State
- [ ] Data flow is documented (ASCII diagram)
- [ ] State management approach is defined
- [ ] State transitions are mapped

#### Failure Modes
- [ ] Failure scenarios are listed
- [ ] Each failure has a user-visible recovery path
- [ ] No silent failures that leave system in bad state

#### Testing
- [ ] Test matrix is defined
- [ ] Coverage strategy matches risk level

#### Performance & Security
- [ ] Performance impact is assessed
- [ ] No new unbounded operations
- [ ] Security implications reviewed

#### Verdict: [GO / REVISE / NO-GO]
#### Key concerns:
```

---

### C. Design Review — "Will users understand and enjoy this?"

This perspective evaluates usability, visual consistency, accessibility, and information architecture. It prevents building features that work technically but confuse or frustrate users.

#### Key Questions

**UI/UX Consistency:**
- Does the proposed UI follow the project's design system (spacing, typography, color, components)?
- Are interactions consistent with established patterns in the app? (e.g., how other lists sort/filter)
- Does it introduce new interaction patterns? If so, are they justified and documented?

**Interaction Quality:**
- Is the user flow intuitive? Can a new user complete the task without instructions?
- Are there unnecessary steps that could be eliminated?
- Does the feedback loop work? (user acts → system responds → user sees result)
- Are loading, error, and empty states designed — not just the happy path?
- **Is there "AI slop"?** — Generic AI aesthetic (purple gradients, excessive card grids, oversized padding) that signals low effort

**Accessibility (WCAG 2.1 AA):**
- Is the feature keyboard-navigable?
- Do all images/icons have appropriate alt text or aria-labels?
- Is color used as the sole indicator of meaning anywhere? (It shouldn't be.)
- Does text meet contrast requirements (4.5:1 normal, 3:1 large)?
- Is the reading order logical for screen readers?

**Responsive Design:**
- Does the design work at all target breakpoints? (mobile, tablet, desktop)
- Is touch-target size sufficient on mobile (≥44×44px)?
- Does content priority shift appropriately on smaller screens?

**Information Architecture:**
- Is the content organized logically?
- Is the most important information visible first?
- Are navigation paths clear? Can the user always get back?
- Is labeling clear and consistent?

#### Design Review Checklist

```markdown
### Design Review — [Feature Name]

#### Consistency
- [ ] Follows design system (spacing, color, typography)
- [ ] Interaction patterns match existing app behavior
- [ ] No unexplained new patterns

#### Usability
- [ ] User can complete task without instructions
- [ ] Feedback is immediate and clear for every action
- [ ] Loading, error, empty states are designed
- [ ] No "AI slop" aesthetic

#### Accessibility
- [ ] Keyboard navigable
- [ ] Screen reader compatible
- [ ] Color contrast meets WCAG AA
- [ ] No color-only indicators

#### Responsive
- [ ] Works at mobile, tablet, desktop breakpoints
- [ ] Touch targets ≥44×44px on mobile
- [ ] Content priority adapts to screen size

#### Information Architecture
- [ ] Content hierarchy is logical
- [ ] Navigation is clear
- [ ] Labels are consistent

#### Verdict: [GO / REVISE / NO-GO]
#### Key concerns:
```

---

### D. Developer Experience Review — "Will other developers want to use/maintain this?"

This perspective evaluates API ergonomics, documentation quality, configuration complexity, and learning curve. It prevents building features that work but are impossible for others to understand, integrate, or extend.

#### Key Questions

**API Ergonomics:**
- Is the API (internal or external) intuitive? Can a developer guess the method name?
- Are parameter names descriptive? (Not `opts`, `config`, `data` without context)
- Is the API consistent with other APIs in the project?
- Does it follow the principle of least surprise?

**Error Messages:**
- When something goes wrong, does the error message tell the developer what happened, why, and what to do next?
- Bad: `Error: invalid input`
- Good: `ValidationError: "email" must be a valid email address. Received: "not-an-email"`
- Are error codes documented and searchable?

**Documentation:**
- Is there a clear description of what this feature does and why?
- Are there code examples for common use cases?
- Are edge cases and limitations documented?
- Is the documentation maintained alongside the code (not in a separate wiki that goes stale)?

**Configuration Complexity:**
- How many steps does it take to start using this feature?
- Are sensible defaults provided? (Convention over configuration)
- Is the configuration validated with clear error messages?

**Learning Curve:**
- How long would it take a new developer to understand and use this feature?
- Target: <30 minutes to basic usage, <2 hours to advanced usage
- Are there progressive complexity levels (simple use case → advanced customization)?

**Maintenance Burden:**
- How much ongoing effort does this feature require?
- Are there operational concerns (monitoring, alerting, data migration)?
- What happens when dependencies are updated?

#### Developer Experience Review Checklist

```markdown
### DevEx Review — [Feature Name]

#### API
- [ ] Method/function names are intuitive
- [ ] Parameters are descriptive and well-typed
- [ ] Consistent with existing project APIs
- [ ] Follows least-surprise principle

#### Errors
- [ ] Error messages include what, why, and what-to-do-next
- [ ] Error codes are documented
- [ ] Errors are programmatically distinguishable (not just string matching)

#### Documentation
- [ ] Feature purpose and usage is documented
- [ ] Code examples for common use cases exist
- [ ] Edge cases and limitations are noted
- [ ] Docs live with code, not in a separate system

#### Configuration
- [ ] Sensible defaults provided
- [ ] Minimal steps to get started
- [ ] Configuration validation with helpful messages

#### Learning Curve
- [ ] New developer can reach basic usage in <30 minutes
- [ ] Progressive complexity from simple to advanced

#### Verdict: [GO / REVISE / NO-GO]
#### Key concerns:
```

## Usage Modes

### Full Four-Perspective Review

Use for major features, architecture changes, or anything requiring >1 week of implementation effort.

```
Run all four perspectives sequentially:
  Product → Engineering → Design → DevEx

Output: Comprehensive review report with findings from all four angles.
Time: ~30-60 minutes of review per perspective.
```

### Selective Review (2 Perspectives)

Use for medium-sized changes where only certain perspectives are relevant:

```
API-focused change     → Engineering + DevEx
User-facing feature    → Product + Design
Internal refactoring   → Engineering + DevEx
New user flow          → Product + Design + Engineering
```

### Quick Review (3-5 Questions per Perspective)

Use for smaller changes or time-constrained situations. Pick the 3 most important questions from each applicable perspective:

```
Quick Product:
  1. What user problem does this solve?
  2. Can the scope be smaller?
  3. Is the ROI justified?

Quick Engineering:
  1. Does it fit the architecture?
  2. What are the top 3 failure modes?
  3. What's the test strategy?

Quick Design:
  1. Is it consistent with the design system?
  2. Can a user complete the task without instructions?
  3. Is it accessible?

Quick DevEx:
  1. Is the API intuitive?
  2. Are error messages helpful?
  3. How long to learn and integrate?
```

## Output Format

### Review Report Template

```markdown
# Multi-Perspective Review — [Feature/Spec Name]

**Reviewed:** [Date]
**Spec/Doc:** [Link or reference]
**Review mode:** [Full / Selective / Quick]

---

## Product Perspective
**Verdict:** [GO / REVISE / NO-GO]

### Findings
1. [P1-Critical] [Finding title] — [Description and evidence]
2. [P2-Important] [Finding title] — [Description]
3. [P3-Suggestion] [Finding title] — [Description]

### Recommendations
- [Specific actionable recommendation]

---

## Engineering Perspective
**Verdict:** [GO / REVISE / NO-GO]

### Findings
1. [E1-Critical] ...
2. [E2-Important] ...

### Recommendations
- ...

---

## Design Perspective
**Verdict:** [GO / REVISE / NO-GO]

### Findings
1. [D1-Critical] ...
2. [D2-Important] ...

### Recommendations
- ...

---

## DevEx Perspective
**Verdict:** [GO / REVISE / NO-GO]

### Findings
1. [X1-Critical] ...
2. [X2-Important] ...

### Recommendations
- ...

---

## Overall Assessment

**Overall verdict:** [GO / REVISE / NO-GO]

**Critical blockers (must resolve before implementation):**
1. ...

**Important issues (should resolve, can discuss):**
1. ...

**Suggestions (optional improvements):**
1. ...

**Risk level:** [Low / Medium / High]
```

### Severity Definitions

| Level | Meaning | Action Required |
|-------|---------|-----------------|
| **Critical** | Blocks implementation. Security risk, fundamentally wrong approach, or will definitely fail. | Must resolve before proceeding. |
| **Important** | Significant concern. Will cause problems if ignored but has potential workarounds. | Should resolve. Discuss if disagreed. |
| **Suggestion** | Nice to have. Improvement that isn't strictly necessary. | Author's discretion. |

## Integration with SDD+TDD Workflow

Multi-perspective review fits as an optional gate between Spec and Plan:

```
Spec (what to build)
    │
    ▼
Multi-Perspective Review ← THIS SKILL (optional gate)
    │
    ▼
Plan (how to build it)
    │
    ▼
Implementation (TDD cycles)
    │
    ▼
Code Review (code-review-and-quality)
    │
    ▼
Verification (verification-before-completion)
```

**When to gate:** Use the review as a hard gate (must pass before proceeding) for high-risk changes. Use as advisory (review findings inform but don't block) for lower-risk changes.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We don't have time for a multi-perspective review" | You don't have time to rebuild a feature because you solved the wrong problem. A 2-hour review prevents 2-week rewrites. |
| "Engineering review is enough" | Engineering review catches engineering problems. It doesn't catch "nobody will use this" or "nobody can figure out how to use this." |
| "The PM already approved this" | Approval is not review. A PM saying "yes, build this" is different from stress-testing the spec from four angles. |
| "We'll get feedback after launch" | Post-launch feedback costs 10x more to act on. Some problems (wrong architecture, bad API design) can't be fixed incrementally. |
| "This is just an internal tool" | Internal users deserve good UX and DevEx too. Bad internal tools slow down the entire team. |

## Red Flags

- Specs that go straight to implementation without any review
- Reviews that only check the engineering perspective
- "Approved" without documented findings — rubber-stamp reviews
- No product perspective on user-facing features
- No design review on features with UI changes
- No DevEx review on features that expose APIs or SDKs
- Skipping review because "it's a small change" (small changes can have large impacts)
- Review findings that are acknowledged but never addressed

## Verification

After completing a multi-perspective review:

- [ ] All applicable perspectives have been evaluated
- [ ] Critical findings are listed with clear resolution requirements
- [ ] Each perspective has an explicit verdict (GO / REVISE / NO-GO)
- [ ] Overall assessment and risk level are documented
- [ ] Actionable recommendations are specific (not "improve the UX")
- [ ] Review report is attached to the spec/plan for traceability
- [ ] Blocking issues are resolved before implementation begins
