import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  capability,
  createCodexAgentGenerationPlan,
  createCodexAgentInstallPlan,
  createCodexContextInitPlan,
  createCodexGenerationPlan,
  createCodexInstallPlan,
  createCodexMarketplaceGenerationPlan,
  createCodexPluginGenerationPlan,
  packageName,
  platformName,
  templateFiles,
  type ToolkitManifestLike,
} from "./index.js";

const manifest: ToolkitManifestLike = {
  source: "toolkit-manifest",
  assets: [
    {
      id: "skill-alpha",
      kind: "skill",
      platforms: ["qwen", "codex"],
      title: "Alpha skill",
    },
    {
      id: "command:start",
      kind: "command",
      platforms: ["codex"],
      title: "Start command",
      name: "start",
      summary: "统一任务开始入口",
      body: "# 开始\n\n先判断工作流类型，再选择入口。\n",
    },
    {
      id: "command:context-init",
      kind: "command",
      platforms: ["codex"],
      title: "Context init command",
      name: "context-init",
      summary: "初始化 Codex 项目上下文索引。",
      body: "# 上下文初始化\n\n生成渐进式披露的项目上下文索引。\n",
    },
    {
      id: "command:api",
      kind: "command",
      platforms: ["codex"],
      title: "API command",
      name: "api",
      summary: "设计和审查 API 接口。",
      body: "# API\n\n设计和审查 API 接口。\n",
    },
    {
      id: "agent:code-reviewer",
      kind: "agent",
      platforms: ["codex"],
      title: "Code reviewer",
      summary: "Review code changes for correctness and risk.",
      body: "Review code like an owner. Prioritize correctness, security, behavior regressions, and missing tests.",
      tools: ["Read", "Edit"],
    },
  ],
};

