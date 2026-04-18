# Spec: AI Coding Toolkit Monorepo Rearchitecture

## Assumptions
1. This rearchitecture does **not** need to preserve the current top-level layout or legacy entry-file locations.
2. The future repository should be a multi-package monorepo with independently versioned/published packages.
3. `zc` should evolve from a runtime-only CLI into the unified operator CLI for the whole workspace.
4. `toolkit` should be the single source of truth for skills, commands, and agents.
5. Platform-specific files such as `QWEN.md`, `AGENTS.md`, and `instructions.md` should become generated artifacts, not hand-maintained source files.
6. Upstream references remain strategically important and must be maintained as a first-class governance layer with manual-review sync.

## Objective
Restructure the repository into a clean monorepo with explicit boundaries between:
- runtime execution (`zc` CLI)
- content/tooling assets (`toolkit`)
- platform packaging/install surfaces (`platform-*`)
- upstream governance (`references`)
- documentation and architecture records (`docs`)

The rearchitecture should eliminate the current root-level mixing of runtime code, content assets, platform entry files, installers, and upstream management concerns.

## Tech Stack
- Workspace/package manager: `pnpm`
- Task orchestration: `turbo`
- Publishing/versioning: `changesets`
- Runtime language: TypeScript / Node.js 20+
- Test framework: Vitest
- Documentation/content format:
  - asset metadata: YAML
  - asset body: Markdown

## Commands
- Install workspace deps: `pnpm install`
- Lint workspace: `pnpm lint`
- Test workspace: `pnpm test`
- Build workspace: `pnpm build`
- Generate platform artifacts: `pnpm generate`
- Verify full workspace: `pnpm verify`
- Review release state: `pnpm changeset status`
- Publish packages: `pnpm changeset publish`

Expected future CLI surface:

```bash
zc runtime run ...
zc runtime team start ...

zc toolkit validate
zc toolkit build

zc platform generate qwen
zc platform install qwen
zc platform install codex
zc platform install qoder

zc upstream diff
zc upstream review
```

## Project Structure
Target structure:

```text
repo/
├── apps/
│   └── cli/                  # zc: runtime CLI + workspace operator CLI
├── packages/
│   ├── toolkit/              # single source of truth for skills/commands/agents
│   ├── platform-qwen/        # Qwen generation/install implementation
│   ├── platform-codex/       # Codex generation/install implementation
│   └── platform-qoder/       # Qoder/Cursor generation/install implementation
├── references/               # upstream governance, diffs, notes, snapshots
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── specs/
│   └── plans/
├── scripts/                  # workspace-level helper scripts
├── tests/                    # cross-package integration/verification
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### Toolkit internal content model

```text
packages/toolkit/
├── src/
│   ├── content/
│   │   ├── skills/
│   │   ├── commands/
│   │   └── agents/
│   ├── schema/
│   ├── loaders/
│   ├── generators/
│   ├── manifests/
│   └── index.ts
└── templates/
```

Each asset unit should use:

```text
<asset>/
├── meta.yaml
├── body.md
└── assets/
```

## Code Style
Architectural code should favor explicit boundaries and manifest-driven generation over implicit directory scanning.

Example:

```ts
const assets = await loadToolkitManifest();
const qwenAssets = assets.filter((asset) => asset.platforms.includes("qwen"));
await generateQwenPackage(qwenAssets);
```

Conventions:
- `apps/cli` orchestrates; it does not own toolkit content.
- `packages/toolkit` owns content and metadata; it does not implement platform-specific install flows.
- `packages/platform-*` adapt toolkit content into platform artifacts; they do not define content.
- `references` is governance-only and never a runtime dependency for generated output.
- Build/generate steps consume structured manifests, not ad hoc filesystem assumptions.

## Testing Strategy
### Package-level
- `apps/cli`
  - command routing
  - runtime workflows
  - integration with toolkit/platform package APIs
- `packages/toolkit`
  - schema validation
  - manifest generation
  - loader behavior
- `packages/platform-*`
  - generation correctness
  - install behavior
  - artifact smoke tests

### Cross-package
- workspace integration tests in `tests/`
- verify generated platform artifacts from toolkit input
- verify `zc` commands can invoke toolkit/platform workflows end-to-end

### Verification gates
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm generate`
- `pnpm verify`

## Boundaries
- Always:
  - Keep `toolkit` as the only content source of truth.
  - Keep platform artifacts generated, not hand-maintained.
  - Keep upstream sync manual-review only.
  - Record major architecture decisions in `docs/adr/`.
- Ask first:
  - Introducing additional top-level apps or packages not covered by this spec
  - Changing publishing strategy away from independent package releases
  - Replacing `pnpm` / `turbo` / `changesets`
- Never:
  - Reintroduce duplicated skills/commands/agents content across packages
  - Let `apps/cli` absorb platform implementation logic directly
  - Let platform packages become alternate sources of truth
  - Auto-merge upstream content directly into published packages

## Success Criteria
1. The repository is reorganized into a workspace with `apps/`, `packages/`, `references/`, `docs/`, `scripts/`, and `tests/`.
2. `zc` becomes the unified workspace/operator CLI while retaining runtime capabilities.
3. `toolkit` becomes the only source of truth for skills, commands, and agents.
4. Platform-specific outputs are generated from toolkit content by dedicated `platform-*` packages.
5. Legacy root-level hand-maintained platform entry files are removed from the source model.
6. Upstream references are managed through a dedicated governance layer with explicit review metadata.
7. Workspace build/test/generate/verify flows are standardized and runnable from the root.
8. Package publishing/versioning is independently managed across workspace packages.

## Open Questions
- None blocking for the architecture direction. Remaining work is migration planning and implementation sequencing.
