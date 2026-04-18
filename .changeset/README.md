# Changesets

This directory stores workspace release metadata for the monorepo packages.

- `config.json` defines release behavior
- individual markdown files record pending package version changes
- use `pnpm release:check` before `pnpm changeset version`
- use `pnpm release:check:post-version` after `pnpm install`

The repository uses independent package versioning.