describe("@zmice/platform-codex scaffold", () => {
  it("includes skill supporting files in a Codex marketplace bundle", () => {
    const attachmentManifest: ToolkitManifestLike = {
      source: "toolkit-manifest",
      assets: [
        {
          id: "skill:alpha",
          kind: "skill",
          platforms: ["codex"],
          title: "Alpha skill",
          body: "See `references/guide.md`.",
          attachments: [
            {
              relativePath: "assets/references/guide.md",
              contents: "# Guide\n",
            },
          ],
        },
      ],
    };

    const plan = createCodexMarketplaceGenerationPlan(attachmentManifest);

    assert.ok(
      plan.artifacts.some(
        (artifact) =>
          artifact.path === "plugins/zc-toolkit/skills/alpha/references/guide.md"
          && artifact.content === "# Guide\n",
      ),
    );
  });

  it("creates a Codex project context init plan", () => {
    const plan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      projectSummary: "Demo service for testing project context generation.",
      readmeTitle: "Demo",
      readmeSummary: "A compact fixture that exercises context generation.",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
      },
      directories: ["apps", "packages"],
      moduleSummaries: [
        {
          path: "apps/web",
          name: "@demo/web",
          description: "Web application",
          scripts: ["test", "build"],
        },
      ],
      docPaths: ["README.md", "docs/README.md", "docs/adr"],
      entryFiles: ["AGENTS.md", "package.json"],
      generatedPaths: ["apps/web/dist"],
      sourcePaths: ["README.md", "package.json", "apps/web/package.json"],
      unresolvedQuestions: ["确认部署入口。"],
      existingFiles: [
        {
          relativePath: "AGENTS.md",
          content: "# Existing\n\n- Keep.\n",
        },
      ],
      generatedAt: "2026-06-12T00:00:00.000Z",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.relativePath), [
      "AGENTS.md",
      ".codex/context/project.md",
      ".codex/context/commands.md",
      ".codex/context/modules/README.md",
      ".codex/context/docs.md",
      ".codex/context/manifest.json",
    ]);
    assert.equal(plan.summary.creates, 5);
    assert.equal(plan.summary.updates, 1);
    assert.equal(plan.initializedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(plan.generatedAt, "2026-06-12T00:00:00.000Z");
    assert.ok(plan.artifacts[0]?.content.includes("# Existing"));
    assert.ok(plan.artifacts[0]?.content.includes("<!-- zc-context:init:start -->"));
    assert.ok(plan.artifacts[0]?.content.includes("Demo service for testing project context generation."));
    assert.ok(plan.artifacts[1]?.content.includes("<!-- zc-context:managed -->"));
    assert.ok(plan.artifacts[1]?.content.includes("Initialized by `zc context init` at 2026-06-12T00:00:00.000Z."));
    assert.ok(plan.artifacts[1]?.content.includes("Last refreshed at 2026-06-12T00:00:00.000Z."));
    assert.ok(plan.artifacts[1]?.content.includes("## 项目速览"));
    assert.ok(plan.artifacts[1]?.content.includes("`apps/web`：package: `@demo/web`"));
    assert.ok(plan.artifacts[1]?.content.includes("`apps/web/dist`"));
    assert.ok(plan.artifacts[1]?.content.includes("确认部署入口。"));
    assert.ok(plan.artifacts[2]?.content.includes("`pnpm test`: `vitest run`"));
    assert.ok(plan.artifacts[3]?.content.includes("Web application"));
    assert.ok(plan.artifacts[4]?.content.includes("Documentation Index"));
    assert.ok(plan.artifacts[4]?.content.includes("`docs/adr`"));
  });

  it("keeps context init idempotent when managed files are unchanged", () => {
    const firstPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {},
      directories: ["src"],
      generatedAt: "2026-06-12T00:00:00.000Z",
    });

    const secondPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {},
      directories: ["src"],
      existingFiles: firstPlan.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        content: artifact.content,
      })),
      generatedAt: firstPlan.generatedAt,
    });

    assert.equal(secondPlan.summary.unchanged, 6);
    assert.equal(secondPlan.summary.creates, 0);
    assert.equal(secondPlan.summary.updates, 0);
    assert.equal(secondPlan.summary.conflicts, 0);
  });

  it("preserves the last refresh timestamp when context inputs are unchanged", () => {
    const firstPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
      },
      directories: ["src"],
      initializedAt: "2026-06-12T00:00:00.000Z",
      generatedAt: "2026-06-12T00:00:00.000Z",
    });

    const secondPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
      },
      directories: ["src"],
      existingFiles: firstPlan.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        content: artifact.content,
      })),
      initializedAt: firstPlan.initializedAt,
      previousGeneratedAt: firstPlan.generatedAt,
      generatedAt: "2026-06-12T01:00:00.000Z",
    });

    assert.equal(secondPlan.initializedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(secondPlan.generatedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(secondPlan.summary.unchanged, 6);
    assert.equal(secondPlan.summary.updates, 0);
  });

  it("refreshes generatedAt when context inputs change", () => {
    const firstPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
      },
      directories: ["src"],
      initializedAt: "2026-06-12T00:00:00.000Z",
      generatedAt: "2026-06-12T00:00:00.000Z",
    });

    const refreshedPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
        lint: "eslint .",
      },
      directories: ["src"],
      existingFiles: firstPlan.artifacts.map((artifact) => ({
        relativePath: artifact.relativePath,
        content: artifact.content,
      })),
      initializedAt: firstPlan.initializedAt,
      previousGeneratedAt: firstPlan.generatedAt,
      generatedAt: "2026-06-12T01:00:00.000Z",
    });
    const commands = refreshedPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/commands.md");
    const manifest = JSON.parse(
      refreshedPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/manifest.json")!.content,
    ) as { initializedAt: string; generatedAt: string };

    assert.equal(refreshedPlan.initializedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(refreshedPlan.generatedAt, "2026-06-12T01:00:00.000Z");
    assert.ok(refreshedPlan.summary.updates > 0);
    assert.ok(commands?.content.includes("`pnpm lint`: `eslint .`"));
    assert.ok(commands?.content.includes("Last refreshed at 2026-06-12T01:00:00.000Z."));
    assert.equal(manifest.initializedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(manifest.generatedAt, "2026-06-12T01:00:00.000Z");
  });

  it("renders package-manager specific verification commands", () => {
    const npmPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "npm",
      scripts: {
        test: "vitest run",
        build: "tsc",
      },
      directories: [],
      generatedAt: "2026-06-12T00:00:00.000Z",
    });
    const yarnPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "yarn",
      scripts: {
        build: "tsc",
      },
      directories: [],
      generatedAt: "2026-06-12T00:00:00.000Z",
    });
    const unknownPlan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "unknown",
      scripts: {
        build: "tsc",
      },
      directories: [],
      generatedAt: "2026-06-12T00:00:00.000Z",
    });

    const npmCommands = npmPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/commands.md")?.content ?? "";
    const yarnCommands = yarnPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/commands.md")?.content ?? "";
    const unknownCommands = unknownPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/commands.md")?.content ?? "";

    assert.ok(npmCommands.includes("`npm test`: `vitest run`"));
    assert.ok(npmCommands.includes("`npm run build`: `tsc`"));
    assert.ok(npmCommands.includes("`npm --prefix apps/cli test`"));
    assert.ok(!npmCommands.includes("npm --dir apps/cli test"));
    assert.ok(yarnCommands.includes("`yarn build`: `tsc`"));
    assert.ok(yarnCommands.includes("`yarn --cwd apps/cli test`"));
    assert.ok(unknownCommands.includes("`build`: `tsc`"));
    assert.ok(unknownCommands.includes("进入 `apps/cli` 后按该包的 `test` script"));
  });

  it("marks unmanaged context files as conflicts unless force is set", () => {
    const snapshot = {
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {},
      directories: [],
      existingFiles: [
        {
          relativePath: ".codex/context/project.md",
          content: "# Human notes\n",
        },
      ],
      generatedAt: "2026-06-12T00:00:00.000Z",
    };

    const plan = createCodexContextInitPlan(snapshot);
    const forcedPlan = createCodexContextInitPlan(snapshot, { force: true });

    assert.equal(
      plan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/project.md")?.action,
      "conflict",
    );
    assert.equal(
      forcedPlan.artifacts.find((artifact) => artifact.relativePath === ".codex/context/project.md")?.action,
      "update",
    );
  });

  it("creates a generation plan from toolkit assets", () => {
    const plan = createCodexGenerationPlan(manifest);

    assert.equal(plan.platform, platformName);
    assert.equal(plan.packageName, packageName);
    assert.equal(plan.manifestSource, "toolkit-manifest");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), [
      "skill-alpha",
      "command:start",
      "command:context-init",
      "command:api",
      "agent:code-reviewer",
    ]);
    assert.deepEqual(plan.capability, capability);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.agents,
      templateFiles.config,
      "skills/zc-start/SKILL.md",
      "skills/zc-context-init/SKILL.md",
      "skills/zc-api/SKILL.md",
      "skills/zc-skill-alpha/SKILL.md",
      "agents/zc-code-reviewer.toml",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Codex 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("$zc-sdd-tdd"));
    assert.ok(plan.artifacts[0]?.content.includes("统一命令语义到 Codex skill 的映射"));
    assert.ok(plan.artifacts[0]?.content.includes("`zc:context-init` -> `$zc-context-init`"));
    assert.ok(plan.artifacts[0]?.content.includes("入口选择"));
    assert.ok(plan.artifacts[0]?.content.includes("专项入口（按需召回）"));
    assert.ok(plan.artifacts[0]?.content.includes("$zc-api"));
    assert.ok(plan.artifacts[0]?.content.includes("不裁剪 Codex 安装资产"));
    assert.ok(plan.artifacts[0]?.content.includes("config.toml"));
    assert.ok(plan.artifacts[1]?.content.includes("[agents.zc_code_reviewer]"));
    assert.ok(plan.artifacts[1]?.content.includes('config_file = "agents/zc-code-reviewer.toml"'));
    assert.ok(plan.artifacts[2]?.content.includes("command-alias skill"));
    assert.ok(plan.artifacts[2]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[3]?.content.includes("$zc-context-init"));
    assert.ok(plan.artifacts[4]?.content.includes("$zc-api"));
    assert.ok(plan.artifacts[5]?.content.includes("Alpha skill"));
    assert.ok(plan.artifacts[6]?.content.includes('name = "zc_code_reviewer"'));
    assert.ok(!plan.artifacts[6]?.content.includes("tools ="));
    assert.ok(plan.artifacts[6]?.content.includes("developer_instructions"));
  });

  it("creates a global install plan with AGENTS and skills", () => {
    const destinationRoot = join("tmp", "codex");
    const plan = createCodexInstallPlan(manifest, {
      destinationRoot,
      scope: "global",
    });

    assert.equal(plan.destinationRoot, destinationRoot);
    assert.equal(plan.scope, "global");
    assert.equal(plan.overwrite, "error");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "AGENTS.md"),
      join(destinationRoot, "config.toml"),
      join(destinationRoot, "skills/zc-start/SKILL.md"),
      join(destinationRoot, "skills/zc-context-init/SKILL.md"),
      join(destinationRoot, "skills/zc-api/SKILL.md"),
      join(destinationRoot, "skills/zc-skill-alpha/SKILL.md"),
      join(destinationRoot, "agents/zc-code-reviewer.toml"),
    ]);
  });

  it("creates an agent-only install plan for Codex custom agents", () => {
    const destinationRoot = join("tmp", "codex");
    const plan = createCodexAgentInstallPlan(manifest, {
      destinationRoot,
      scope: "global",
    });
    const generationPlan = createCodexAgentGenerationPlan(manifest, {
      scope: "global",
    });

    assert.deepEqual(generationPlan.capability.surfaces, ["agents-dir"]);
    assert.equal(plan.scope, "global");
    assert.deepEqual(plan.matchedAssets.map((asset) => asset.id), ["agent:code-reviewer"]);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "config.toml"),
      join(destinationRoot, "agents/zc-code-reviewer.toml"),
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("[agents.zc_code_reviewer]"));
    assert.ok(plan.artifacts[1]?.content.includes('name = "zc_code_reviewer"'));
  });

  it("installs project AGENTS.md and project-local .codex skills", () => {
    const destinationRoot = join("tmp", "project");
    const plan = createCodexInstallPlan(manifest, {
      destinationRoot,
      scope: "project",
    });

    assert.equal(plan.scope, "project");
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      join(destinationRoot, "AGENTS.md"),
      join(destinationRoot, ".codex/config.toml"),
      join(destinationRoot, ".codex/skills/zc-start/SKILL.md"),
      join(destinationRoot, ".codex/skills/zc-context-init/SKILL.md"),
      join(destinationRoot, ".codex/skills/zc-api/SKILL.md"),
      join(destinationRoot, ".codex/skills/zc-skill-alpha/SKILL.md"),
      join(destinationRoot, ".codex/agents/zc-code-reviewer.toml"),
    ]);
    assert.deepEqual(plan.capability.skills?.relativeDir, ".codex/skills");
    assert.deepEqual(plan.capability.agents?.relativeDir, ".codex/agents");
    assert.ok(plan.artifacts[0]?.content.includes(".codex/skills/zc-<command>/SKILL.md"));
    assert.ok(plan.artifacts[0]?.content.includes(".codex/agents/zc-*.toml"));
    assert.ok(plan.artifacts[0]?.content.includes(".codex/config.toml"));
    assert.ok(plan.artifacts[1]?.content.includes('config_file = "agents/zc-code-reviewer.toml"'));
  });

  it("creates a Codex plugin generation plan with manifest and bundled skills", () => {
    const plan = createCodexPluginGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
    });

    assert.equal(plan.platform, platformName);
    assert.deepEqual(plan.capability.surfaces, [
      "plugin-dir",
      "commands-dir",
      "skills-dir",
      "agents-dir",
    ]);
    assert.equal(plan.capability.entryFile, undefined);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.pluginManifest,
      "commands/start.md",
      "commands/context-init.md",
      "commands/api.md",
      "skills/start/SKILL.md",
      "skills/context-init/SKILL.md",
      "skills/api/SKILL.md",
      "skills/skill-alpha/SKILL.md",
      "agents/code-reviewer.md",
      "assets/zc-agents/manifest.json",
      "assets/zc-agents/config/agents.toml",
      "assets/zc-agents/agents/zc-code-reviewer.toml",
    ]);
    const startCommand = plan.artifacts.find((artifact) => artifact.path === "commands/start.md");
    const startSkill = plan.artifacts.find((artifact) => artifact.path === "skills/start/SKILL.md");
    const contextSkill = plan.artifacts.find((artifact) => artifact.path === "skills/context-init/SKILL.md");
    const apiSkill = plan.artifacts.find((artifact) => artifact.path === "skills/api/SKILL.md");
    const nativeAgent = plan.artifacts.find((artifact) => artifact.path === "agents/code-reviewer.md");
    assert.ok(startCommand?.content.startsWith('---\nname: "start"'));
    assert.ok(startCommand?.content.includes("# 开始"));
    assert.ok(startSkill?.content.includes('name: "start"'));
    assert.ok(startSkill?.content.includes("$start"));
    assert.ok(!startSkill?.content.includes("$zc-start"));
    assert.ok(contextSkill?.content.includes("$context-init"));
    assert.ok(apiSkill?.content.includes("$api"));
    assert.ok(nativeAgent?.content.startsWith('---\nname: "code-reviewer"'));
    assert.ok(nativeAgent?.content.includes("Review code like an owner"));

    const pluginManifest = JSON.parse(plan.artifacts[0]!.content) as {
      name: string;
      version: string;
      skills: string;
      homepage: string;
      repository: string;
      author: { name: string; url: string };
      interface: { defaultPrompt: string[] };
      zc: { commands: number; skills: number; agents: number };
    };
    assert.equal(pluginManifest.name, "zc-toolkit");
    assert.equal(pluginManifest.version, "0.2.5");
    assert.equal(pluginManifest.skills, "./skills/");
    assert.equal(pluginManifest.homepage, "https://github.com/zmice/zc-ai-coding-toolkit");
    assert.equal(pluginManifest.repository, "https://github.com/zmice/zc-ai-coding-toolkit");
    assert.deepEqual(pluginManifest.author, {
      name: "zc",
      url: "https://github.com/zmice",
    });
    assert.deepEqual(pluginManifest.interface.defaultPrompt, [
      "Use start to choose the right workflow for this task.",
      "Use team-orchestration when multiple agents need coordinated worktree isolation.",
    ]);
    assert.deepEqual(pluginManifest.zc, { commands: 3, skills: 1, agents: 1 });

    const companionManifestArtifact = plan.artifacts.find(
      (artifact) => artifact.path === "assets/zc-agents/manifest.json",
    );
    assert.ok(companionManifestArtifact);
    const companionManifest = JSON.parse(companionManifestArtifact.content) as {
      schemaVersion: number;
      pluginId: string;
      pluginVersion: string;
      contentFingerprint: string;
      config: { path: string; sha256: string };
      agents: Array<{ name: string; path: string; sha256: string }>;
    };
    assert.equal(companionManifest.schemaVersion, 1);
    assert.equal(companionManifest.pluginId, "zc-toolkit@zc-toolkit");
    assert.equal(companionManifest.pluginVersion, "0.2.5");
    assert.match(companionManifest.contentFingerprint, /^[a-f0-9]{64}$/u);
    assert.equal(companionManifest.config.path, "config/agents.toml");
    assert.match(companionManifest.config.sha256, /^[a-f0-9]{64}$/u);
    assert.deepEqual(companionManifest.agents.map((agent) => ({
      name: agent.name,
      path: agent.path,
    })), [
      {
        name: "zc_code_reviewer",
        path: "agents/zc-code-reviewer.toml",
      },
    ]);
    assert.match(companionManifest.agents[0]!.sha256, /^[a-f0-9]{64}$/u);
    const companionAgent = plan.artifacts.find(
      (artifact) => artifact.path === "assets/zc-agents/agents/zc-code-reviewer.toml",
    );
    assert.ok(companionAgent?.content.includes('name = "zc_code_reviewer"'));
    assert.ok(!companionAgent?.content.includes("tools ="));
  });

  it("creates a Codex repo marketplace generation plan", () => {
    const plan = createCodexMarketplaceGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.marketplace,
      templateFiles.agents,
      "plugins/zc-toolkit/.codex-plugin/plugin.json",
      "plugins/zc-toolkit/commands/start.md",
      "plugins/zc-toolkit/commands/context-init.md",
      "plugins/zc-toolkit/commands/api.md",
      "plugins/zc-toolkit/skills/start/SKILL.md",
      "plugins/zc-toolkit/skills/context-init/SKILL.md",
      "plugins/zc-toolkit/skills/api/SKILL.md",
      "plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      "plugins/zc-toolkit/agents/code-reviewer.md",
      "plugins/zc-toolkit/assets/zc-agents/manifest.json",
      "plugins/zc-toolkit/assets/zc-agents/config/agents.toml",
      "plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml",
    ]);
    assert.deepEqual(plan.capability.surfaces, [
      "entry-file",
      "plugin-dir",
      "commands-dir",
      "skills-dir",
      "agents-dir",
    ]);
    assert.equal(plan.capability.entryFile?.fileName, templateFiles.agents);
    assert.equal(plan.capability.commands?.relativeDir, "plugins/zc-toolkit/commands");
    assert.equal(plan.capability.skills?.relativeDir, "plugins/zc-toolkit/skills");
    assert.equal(plan.capability.agents?.relativeDir, "plugins/zc-toolkit/agents");
    assert.ok(plan.artifacts[1]?.content.includes("Codex zc-toolkit 插件入口"));
    assert.ok(plan.artifacts[1]?.content.includes("Codex 调用方式"));
    assert.ok(plan.artifacts[1]?.content.includes("`$zc-toolkit:start`、`$zc-toolkit:context-init`、`$zc-toolkit:quality-review`"));
    assert.ok(plan.artifacts[1]?.content.includes("原生 command 文件"));
    assert.ok(plan.artifacts[1]?.content.includes("`zc:start` -> `$zc-toolkit:start`"));
    assert.ok(plan.artifacts[1]?.content.includes("专项入口（按需召回）"));
    assert.ok(!plan.artifacts[1]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[1]?.content.includes("plugins/zc-toolkit/commands/<command>.md"));
    assert.ok(plan.artifacts[1]?.content.includes("plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));
    assert.ok(plan.artifacts[1]?.content.includes("plugins/zc-toolkit/agents/<agent>.md"));
    const repoStartSkill = plan.artifacts.find(
      (artifact) => artifact.path === "plugins/zc-toolkit/skills/start/SKILL.md",
    );
    assert.ok(repoStartSkill?.content.startsWith("---\nname: \"start\""));
    assert.ok(repoStartSkill?.content.includes("# start"));
    assert.ok(!repoStartSkill?.content.includes("# zc:start"));

    const marketplace = JSON.parse(plan.artifacts[0]!.content) as {
      plugins: Array<{
        name: string;
        source: { source: string; path: string };
        policy: { installation: string; authentication: string };
      }>;
    };
    assert.equal(marketplace.plugins[0]?.name, "zc-toolkit");
    assert.deepEqual(marketplace.plugins[0]?.source, {
      source: "local",
      path: "./plugins/zc-toolkit",
    });
    assert.deepEqual(marketplace.plugins[0]?.policy, {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    });
  });

  it("creates a Codex personal marketplace generation plan", () => {
    const plan = createCodexMarketplaceGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
      scope: "global",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.marketplace,
      ".codex/AGENTS.md",
      ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json",
      ".codex/plugins/zc-toolkit/commands/start.md",
      ".codex/plugins/zc-toolkit/commands/context-init.md",
      ".codex/plugins/zc-toolkit/commands/api.md",
      ".codex/plugins/zc-toolkit/skills/start/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/context-init/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/api/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      ".codex/plugins/zc-toolkit/agents/code-reviewer.md",
      ".codex/plugins/zc-toolkit/assets/zc-agents/manifest.json",
      ".codex/plugins/zc-toolkit/assets/zc-agents/config/agents.toml",
      ".codex/plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml",
    ]);
    assert.equal(plan.capability.entryFile?.fileName, ".codex/AGENTS.md");
    assert.equal(plan.capability.commands?.relativeDir, ".codex/plugins/zc-toolkit/commands");
    assert.equal(plan.capability.skills?.relativeDir, ".codex/plugins/zc-toolkit/skills");
    assert.equal(plan.capability.agents?.relativeDir, ".codex/plugins/zc-toolkit/agents");
    assert.ok(plan.artifacts[1]?.content.includes("~/.codex/plugins/zc-toolkit/commands/<command>.md"));
    assert.ok(plan.artifacts[1]?.content.includes("~/.codex/plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));
    assert.ok(plan.artifacts[1]?.content.includes("~/.codex/plugins/zc-toolkit/agents/<agent>.md"));
    assert.ok(plan.artifacts[1]?.content.includes("Codex 调用方式"));
    assert.ok(plan.artifacts[1]?.content.includes("原生 command 文件"));
    assert.ok(plan.artifacts[1]?.content.includes("`$zc-toolkit:start`"));

    const marketplace = JSON.parse(plan.artifacts[0]!.content) as {
      plugins: Array<{ source: { source: string; path: string } }>;
    };
    assert.deepEqual(marketplace.plugins[0]?.source, {
      source: "local",
      path: "./.codex/plugins/zc-toolkit",
    });
  });
});
