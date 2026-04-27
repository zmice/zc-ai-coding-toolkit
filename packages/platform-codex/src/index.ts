import {
  attachPlanMetadata,
  createInstallPlan,
  describeAsset,
  selectMatchedAssets,
  type GenerationPlan as BaseGenerationPlan,
  type InstallPlan as BaseInstallPlan,
  type InstallPlanOptions as BaseInstallPlanOptions,
  type PlatformArtifact,
  type ToolkitAssetLike as BaseToolkitAssetLike,
  type ToolkitManifestLike as BaseToolkitManifestLike,
} from "@zmice/platform-core";

export interface GenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
  readonly scope?: InstallScope;
  readonly pluginName?: string;
  readonly pluginVersion?: string;
  readonly marketplaceName?: string;
  readonly marketplaceDisplayName?: string;
}

export type InstallScope = "project" | "global" | "dir";
export type PlatformCapabilitySurface = "entry-file" | "plugin-dir" | "skills-dir" | "agents-dir";

export interface PlatformCapability {
  readonly platform: typeof platformName;
  readonly namespace: string;
  readonly surfaces: readonly PlatformCapabilitySurface[];
  readonly entryFile?: {
    readonly fileName: string;
  };
  readonly skills?: {
    readonly relativeDir: string;
    readonly fileName: "SKILL.md";
  };
  readonly agents?: {
    readonly relativeDir: string;
    readonly fileExtension: ".toml";
  };
}

export interface ToolkitAssetLike extends BaseToolkitAssetLike {
  readonly name?: string;
}

export interface ToolkitManifestLike extends Omit<BaseToolkitManifestLike, "assets"> {
  readonly assets: readonly ToolkitAssetLike[];
}

export interface GenerationPlan extends BaseGenerationPlan {
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly capability: PlatformCapability;
}

export interface InstallPlan extends BaseInstallPlan {
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly capability: PlatformCapability;
  readonly scope: InstallScope;
}

export interface InstallPlanOptions extends Omit<BaseInstallPlanOptions, "overwrite"> {
  readonly overwrite?: "error" | "force";
  readonly scope?: InstallScope;
}

export type InstallOptions = GenerationOptions & InstallPlanOptions;

export const platformName = "codex" as const;
export const packageName = "@zmice/platform-codex" as const;

export type {
  PlatformArtifact,
};

export const templateFiles = {
  agents: "AGENTS.md",
  config: "config.toml",
  projectConfig: ".codex/config.toml",
  pluginManifest: ".codex-plugin/plugin.json",
  marketplace: ".agents/plugins/marketplace.json",
} as const;

export const capability: PlatformCapability = {
  platform: platformName,
  namespace: "zc",
  surfaces: ["entry-file", "skills-dir", "agents-dir"],
  entryFile: {
    fileName: templateFiles.agents,
  },
  skills: {
    relativeDir: "skills",
    fileName: "SKILL.md",
  },
  agents: {
    relativeDir: "agents",
    fileExtension: ".toml",
  },
};

interface ScopeLayout {
  readonly entryFile: string;
  readonly configFile: string;
  readonly displayConfigFile: string;
  readonly skillsDir: string;
  readonly displaySkillsDir: string;
  readonly agentsDir: string;
  readonly displayAgentsDir: string;
  readonly agentConfigPrefix: string;
}

function getScopeLayout(scope: InstallScope): ScopeLayout {
  if (scope === "project") {
    return {
      entryFile: templateFiles.agents,
      configFile: templateFiles.projectConfig,
      displayConfigFile: ".codex/config.toml",
      skillsDir: ".codex/skills",
      displaySkillsDir: ".codex/skills",
      agentsDir: ".codex/agents",
      displayAgentsDir: ".codex/agents",
      agentConfigPrefix: "agents",
    };
  }

  if (scope === "global") {
    return {
      entryFile: templateFiles.agents,
      configFile: templateFiles.config,
      displayConfigFile: "~/.codex/config.toml",
      skillsDir: "skills",
      displaySkillsDir: "~/.codex/skills",
      agentsDir: "agents",
      displayAgentsDir: "~/.codex/agents",
      agentConfigPrefix: "agents",
    };
  }

  return {
    entryFile: templateFiles.agents,
    configFile: templateFiles.config,
    displayConfigFile: "config.toml",
    skillsDir: "skills",
    displaySkillsDir: "skills",
    agentsDir: "agents",
    displayAgentsDir: "agents",
    agentConfigPrefix: "agents",
  };
}

