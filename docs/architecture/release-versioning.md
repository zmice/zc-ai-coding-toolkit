# Release / Versioning Spec

## Objective

Define the workspace release model for the monorepo and remove ambiguity around:

- which packages are published independently
- how changesets drive version selection
- how internal dependencies are updated when a dependency is released
- what the first public release must do and verify
- what a future release guide must cover

This spec is the source of truth for release behavior. It does not change code or package metadata by itself.

## Assumptions

- `apps/cli` and the packages under `packages/` are the release surface.
- `docs/`, `references/`, `scripts/`, and `tests/` are not publishable artifacts.
- The first release means the first public registry publish from the current workspace shape, not a one-time special workflow that bypasses changesets.
- Release policy should prefer independent package versioning over lockstep workspace versioning.

## Package Matrix

| Package | Release mode | Notes |
| --- | --- | --- |
| `@zmice/toolkit` | Independent | Canonical content package. Publishes on its own cadence. |
| `@zmice/platform-core` | Independent | Shared platform contract package consumed by `zc` and `platform-*`. |
| `@zmice/platform-codex` | Independent | Platform-specific packaging and generation package. |
| `@zmice/platform-qoder` | Independent | Platform-specific packaging and generation package. |
| `@zmice/platform-qwen` | Independent | Platform-specific packaging and generation package. |
| `@zmice/zc` | Independent | Operator/runtime CLI. Publishes independently from platform packages. |

Non-published workspace areas:

- `docs/**`
- `references/**`
- `scripts/**`
- `tests/**`

## Commands

Use these commands as the release entry points:

- Sync workspace metadata after versioning: `pnpm install`
- Inspect pending release state: `pnpm changeset status`
- Apply version updates: `pnpm changeset version`
- Publish release artifacts: `pnpm release`
- Workspace verification before publish: `pnpm verify`

Release-time checks must also include a clean git status and confirmation that the intended packages are the only packages being released.

## Changeset Rules

### Core rules

- One changeset records one release intent.
- A changeset may cover multiple packages if they change as one user-visible unit.
- Package version bumps must be driven by changesets, not by manual edits to `package.json`.
- Releases should use the smallest bump that matches the change:
  - `patch` for bug fixes, content-only corrections, and internal dependency-only updates
  - `minor` for additive, backward-compatible behavior or new surface area
  - `major` for breaking changes

### No ambiguous release bundles

- If two packages change for unrelated reasons, they should have separate changesets.
- If a change crosses package boundaries and the behavior is coupled, one shared changeset is preferred over two disconnected ones.
- Documentation-only edits do not require a package version bump unless they alter published package metadata or shipped artifacts.

### Changeset config expectation

The workspace should keep independent versioning and use `updateInternalDependencies: patch` as the default release policy. That means dependent packages are revised when an internal dependency changes, but the dependency-driven bump should stay as small as possible.

## Internal Dependency Strategy

### Development-time dependency form

Workspace source should remain linked with workspace protocol dependencies during local development. The source tree should not require manual version pinning just to keep packages usable in the monorepo.

### Release-time dependency update rule

When a package is versioned, every direct dependent that consumes it must be evaluated by changesets:

- if the dependent exposes or relies on the dependency in a user-visible way, bump the dependent
- if the dependent only imports it internally and the update is non-breaking, a patch bump is sufficient
- if the dependent depends on a breaking change, the dependent must receive at least the bump level required by the breakage

### Practical implication

- `@zmice/zc` is a direct dependent of `@zmice/toolkit` and `@zmice/platform-core`.
- Every `@zmice/platform-*` package is also a direct dependent of `@zmice/platform-core`.
- A release that changes `@zmice/toolkit` should trigger a version review for `@zmice/zc`.
- A release that changes `@zmice/platform-core` should trigger a version review for `@zmice/zc` and every `@zmice/platform-*` package.
- Platform package releases should not force unrelated platform packages to move.
- No package should ship with stale internal dependency references after versioning.

## First Release Flow

The first public release uses the same changeset-driven pipeline as later releases. The difference is that the release owner must explicitly confirm the bootstrap set of packages before publishing.

### Required preflight

1. Run `pnpm changeset status` and confirm the release set is intentional.
2. Run `pnpm verify` and confirm the workspace is healthy before versioning.
3. Confirm the git worktree is clean except for the intended release metadata.
4. Confirm the target package versions are acceptable for a first public publish.

### Bootstrap release sequence

1. Create or confirm the release changeset for the packages that should ship first.
2. Run `pnpm changeset version`.
3. Run `pnpm install` to sync any manifest or lockfile updates.
4. Re-run `pnpm verify` after versioning to catch manifest or dependency drift.
5. Run `pnpm changeset status` again to confirm the planned batch is still correct.
6. Publish with `pnpm release`.

### Release checks

The first release must verify:

- package versions match the intended public semver line
- only the intended packages are published
- internal dependency updates were applied to dependents
- the workspace still passes verification after version bumping

## Release Guide Skeleton

The operational release guide should eventually cover these sections:

1. Purpose and release ownership
2. Package release matrix
3. Preflight checklist
4. Changeset authoring rules
5. Internal dependency update rules
6. First release bootstrap flow
7. Standard publish flow
8. Post-publish verification
9. Abort and rollback notes

This spec intentionally defines the skeleton only. The guide can later be expanded into an operator-facing playbook without changing the policy here.

## Stage 2 Artifacts

The first implementation pass for this policy lives in:

- [docs/release-guide.md](../release-guide.md)
- [docs/release-checklist.md](../release-checklist.md)
- [scripts/release-check.mjs](../../scripts/release-check.mjs)

These artifacts are intentionally minimal. They do not replace this spec; they operationalize the current release rules without changing package code.

## Boundaries

- Always:
  - use changesets to drive version selection
  - run `pnpm changeset status` before publish
  - run `pnpm verify` before and after versioning
  - keep independent release boundaries between packages
  - treat internal dependency updates as part of release planning
- Ask first:
  - changing the release model from independent to fixed versioning
  - publishing any package for the first time
  - changing package scopes, names, or registry access policy
  - introducing a release automation workflow that bypasses changesets
- Never:
  - manually edit package versions outside the release flow
  - publish a package without confirming dependent updates
  - hide a breaking change inside a patch release
  - change code or package manifests in this spec file

## Testing Strategy

This spec is verified by release-oriented checks rather than unit tests:

- `pnpm changeset status` must match the documented release model
- `pnpm verify` must pass before and after versioning
- `pnpm changeset version` should be the only version mutation path
- the release batch should be reviewable from changeset metadata alone

## Success Criteria

- The workspace has a clear list of independently released packages.
- Internal dependency updates follow a documented, repeatable rule.
- The first release has a concrete command sequence and gate checks.
- The release guide has a defined outline that future docs can expand.
- The spec is stored only in `docs/architecture/release-versioning.md`.

## Open Questions

- Should the first public release publish all five packages together, or only the packages that are ready?
- Should `@zmice/zc` remain on its current version line, or be reset to match the other packages before the first publish?
- Do we want a future fixed-version mode, or is independent versioning the permanent policy?
