# ADR 0004: Codex Marketplace First Runtime Boundary

Status: Accepted, amended 2026-07-29

## Context

`zc-toolkit` now targets Codex plugin distribution. The user-facing install and update path should follow the Codex marketplace Git flow instead of asking users to run a custom `zc` install command first.

At the same time, some capabilities still require runtime behavior that a static Codex skill cannot provide by itself:

- upstream remote fetch and content diff
- project context `init / update / doctor`
- multi-agent dispatch, task ledgers, ownership checks, and fan-in validation
- release packaging and marketplace bundle publishing

The project therefore needs a clear boundary between Codex-native plugin UX and maintainer/runtime tooling.

## Decision

Codex marketplace is the primary user-facing distribution path for Codex users.

The `zc` CLI is demoted from "main user install path" to maintainer and runtime tooling. It may still build, validate, export, publish, diagnose, and operate workflows that require filesystem or network access.

Codex plugin assets remain Codex-native:

- skills are exposed through marketplace-installed plugin skills
- commands and agents are distributed as plugin-level directories beside the manifest
- root `AGENTS.md` stays a thin entry and routing file
- generated project context is loaded progressively, not embedded into the entry file
- users should not need to understand internal `zc` commands before using the Codex plugin
- user install/update should prefer native Codex marketplace Git commands over hand-editing global config
- skill bodies stay platform-neutral; Codex bootstrap, marketplace metadata, and update behavior live in platform adapters and release automation

Runtime-requiring features must choose one of these execution homes:

1. maintainer CLI or repo scripts
2. future Codex plugin MCP/app capability, if available
3. documented manual fallback when the platform cannot execute the action

Static skill text must not pretend it can perform remote fetches, install updates, spawn writable agents, or validate fan-in without a real runtime.

Plugin Markdown agents are a packaged discovery and instruction boundary, not the explicit session-configuration boundary:

- the plugin bundle contains `agents/*.md`; no user config mutation is required for the native surface
- `commands/`, `agents/`, and `hooks.json` are sibling plugin surfaces shown by the official `openai/plugins` repository, not invented manifest fields
- the bundle additionally carries inert, hash-addressed TOML agents under `assets/zc-agents/` for documented standalone custom-agent session settings
- only explicit `--with-agents` consumes that runtime-configuration payload; writes and removals remain receipt-owned

## Consequences

- Codex docs and release flow should prioritize marketplace install/update.
- Codex plugin Markdown agents ship with the marketplace bundle. `zc platform agents codex` and `--with-agents` remain the supported path for explicit per-role `model`, `model_reasoning_effort`, and `sandbox_mode` settings.
- Legacy `zc platform install codex` remains useful for development, tests, and migration, but is not the preferred user path.
- Feature specs must name their runtime boundary before implementation.
- Context and multi-agent features can ship in stages: skill protocol first, then runtime automation where the platform supports it.
- The repository should avoid adding large generated context or workflow transcripts to root entry files.
- Platform-specific install details must not leak back into canonical `packages/toolkit` content beyond explicit capability boundaries.
