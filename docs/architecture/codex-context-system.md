# Codex Context System

## Goal

Codex context should let an agent understand a project quickly without loading the whole repository or turning `AGENTS.md` into a long manual.

The system has three commands:

- `context init`: build the first project context from real repository evidence
- `context update`: refresh managed context after meaningful project changes
- `context doctor`: report stale, missing, conflicting, or oversized context without writing files

## Progressive Disclosure

The root entry remains thin. It should only contain global rules, routing hints, and links to managed context.

Managed context is layered:

- `.codex/context/manifest.json`: generation metadata, source paths, budgets, and freshness markers
- `.codex/context/project.md`: project purpose, boundaries, main modules, and source-of-truth rules
- `.codex/context/commands.md`: install, test, build, lint, release, and verification commands
- `.codex/context/modules/README.md`: module index and when to read each module note
- `.codex/context/modules/<module>.md`: optional concise module-specific facts for large projects
- `.codex/context/docs.md`: long-term docs index, ADR index, and reading order

Projects may keep `.codex/context/**` local or commit it. The command must respect the repository policy instead of assuming every project wants generated context in Git.

## Command Contract

### `context init`

`context init` is not a template generator. It must inspect the project and write a compact first context.

Minimum evidence:

- repository layout
- package/build files
- test and verification commands
- existing README/docs/ADR structure
- entry files and platform-specific agent files
- obvious generated/dist paths to avoid

Minimum output:

- managed context files
- a short summary of what was inferred
- unresolved questions
- source paths used as evidence

### `context update`

`context update` refreshes existing managed context.

It should be incremental:

- preserve manual notes outside managed blocks
- update only managed files or managed sections
- detect removed modules and renamed commands
- show a write plan before broad rewrites

### `context doctor`

`context doctor` is read-only.

It should flag:

- missing required context files
- context that references deleted paths or commands
- context older than important project changes
- entry files that became too large
- contradictions between `AGENTS.md`, `.codex/context/**`, README, and docs
- files that violate local ignore/commit policy

## Documentation Rules

Not every task creates long-term docs.

Each task should decide:

```yaml
docs_required: no | context-only | decision-note | architecture-doc | release-doc
reason:
public_surface_changed:
context_update_required:
target_docs:
```

Use long-term docs only for durable facts:

- architecture decisions
- public install or update flow
- public API or platform behavior
- release or compatibility changes
- project structure that future agents must know
- requirement changes that alter durable behavior, contracts, ownership, or future maintenance rules

Use task ledgers for process recovery and fan-in. Do not promote execution logs, temporary plans, routine requirement churn, or unverified exploration into `docs/`.

## Verification

Minimum checks for implementation:

- `context init` produces concise context on a fixture repo
- `context doctor` exits non-zero for missing/stale managed context
- `context update` preserves manual content outside managed blocks
- root entry files remain below the configured context budget
- docs-only context changes pass `git diff --check`