function createCapability(layout: ScopeLayout): PlatformCapability {
  return {
    ...capability,
    entryFile: {
      ...capability.entryFile,
      fileName: layout.entryFile,
    },
    skills: {
      relativeDir: layout.skillsDir,
      fileName: capability.skills!.fileName,
    },
    agents: {
      relativeDir: layout.agentsDir,
      fileExtension: ".toml",
    },
  };
}

function selectMatchedAssetsByKind(
  manifest: ToolkitManifestLike,
  kind: ToolkitAssetLike["kind"],
): readonly ToolkitAssetLike[] {
  return selectMatchedAssets(manifest, platformName).filter((asset) => asset.kind === kind);
}

function renderAssetList(assets: readonly ToolkitAssetLike[]): string {
  if (assets.length === 0) {
    return "- 尚未匹配到任何工具包资产。";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function renderAgentsFile(
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): string {
  const commandCount = assets.filter((asset) => asset.kind === "command").length;
  const skillCount = assets.filter((asset) => asset.kind === "skill").length;
  const agentCount = assets.filter((asset) => asset.kind === "agent").length;

  return `# Codex 工作流入口

这是安装到 Codex 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 把 \`zc:*\` 命令语义映射成 Codex 实际可调用的 \`$zc-*\` skill

详细方法不写在这里，完整内容都在 \`${layout.displaySkillsDir}/zc-*/SKILL.md\`。
角色化 custom agents 位于 \`${layout.displayAgentsDir}/zc-*.toml\`。
Codex agent role 注册位于 \`${layout.displayConfigFile}\` 的 \`[agents.*]\` 配置。
其中：

- \`$zc-start\`、\`$zc-spec\`、\`$zc-build\` 这类是 command-alias skill
- \`$zc-sdd-tdd-workflow\`、\`$zc-debugging-and-error-recovery\` 这类是专题/流程 skill
- \`zc_*\` 这类是 Codex custom agent，只在显式要求多 agent / 指定 agent 时使用

## 核心规则

- 默认先判断任务属于哪条 workflow，再决定入口
- Codex 侧没有 \`zc:start\` 这类原生命令，请把它们理解为统一语义入口
- 在 Codex 中，统一命令语义通过 \`$zc-*\` skill 来承接
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证
- 不做超出任务边界的顺手修改

## 统一命令语义到 Codex skill 的映射

- \`zc:start\` -> \`$zc-start\`
- \`zc:product-analysis\` -> \`$zc-product-analysis\`
- \`zc:sdd-tdd\` -> \`$zc-sdd-tdd\`
- \`zc:spec\` -> \`$zc-spec\`
- \`zc:task-plan\` -> \`$zc-task-plan\`
- \`zc:build\` -> \`$zc-build\`
- \`zc:quality-review\` -> \`$zc-quality-review\`
- \`zc:verify\` -> \`$zc-verify\`
- \`zc:debug\` -> \`$zc-debug\`
- \`zc:doc\` -> \`$zc-doc\`
- \`zc:ship\` -> \`$zc-ship\`
- \`zc:onboard\` -> \`$zc-onboard\`
- \`zc:ctx-health\` -> \`$zc-ctx-health\`

## 固定 workflow

### 1. product-analysis

适用：
- 需求还模糊
- 需要先把目标、范围和验收标准收敛清楚

默认 skill：
- \`$zc-product-analysis\`
- 需要更深的设计或规格时，再接 \`$zc-brainstorming-and-design\` / \`$zc-spec-driven-development\`

### 2. full-delivery

适用：
- 新功能、较大改动、完整交付

默认 skill：
- \`$zc-sdd-tdd\`
- 需要完整主流程时，再接 \`$zc-sdd-tdd-workflow\`

### 3. bugfix

适用：
- Bug、失败测试、异常行为

默认 skill：
- \`$zc-debug\`
- 需要深入根因分析时，再接 \`$zc-debugging-and-error-recovery\`

### 4. review-closure

适用：
- 已有改动，当前重点是审查、反馈处理、收尾

默认 skill：
- \`$zc-quality-review\`
- 必要时接 \`$zc-code-review-and-quality\` / \`$zc-review-response-and-resolution\`

### 5. docs-release

适用：
- 文档、ADR、发布说明、发布后同步

默认 skill：
- \`$zc-doc\`
- 发布收尾时可接 \`$zc-ship\`
- 必要时接 \`$zc-documentation-and-adrs\` / \`$zc-release-documentation-sync\`

### 6. investigation

适用：
- 陌生代码库
- 上下文失焦
- 需要先摸清项目或限制

默认 skill：
- \`$zc-onboard\` / \`$zc-ctx-health\`
- 必要时接 \`$zc-codebase-onboarding\` / \`$zc-context-engineering\`

## 推荐开始方式

- 不确定从哪开始：直接用 \`$zc-start\`
- 需求还模糊：先用 \`$zc-product-analysis\`
- 已确认是完整交付：直接用 \`$zc-sdd-tdd\`
- 明确是 bug：直接用 \`$zc-debug\`
- 明确是审查：直接用 \`$zc-quality-review\`

## 最常用入口速查

- 做新需求但范围还没收敛：\`$zc-product-analysis\`
- 进入完整交付主流程：\`$zc-sdd-tdd\`
- 修 bug：\`$zc-debug\`
- 做代码审查和反馈收敛：\`$zc-quality-review\`
- 补文档或发布说明：\`$zc-doc\`
- 陌生项目先摸底：\`$zc-onboard\` 或 \`$zc-ctx-health\`

## 详细内容在哪里

- command-alias skills：查看 \`${layout.displaySkillsDir}/zc-<command>/SKILL.md\`
- workflow / 专项 skills：查看 \`${layout.displaySkillsDir}/zc-<skill>/SKILL.md\`
- 如果入口页不足以判断，就先打开对应 skill 再继续

## 已安装能力

此安装当前包含：

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- command-alias skills：${commandCount} 个
- skills：${skillCount} 个
- custom agents：${agentCount} 个

${renderAssetList(assets)}
`;
}

function renderPluginManifest(options: {
  readonly name: string;
  readonly version: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
}): string {
  const commandCount = options.matchedAssets.filter((asset) => asset.kind === "command").length;
  const skillCount = options.matchedAssets.filter((asset) => asset.kind === "skill").length;

  return `${JSON.stringify(
    {
      name: options.name,
      version: options.version,
      description: "Bundle zc AI coding workflows for Codex.",
      author: {
        name: "zc",
      },
      license: "MIT",
      keywords: ["codex", "skills", "workflow", "multi-agent"],
      skills: "./skills/",
      interface: {
        displayName: "zc AI Coding Toolkit",
        shortDescription: "Reusable engineering workflows for Codex.",
        longDescription:
          "Installs zc workflow skills for planning, building, reviewing, verifying, and coordinating agentic coding work in Codex.",
        developerName: "zc",
        category: "Developer Tools",
        capabilities: ["Read", "Write"],
        defaultPrompt: [
          "Use zc-start to choose the right workflow for this task.",
          "Use zc-team-orchestration when multiple agents need coordinated worktree isolation.",
        ],
      },
      zc: {
        commands: commandCount,
        skills: skillCount,
      },
    },
    null,
    2,
  )}\n`;
}

function renderMarketplaceManifest(options: {
  readonly marketplaceName: string;
  readonly marketplaceDisplayName: string;
  readonly pluginName: string;
  readonly pluginPath: string;
}): string {
  return `${JSON.stringify(
    {
      name: options.marketplaceName,
      interface: {
        displayName: options.marketplaceDisplayName,
      },
      plugins: [
        {
          name: options.pluginName,
          source: {
            source: "local",
            path: options.pluginPath,
          },
          policy: {
            installation: "AVAILABLE",
            authentication: "ON_INSTALL",
          },
          category: "Developer Tools",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

function toCodexSkillSlug(asset: ToolkitAssetLike): string {
  return asset.id.replace(/^(skill|command|agent):/, "");
}

function toCodexSkillDirectory(asset: ToolkitAssetLike, layout: ScopeLayout): string {
  return `${layout.skillsDir}/zc-${toCodexSkillSlug(asset)}`;
}

function toCodexAgentName(asset: ToolkitAssetLike): string {
  return `zc_${toCodexSkillSlug(asset).replace(/[^A-Za-z0-9_]+/g, "_")}`;
}

function renderTomlScalar(value: string): string {
  return JSON.stringify(value);
}

function renderYamlFrontmatter(fields: Record<string, string | undefined>): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(fields)) {
    if (!value) {
      continue;
    }

    lines.push(`${key}: ${JSON.stringify(value)}`);
  }

  lines.push("---");

  return `${lines.join("\n")}\n`;
}

function renderSkillFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
  })}\n${options.body.trim()}\n`;
}

function renderCodexCommandAliasBody(asset: ToolkitAssetLike): string {
  const commandName = toCodexSkillSlug(asset);

  return `# zc:${commandName}

这是 Codex 的 command-alias skill。

使用方式：

- 在 Codex 中直接调用 \`$zc-${commandName}\`
- 它对应统一命令语义 \`zc:${commandName}\`
- 如果需要更深的方法细节，再继续调用相关专题 skill

${(asset.body ?? `# ${describeAsset(asset)}\n`).trim()}
`;
}

function renderCodexSkillArtifacts(
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): readonly PlatformArtifact[] {
  return assets.map((asset) => ({
    path: `${toCodexSkillDirectory(asset, layout)}/SKILL.md`,
    content: renderSkillFile({
      name: `zc-${asset.name ?? toCodexSkillSlug(asset)}`,
      description: asset.summary ?? describeAsset(asset),
      body: asset.body ?? `# ${describeAsset(asset)}\n`,
    }),
  }));
}

