import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  capability,
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
  it("creates a Codex project context init plan", () => {
    const plan = createCodexContextInitPlan({
      root: "/repo/demo",
      projectName: "demo",
      packageManager: "pnpm",
      scripts: {
        test: "vitest run",
      },
      directories: ["apps", "packages"],
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
      ".codex/context/manifest.json",
    ]);
    assert.equal(plan.summary.creates, 4);
    assert.equal(plan.summary.updates, 1);
    assert.equal(plan.initializedAt, "2026-06-12T00:00:00.000Z");
    assert.equal(plan.generatedAt, "2026-06-12T00:00:00.000Z");
    assert.ok(plan.artifacts[0]?.content.includes("# Existing"));
    assert.ok(plan.artifacts[0]?.content.includes("<!-- zc-context:init:start -->"));
    assert.ok(plan.artifacts[1]?.content.includes("<!-- zc-context:managed -->"));
    assert.ok(plan.artifacts[1]?.content.includes("Initialized by `zc context init` at 2026-06-12T00:00:00.000Z."));
    assert.ok(plan.artifacts[1]?.content.includes("Last refreshed at 2026-06-12T00:00:00.000Z."));
    assert.ok(plan.artifacts[2]?.content.includes("`pnpm test`: `vitest run`"));
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

    assert.equal(secondPlan.summary.unchanged, 5);
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
    assert.equal(secondPlan.summary.unchanged, 5);
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
      "agent:code-reviewer",
    ]);
    assert.deepEqual(plan.capability, capability);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.agents,
      templateFiles.config,
      "skills/zc-start/SKILL.md",
      "skills/zc-context-init/SKILL.md",
      "skills/zc-skill-alpha/SKILL.md",
      "agents/zc-code-reviewer.toml",
    ]);
    assert.ok(plan.artifacts[0]?.content.includes("Codex 工作流入口"));
    assert.ok(plan.artifacts[0]?.content.includes("$zc-sdd-tdd"));
    assert.ok(plan.artifacts[0]?.content.includes("统一命令语义到 Codex skill 的映射"));
    assert.ok(plan.artifacts[0]?.content.includes("`zc:context-init` -> `$zc-context-init`"));
    assert.ok(plan.artifacts[0]?.content.includes("固定 workflow"));
    assert.ok(plan.artifacts[0]?.content.includes("config.toml"));
    assert.ok(plan.artifacts[1]?.content.includes("[agents.zc_code_reviewer]"));
    assert.ok(plan.artifacts[1]?.content.includes('config_file = "agents/zc-code-reviewer.toml"'));
    assert.ok(plan.artifacts[2]?.content.includes("command-alias skill"));
    assert.ok(plan.artifacts[2]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[3]?.content.includes("$zc-context-init"));
    assert.ok(plan.artifacts[4]?.content.includes("Alpha skill"));
    assert.ok(plan.artifacts[5]?.content.includes('name = "zc_code_reviewer"'));
    assert.ok(plan.artifacts[5]?.content.includes('tools = ["Read", "Edit"]'));
    assert.ok(plan.artifacts[5]?.content.includes("developer_instructions"));
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
      join(destinationRoot, "skills/zc-skill-alpha/SKILL.md"),
      join(destinationRoot, "agents/zc-code-reviewer.toml"),
    ]);
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
    assert.deepEqual(plan.capability.surfaces, ["plugin-dir", "skills-dir"]);
    assert.equal(plan.capability.entryFile, undefined);
    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.pluginManifest,
      "skills/start/SKILL.md",
      "skills/context-init/SKILL.md",
      "skills/skill-alpha/SKILL.md",
    ]);
    assert.ok(plan.artifacts[1]?.content.includes('name: "start"'));
    assert.ok(plan.artifacts[1]?.content.includes("$start"));
    assert.ok(!plan.artifacts[1]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[2]?.content.includes("$context-init"));

    const pluginManifest = JSON.parse(plan.artifacts[0]!.content) as {
      name: string;
      version: string;
      skills: string;
      interface: { defaultPrompt: string[] };
      zc: { commands: number; skills: number };
    };
    assert.equal(pluginManifest.name, "zc-toolkit");
    assert.equal(pluginManifest.version, "0.2.5");
    assert.equal(pluginManifest.skills, "./skills/");
    assert.deepEqual(pluginManifest.interface.defaultPrompt, [
      "Use start to choose the right workflow for this task.",
      "Use team-orchestration when multiple agents need coordinated worktree isolation.",
    ]);
    assert.deepEqual(pluginManifest.zc, { commands: 2, skills: 1 });
  });

  it("creates a Codex repo marketplace generation plan", () => {
    const plan = createCodexMarketplaceGenerationPlan(manifest, {
      pluginVersion: "0.2.5",
    });

    assert.deepEqual(plan.artifacts.map((artifact) => artifact.path), [
      templateFiles.marketplace,
      templateFiles.agents,
      "plugins/zc-toolkit/.codex-plugin/plugin.json",
      "plugins/zc-toolkit/skills/start/SKILL.md",
      "plugins/zc-toolkit/skills/context-init/SKILL.md",
      "plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      ".codex/config.toml",
      ".codex/agents/zc-code-reviewer.toml",
    ]);
    assert.deepEqual(plan.capability.surfaces, ["entry-file", "plugin-dir", "skills-dir", "agents-dir"]);
    assert.equal(plan.capability.entryFile?.fileName, templateFiles.agents);
    assert.equal(plan.capability.skills?.relativeDir, "plugins/zc-toolkit/skills");
    assert.equal(plan.capability.agents?.relativeDir, ".codex/agents");
    assert.ok(plan.artifacts[1]?.content.includes("Codex zc-toolkit 插件入口"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:start` -> `$start"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:context-init` -> `$context-init"));
    assert.ok(!plan.artifacts[1]?.content.includes("$zc-start"));
    assert.ok(plan.artifacts[1]?.content.includes("plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));

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
      ".codex/plugins/zc-toolkit/skills/start/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/context-init/SKILL.md",
      ".codex/plugins/zc-toolkit/skills/skill-alpha/SKILL.md",
      ".codex/config.toml",
      ".codex/agents/zc-code-reviewer.toml",
    ]);
    assert.equal(plan.capability.entryFile?.fileName, ".codex/AGENTS.md");
    assert.equal(plan.capability.skills?.relativeDir, ".codex/plugins/zc-toolkit/skills");
    assert.ok(plan.artifacts[1]?.content.includes("~/.codex/plugins/zc-toolkit/skills/<command-or-skill>/SKILL.md"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:start` -> `$start"));
    assert.ok(plan.artifacts[1]?.content.includes("zc:context-init` -> `$context-init"));

    const marketplace = JSON.parse(plan.artifacts[0]!.content) as {
      plugins: Array<{ source: { source: string; path: string } }>;
    };
    assert.deepEqual(marketplace.plugins[0]?.source, {
      source: "local",
      path: "./.codex/plugins/zc-toolkit",
    });
  });
});
