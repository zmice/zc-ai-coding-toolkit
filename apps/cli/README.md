# @zmice/zc

`@zmice/zc` is the operator/runtime CLI for the AI Coding Toolkit workspace.

This package preserves the current `zc` runtime behavior and keeps the command surface compatible while introducing the future namespace layout:

- `zc runtime ...`
- `zc toolkit ...`
- `zc platform ...`
- `zc upstream ...`

The CLI discovers prompt assets from `packages/toolkit/src/content` and does not own prompt content itself.
