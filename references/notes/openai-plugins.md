# OpenAI Plugins

Source: `https://github.com/openai/plugins`

## Status

Active official Codex plugin reference. It supersedes `openai/skills` as the current first-party example repository.

## Latest Remote Evidence

- remote head: `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`
- observed date: 2026-07-29
- evidence: shallow clone plus review of `README.md`, marketplace manifests, `plugin-eval`, and plugin-level agent / command / hook examples
- important correction: a Codex plugin can contain `skills/`, plugin-level `agents/`, `commands/`, `hooks.json`, assets, and MCP/app configuration around the required `.codex-plugin/plugin.json`

## Extractable Upgrades

- Treat `.codex-plugin/plugin.json` as the stable identity and keep optional surfaces beside it instead of encoding all content into the manifest.
- Package native plugin agents and commands when the target platform supports them; do not force every role through a user-level config merge.
- Keep marketplace policy, plugin content, and user authentication lifecycle as separate concerns.
- Add a skill / plugin evaluation loop with static checks, token-budget explanations, representative scenarios, baseline comparison, and a prioritized improvement brief.
- Keep public marketplace distribution distinct from local or Git marketplace development and team distribution.

## Non-Adoption Boundary

- Do not copy connector credentials, app registrations, MCP binaries, vendor assets, or third-party plugin content.
- Do not assume every ChatGPT plugin capability is available in every Codex surface.
- Keep user-level custom-agent registration only as a compatibility path for legacy direct installs; plugin-native agents are the preferred packaged surface.
- Do not ingest the deprecated `openai/skills` catalog as a new active upstream.

## Recommended Phase

- Phase 1: generate native plugin agents and commands and retain deterministic plugin manifests.
- Phase 2: add reusable skill authoring and evaluation guidance.
- Phase 3: consider a local executable evaluation harness only after its report schema and maintenance owner are stable.