function renderCodexAgentArtifacts(
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): readonly PlatformArtifact[] {
  return assets.map((asset) => {
    const slug = toCodexSkillSlug(asset);

    return {
      path: `${layout.agentsDir}/zc-${slug}.toml`,
      content: [
        `name = ${renderTomlScalar(toCodexAgentName(asset))}`,
        `description = ${renderTomlScalar(asset.summary ?? describeAsset(asset))}`,
        `developer_instructions = ${renderTomlScalar(
          asset.body ?? `# ${describeAsset(asset)}\n`,
        )}`,
        "",
      ].join("\n"),
    };
  });
}

function renderCodexAgentConfigArtifacts(
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): readonly PlatformArtifact[] {
  if (assets.length === 0) {
    return [];
  }

  const lines = [
    "# Generated by zc. Merge with existing Codex config before forcing overwrites.",
    "# See: https://developers.openai.com/codex/config-reference",
    "",
  ];

  for (const asset of assets) {
    const slug = toCodexSkillSlug(asset);
    const agentName = toCodexAgentName(asset);

    lines.push(
      `[agents.${agentName}]`,
      `description = ${renderTomlScalar(asset.summary ?? describeAsset(asset))}`,
      `config_file = ${renderTomlScalar(`${layout.agentConfigPrefix}/zc-${slug}.toml`)}`,
      "",
    );
  }

  return [
    {
      path: layout.configFile,
      content: `${lines.join("\n").trimEnd()}\n`,
    },
  ];
}

function renderCodexCommandAliasArtifacts(
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): readonly PlatformArtifact[] {
  return assets.map((asset) => ({
    path: `${toCodexSkillDirectory(asset, layout)}/SKILL.md`,
    content: renderSkillFile({
      name: `zc-${asset.name ?? toCodexSkillSlug(asset)}`,
      description: asset.summary ?? describeAsset(asset),
      body: renderCodexCommandAliasBody(asset),
    }),
  }));
}

export function createCodexGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const scope = options.scope ?? "dir";
  const layout = getScopeLayout(scope);
  const resolvedCapability = createCapability(layout);
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const commandAssets = selectMatchedAssetsByKind(manifest, "command");
  const skillAssets = selectMatchedAssetsByKind(manifest, "skill");
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability: resolvedCapability,
    artifacts: [
      {
        path: layout.entryFile,
        content: renderAgentsFile(manifestSource, matchedAssets, layout),
      },
      ...renderCodexAgentConfigArtifacts(agentAssets, layout),
      ...renderCodexCommandAliasArtifacts(commandAssets, layout),
      ...renderCodexSkillArtifacts(skillAssets, layout),
      ...renderCodexAgentArtifacts(agentAssets, layout),
    ],
  }) as GenerationPlan;
}

export function createCodexPluginGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const layout = getScopeLayout("dir");
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const commandAssets = selectMatchedAssetsByKind(manifest, "command");
  const skillAssets = selectMatchedAssetsByKind(manifest, "skill");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;
  const pluginName = options.pluginName ?? "zc-toolkit";
  const pluginVersion = options.pluginVersion ?? "0.0.0";

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability: {
      ...createCapability(layout),
      surfaces: ["plugin-dir", "skills-dir"],
      entryFile: undefined,
    },
    artifacts: [
      {
        path: templateFiles.pluginManifest,
        content: renderPluginManifest({
          name: pluginName,
          version: pluginVersion,
          matchedAssets,
        }),
      },
      ...renderCodexCommandAliasArtifacts(commandAssets, layout),
      ...renderCodexSkillArtifacts(skillAssets, layout),
    ],
  }) as GenerationPlan;
}

export function createCodexMarketplaceGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const pluginName = options.pluginName ?? "zc-toolkit";
  const marketplaceName = options.marketplaceName ?? "zc-toolkit";
  const marketplaceDisplayName = options.marketplaceDisplayName ?? "zc AI Coding Toolkit";
  const marketplaceScope = options.scope ?? "project";
  const pluginRoot = marketplaceScope === "global"
    ? `.codex/plugins/${pluginName}`
    : `plugins/${pluginName}`;
  const pluginPlan = createCodexPluginGenerationPlan(manifest, options);
  const repoLayout = getScopeLayout("project");
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");

  return attachPlanMetadata({
    ...pluginPlan,
    capability: {
      ...pluginPlan.capability,
      surfaces: ["plugin-dir", "skills-dir", "agents-dir"],
      entryFile: undefined,
      agents: {
        relativeDir: repoLayout.agentsDir,
        fileExtension: ".toml",
      },
    },
    artifacts: [
      {
        path: templateFiles.marketplace,
        content: renderMarketplaceManifest({
          marketplaceName,
          marketplaceDisplayName,
          pluginName,
          pluginPath: `./${pluginRoot}`,
        }),
      },
      ...pluginPlan.artifacts.map((artifact) => ({
        path: `${pluginRoot}/${artifact.path}`,
        content: artifact.content,
      })),
      ...renderCodexAgentConfigArtifacts(agentAssets, repoLayout),
      ...renderCodexAgentArtifacts(agentAssets, repoLayout),
    ],
  }) as GenerationPlan;
}

export function createCodexInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const generationPlan = createCodexGenerationPlan(manifest, options);

  const installPlan = createInstallPlan(generationPlan, options);

  return {
    ...(installPlan as BaseInstallPlan),
    matchedAssets: generationPlan.matchedAssets,
    capability: generationPlan.capability,
    scope: options.scope ?? "project",
  };
}
