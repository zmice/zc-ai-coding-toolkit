# OpenAI Plugins

Source: `https://github.com/openai/plugins`

## Status

Archived official Codex plugin example repository. It superseded `openai/skills` as the first-party example repository, but it is no longer the active source of truth for current Codex runtime behavior.

Use it as historical evidence for plugin directory structure. Use the current Codex Plugins, Subagents, and Config Reference documentation for supported installation, configuration, orchestration, and permission behavior.

Current sources:

- `https://developers.openai.com/plugins/build/plugins`
- `https://learn.chatgpt.com/docs/agent-configuration/subagents`
- `https://learn.chatgpt.com/docs/config-file/config-reference`

## Latest Remote Evidence

- remote head: `11c74d6ba24d3a6d48f54a194cd00ef3beea18f9`
- observed date: 2026-08-17
- remote content status: unchanged from the 2026-07-29 snapshot
- repository lifecycle: archived by OpenAI on 2026-08-16 and now read-only
- evidence: `pnpm upstream -- report openai-plugins --format md --with-remote`, the archived GitHub repository page, and current official Codex Plugins / Subagents documentation
- important correction: a Codex plugin can contain `skills/`, plugin-level `agents/`, `commands/`, `hooks.json`, assets, and MCP/app configuration around the required `.codex-plugin/plugin.json`

## Extractable Upgrades

- Treat `.codex-plugin/plugin.json` as the stable identity and keep optional surfaces beside it instead of encoding all content into the manifest.
- Keep plugin-level agents and commands as a packaged surface where the target runtime discovers them, but do not infer current subagent configuration or lifecycle semantics from the archived example repository.
- Keep standalone `~/.codex/agents/*.toml` / `.codex/agents/*.toml` and `[agents]` configuration as the current documented custom-agent control surface for model, reasoning, sandbox, MCP, skills, concurrency, and interrupt behavior.
- Keep marketplace policy, plugin content, and user authentication lifecycle as separate concerns.
- Add a skill / plugin evaluation loop with static checks, token-budget explanations, representative scenarios, baseline comparison, and a prioritized improvement brief.
- Keep public marketplace distribution distinct from local or Git marketplace development and team distribution.

## Non-Adoption Boundary

- Do not copy connector credentials, app registrations, MCP binaries, vendor assets, or third-party plugin content.
- Do not assume every ChatGPT plugin capability is available in every Codex surface.
- Do not remove standalone TOML custom agents or `[agents.*] config_file` compatibility based only on the archived repository's plugin-level agent examples.
- Do not treat repository archival as removal of installed plugin support; it changes the governance source priority, not the local artifact contract by itself.
- Do not ingest the deprecated `openai/skills` catalog as a new active upstream.

## Recommended Phase

- Delivered: generate plugin agents and commands, retain deterministic plugin manifests, and keep receipt-backed TOML companion agents for direct-install compatibility.
- Current: treat official Codex Subagents documentation and the installed runtime as the active multi-agent alignment baseline.
- Next: align custom-agent configuration, native orchestration policy, and lifecycle smoke tests before expanding the role catalog.
