# @zmice/toolkit

`@zmice/toolkit` is the source-of-truth content package for the AI Coding Toolkit workspace.

It owns the structured prompt asset model:

- `skills`
- `commands`
- `agents`

Each asset is stored as:

- `meta.yaml`
- `body.md`
- optional `assets/`

Consumers such as `@zmice/zc` and `@zmice/platform-*` read this package rather than maintaining duplicate prompt content.
