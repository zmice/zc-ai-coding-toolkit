# Spec: zc Runtime Hardening and Repository Structure Clarification

## Assumptions
1. This iteration should prioritize making `zc` reliable before doing large-scale repository reorganization.
2. We should avoid changing published install contracts for Qwen/Codex/Qoder unless there is a clear structural payoff.
3. `QWEN.md`, `AGENTS.md`, and `instructions.md` are currently platform entry artifacts, not just internal docs.
4. The current dirty worktree contains unrelated user edits, so this change must stay narrowly scoped.
5. We are allowed to add project documentation and refactor `zc` internals, but should ask before changing external package names or install UX.

## Objective
Stabilize the `zc` multi-agent runtime so that workers, tasks, shutdown, and dispatch behave correctly in real execution, then clarify whether the repository layout should change and how platform-specific context files should be organized.

This work has two outputs:
1. A reliable `zc` orchestration runtime with a closed task lifecycle.
2. A documented repository structure policy, especially for `QWEN.md`, `AGENTS.md`, and related platform adapter files.

## Tech Stack
- Repository: Markdown-based agent toolkit + shell/PowerShell installers
- Runtime: Node.js 20+, TypeScript, Commander, Vitest
- Packaging surfaces:
  - Qwen Code extension via `qwen-extension.json`
  - Codex via `AGENTS.md` + `.codex/skills/`
  - Qoder/Cursor via install scripts and `instructions.md`

## Commands
- Runtime type-check: `cd zc && npm run lint`
- Runtime tests: `cd zc && npm test -- --run`
- Runtime build: `cd zc && npm run build`
- CLI smoke check: `node zc/dist/cli/index.js --help`
- CLI version check: `node zc/dist/cli/index.js --version`

## Project Structure
### Current structure
- `skills/` → reusable workflow assets
- `commands/` → slash command dispatchers
- `agents/` → role prompts
- `QWEN.md` → Qwen extension context entry file
- `AGENTS.md` → Codex context entry file
- `instructions.md` → Qoder/Cursor instruction entry file
- `qwen-extension.json` → Qwen extension manifest
- `install.sh` / `install.ps1` → platform installation scripts
- `zc/` → TypeScript CLI runtime

### Intended structure after this change
- Keep root as the packaging and distribution surface.
- Keep `QWEN.md` at root for now because the current Qwen extension manifest and repository docs treat it as a root entry artifact.
- Add documentation under `docs/specs/` for design and refactor decisions.
- Limit code changes in this iteration to `zc/` plus any minimal docs/scripts updates needed to keep packaging metadata consistent.

### Possible later structure optimization
- Introduce a `platform/` or `contexts/` source directory as the canonical home for platform-specific context files.
- Generate or sync root-facing artifacts (`QWEN.md`, `AGENTS.md`, `instructions.md`) from those sources during release/install time.
- Do this only in a separate follow-up if we want stronger separation between source assets and published entrypoints.

## Code Style
TypeScript runtime changes should prefer explicit state transitions over implicit behavior.

```ts
if (task.status === "in_progress" && worker.exitCode === 0) {
  await queue.transition(task.id, token, "completed");
  manager.markIdle(worker.id);
}
```

Conventions:
- Keep orchestration state transitions explicit and testable.
- Prefer small methods with clear ownership over hidden side effects.
- Do not depend on environment-installed CLIs in unit tests; mock process execution boundaries.

## Testing Strategy
- Keep unit tests around queue, worker manager, session/worktree manager, and adapters.
- Add regression tests for:
  - worker completes successfully and becomes idle again
  - task transitions to `completed` on normal exit
  - dispatch loop runs exactly once per scheduler model
  - shutdown persists final state and does not leave stale active assignments
- Refactor flaky integration tests so they do not depend on stale `dist/` output or host-specific CLI behavior.
- Verification gate for completion:
  - `cd zc && npm run lint`
  - `cd zc && npm test -- --run`
  - `cd zc && npm run build`

## Boundaries
- Always:
  - Preserve user-visible install paths unless explicitly approved to change.
  - Keep `zc` behavior compatible with existing CLI command names.
  - Verify with lint, tests, and build before claiming completion.
- Ask first:
  - Moving or renaming `QWEN.md`, `AGENTS.md`, `instructions.md`
  - Changing `qwen-extension.json` manifest contract
  - Reorganizing top-level directories in a way that affects installation or publishing
- Never:
  - Mix large repository relocation with runtime fixes in one unreviewed step
  - Break current platform entry files without a migration path
  - Trust passing sub-tests without running the full `zc` verification commands

## Success Criteria
1. `zc` workers can execute more than one task over time because completed tasks transition to `completed` and workers return to `idle`.
2. There is only one dispatch mechanism in normal execution, with no duplicate scheduler loops.
3. Team shutdown leaves state consistent: no stale active assignments and no misleading persisted status.
4. `cd zc && npm run lint`, `npm test -- --run`, and `npm run build` all pass.
5. CLI/package metadata is internally consistent, including version reporting.
6. Repository structure guidance is documented:
   - Immediate decision: keep `QWEN.md` at root as the published Qwen entry artifact.
   - Structural recommendation: if deeper cleanup is desired later, move to a source-vs-artifact model rather than directly hiding platform entry files.

## Open Questions
1. Do you want this iteration to only document the structure policy, or also perform a light repository cleanup after `zc` is fixed?
2. If we later introduce `platform/` or `contexts/`, do you want generated root artifacts, or do you prefer keeping the repo root human-editable?
3. Should top-level cleanup include moving `zc` into `packages/zc/`, or is that out of scope for now?
