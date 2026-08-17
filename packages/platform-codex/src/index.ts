import { createHash } from "node:crypto";

import {
  attachPlanMetadata,
  createAttachmentArtifacts,
  createMarkdownCommandArtifact,
  createSkillArtifact,
  createInstallPlan,
  describeAsset,
  selectMatchedAssets,
  stripAssetKindPrefix,
  type GenerationPlan as BaseGenerationPlan,
  type InstallPlan as BaseInstallPlan,
  type InstallPlanOptions as BaseInstallPlanOptions,
  type PlatformArtifact,
  type ToolkitAssetLike as BaseToolkitAssetLike,
  type ToolkitManifestLike as BaseToolkitManifestLike,
} from "@zmice/platform-core";
export {
  codexContextManagedMarker,
  createCodexContextInitPlan,
  type CodexContextArtifactAction,
  type CodexContextArtifact,
  type CodexContextArtifactPlan,
  type CodexContextExistingFile,
  type CodexContextInitOptions,
  type CodexContextInitPlan,
  type CodexContextInitSnapshot,
  type CodexContextModuleSummary,
} from "./context.js";

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
export type PlatformCapabilitySurface =
  | "entry-file"
  | "plugin-dir"
  | "commands-dir"
  | "skills-dir"
  | "agents-dir";

export interface PlatformCapability {
  readonly platform: typeof platformName;
  readonly namespace: string;
  readonly surfaces: readonly PlatformCapabilitySurface[];
  readonly entryFile?: {
    readonly fileName: string;
  };
  readonly commands?: {
    readonly relativeDir: string;
    readonly fileExtension: ".md";
  };
  readonly skills?: {
    readonly relativeDir: string;
    readonly fileName: "SKILL.md";
  };
  readonly agents?: {
    readonly relativeDir: string;
    readonly fileExtension: ".md" | ".toml";
  };
}

export interface ToolkitAssetLike extends BaseToolkitAssetLike {
  readonly name?: string;
  readonly tier?: string;
  readonly audience?: string;
  readonly stability?: string;
  readonly workflowFamily?: string;
  readonly workflowRole?: string;
  readonly routingWorkflows?: readonly string[];
  readonly taskTypes?: readonly string[];
  readonly platformExposure?: Readonly<Partial<Record<string, string>>>;
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

interface SkillNaming {
  readonly prefix: string;
}

const namespacedSkillNaming: SkillNaming = { prefix: "zc-" };
const pluginSkillNaming: SkillNaming = { prefix: "" };

function createPluginMentionNaming(pluginName: string): SkillNaming {
  return { prefix: `${pluginName}:` };
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

function getCodexExposure(asset: ToolkitAssetLike): string {
  return asset.platformExposure?.[platformName] ?? "listed";
}

function getCommandSlug(asset: ToolkitAssetLike): string {
  return toCodexSkillSlug(asset);
}

function createCommandIndex(
  assets: readonly ToolkitAssetLike[],
): ReadonlyMap<string, ToolkitAssetLike> {
  return new Map(
    assets
      .filter((asset) => asset.kind === "command" && getCodexExposure(asset) !== "hidden")
      .map((asset) => [getCommandSlug(asset), asset]),
  );
}

function pickCommands(
  commandIndex: ReadonlyMap<string, ToolkitAssetLike>,
  names: readonly string[],
): readonly ToolkitAssetLike[] {
  return names
    .map((name) => commandIndex.get(name))
    .filter((asset): asset is ToolkitAssetLike => Boolean(asset));
}

function uniqueCommands(commands: readonly ToolkitAssetLike[]): readonly ToolkitAssetLike[] {
  const seen = new Set<string>();
  const result: ToolkitAssetLike[] = [];

  for (const command of commands) {
    if (seen.has(command.id)) {
      continue;
    }

    seen.add(command.id);
    result.push(command);
  }

  return result;
}

function excludeCommands(
  commands: readonly ToolkitAssetLike[],
  excluded: readonly ToolkitAssetLike[],
): readonly ToolkitAssetLike[] {
  const excludedIds = new Set(excluded.map((asset) => asset.id));

  return commands.filter((asset) => !excludedIds.has(asset.id));
}

function renderCommandEntryList(
  commands: readonly ToolkitAssetLike[],
  naming: SkillNaming,
): string {
  if (commands.length === 0) {
    return "- 当前安装清单未提供该类入口。";
  }

  return commands
    .map((asset) => `- \`$${toCodexSkillName(asset, naming)}\`: ${asset.summary ?? describeAsset(asset)}`)
    .join("\n");
}

function renderCodexEntryGuide(
  assets: readonly ToolkitAssetLike[],
  naming: SkillNaming,
): string {
  const commandIndex = createCommandIndex(assets);
  const allCommands = Array.from(commandIndex.values());
  const primary = pickCommands(commandIndex, ["start"]);
  const workflow = pickCommands(commandIndex, [
    "product-analysis",
    "sdd-tdd",
    "debug",
    "quality-review",
    "doc",
    "onboard",
    "ctx-health",
  ]);
  const stage = pickCommands(commandIndex, [
    "task-plan",
    "spec",
    "build",
    "verify",
    "plan-review",
    "idea",
    "ship",
  ]);
  const governance = pickCommands(commandIndex, [
    "context-init",
    "learn",
    "retro",
    "commit",
    "ci",
  ]);
  const guardrails = pickCommands(commandIndex, ["guard", "careful", "freeze"]);
  const alreadyGrouped = uniqueCommands([
    ...primary,
    ...workflow,
    ...stage,
    ...governance,
    ...guardrails,
  ]);
  const specialist = excludeCommands(allCommands, alreadyGrouped);

  return `## 入口选择

这里控制的是推荐入口顺序，不裁剪 Codex 安装资产。所有匹配 Codex 的 assets 都会生成到插件或项目目录中。

### 默认入口

${renderCommandEntryList(primary, naming)}

### 固定 workflow 入口

${renderCommandEntryList(workflow, naming)}

### 阶段 / 收尾入口

${renderCommandEntryList(stage, naming)}

### 专项入口（按需召回）

${renderCommandEntryList(specialist, naming)}

### 上下文、发布和治理入口

${renderCommandEntryList(governance, naming)}

### 防护入口

${renderCommandEntryList(guardrails, naming)}
`;
}

function renderAgentsFile(
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
): string {
  const commandAssets = assets.filter((asset) => asset.kind === "command");
  const commandCount = assets.filter((asset) => asset.kind === "command").length;
  const skillCount = assets.filter((asset) => asset.kind === "skill").length;
  const agentCount = assets.filter((asset) => asset.kind === "agent").length;
  const commandMappings = commandAssets.length > 0
    ? commandAssets
      .map((asset) => {
        const commandName = toCodexSkillSlug(asset);
        return `- \`zc:${commandName}\` -> \`$${toCodexSkillName(asset, namespacedSkillNaming)}\``;
      })
      .join("\n")
    : "- 当前清单未匹配 command-alias skill";

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
- 多 agent 触发以 \`agent_opportunity.dispatch_now\` 为准；为 \`yes\` 时必须真实派发可用 Codex agent，或说明平台能力不足并降级
- 写入型 agent 必须有文件所有权、loop budget 和 fan-in 验证

${renderCodexEntryGuide(assets, namespacedSkillNaming)}

## 统一命令语义到 Codex skill 的映射

${commandMappings}

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
`;
}

function renderPluginCompanionAgentsFile(options: {
  readonly manifestSource: string;
  readonly assets: readonly ToolkitAssetLike[];
  readonly pluginName: string;
  readonly displayEntryFile: string;
  readonly displayPluginCommandsDir: string;
  readonly displayPluginSkillsDir: string;
  readonly displayPluginAgentsDir: string;
}): string {
  const commandAssets = options.assets.filter((asset) => asset.kind === "command");
  const skillCount = options.assets.filter((asset) => asset.kind === "skill").length;
  const agentCount = options.assets.filter((asset) => asset.kind === "agent").length;
  const pluginMentionNaming = createPluginMentionNaming(options.pluginName);
  const compatibilityExamples = commandAssets.length > 0
    ? commandAssets
      .slice(0, 5)
      .map((asset) => {
        const commandName = toCodexSkillSlug(asset);
        return `- \`zc:${commandName}\` -> \`$${toCodexSkillName(asset, pluginMentionNaming)}\``;
      })
      .join("\n")
    : "- 当前清单未匹配 command-alias skill";

  return `# Codex zc-toolkit 插件入口

这是 \`${options.pluginName}\` Codex 插件的薄入口文件。

它负责保留插件安装后的全局 / 项目级默认规则，并指向插件内 skill。详细方法不写在这里，完整内容都在 \`${options.displayPluginSkillsDir}/<skill>/SKILL.md\`。

## 全局规则

- 默认先判断任务属于哪条 workflow，再决定入口
- 不确定入口时，先用 \`$${options.pluginName}:start\`
- 中文优先，命令名、参数名、文件名、JSON 键和平台产物名保持原样
- 证据先于断言，完成前必须给出实际验证结果
- 不做超出任务边界的顺手修改
- 多 agent 触发以 \`agent_opportunity.dispatch_now\` 为准；为 \`yes\` 时必须真实派发插件内可用 agent，或说明平台能力不足并降级
- 写入型 agent 必须有文件所有权、loop budget 和 fan-in 验证

${renderCodexEntryGuide(options.assets, pluginMentionNaming)}

## Codex 调用方式

- Codex 中通过插件 namespace 调用 skill，例如 \`$${options.pluginName}:start\`、\`$${options.pluginName}:context-init\`、\`$${options.pluginName}:quality-review\`
- 插件同时提供原生 command 文件；实际 slash command 名称以 Codex 展示的插件 namespace 为准
- 如果旧文档或跨平台说明里出现 \`zc:*\`，它是稳定兼容语义名
- 常见兼容示例：
${compatibilityExamples}

## 详细内容在哪里

- 插件 commands：\`${options.displayPluginCommandsDir}/<command>.md\`
- 插件 skills：\`${options.displayPluginSkillsDir}/<command-or-skill>/SKILL.md\`
- 插件 agents：\`${options.displayPluginAgentsDir}/<agent>.md\`
- 当前入口文件：\`${options.displayEntryFile}\`

## 已安装能力

此安装当前包含：

- 清单来源：\`${options.manifestSource}\`
- 匹配到的资产：${options.assets.length}
- command-alias skills：${commandAssets.length} 个
- skills：${skillCount} 个
- plugin agents：${agentCount} 个
`;
}

function renderPluginManifest(options: {
  readonly name: string;
  readonly version: string;
}): string {
  return `${JSON.stringify(
    {
      name: options.name,
      version: options.version,
      description: "Codex 工程工作流：规划、实现、审查、验证、多代理协作与 UI/UX。",
      author: {
        name: "zc",
        url: "https://github.com/zmice",
      },
      homepage: "https://github.com/zmice/zc-ai-coding-toolkit",
      repository: "https://github.com/zmice/zc-ai-coding-toolkit",
      license: "MIT",
      keywords: [
        "codex",
        "skills",
        "workflow",
        "multi-agent",
        "ui",
        "ux",
        "accessibility",
      ],
      skills: "./skills/",
      interface: {
        displayName: "zc AI Coding Toolkit",
        shortDescription: "Codex 工程与 UI/UX 工作流",
        longDescription:
          "为 Codex 安装规划、实现、审查、验证、多代理协作和 UI/UX 工程能力。",
        developerName: "zc",
        category: "Developer Tools",
        capabilities: ["Read", "Write"],
        defaultPrompt: [
          "使用 start 为当前任务选择合适的工作流。",
          "界面实现使用 ui；只读 UI/UX 审查使用 ui-ux-review。",
          "仅在任务可独立拆分时使用 team-orchestration 组织多代理协作。",
        ],
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
  return stripAssetKindPrefix(asset.id);
}

function toCodexSkillName(asset: ToolkitAssetLike, naming: SkillNaming): string {
  return `${naming.prefix}${asset.name ?? toCodexSkillSlug(asset)}`;
}

function toCodexSkillDirectory(
  asset: ToolkitAssetLike,
  layout: ScopeLayout,
  naming: SkillNaming,
): string {
  return `${layout.skillsDir}/${naming.prefix}${toCodexSkillSlug(asset)}`;
}

function toCodexAgentName(asset: ToolkitAssetLike): string {
  return `zc_${toCodexSkillSlug(asset).replace(/[^A-Za-z0-9_]+/g, "_")}`;
}

function renderTomlScalar(value: string): string {
  return JSON.stringify(value);
}

function renderCodexCommandAliasBody(asset: ToolkitAssetLike, naming: SkillNaming): string {
  const commandName = toCodexSkillSlug(asset);
  const invocationName = `${naming.prefix}${commandName}`;
  const title = naming.prefix.length > 0 ? `zc:${commandName}` : commandName;
  const compatibilityLine = naming.prefix.length > 0
    ? `- 它对应统一命令语义 \`zc:${commandName}\``
    : `- 兼容语义名：\`zc:${commandName}\`（仅用于旧文档或跨平台说明，不是 Codex 原生命令）`;

  return `# ${title}

这是 Codex 的 command-alias skill。

使用方式：

- 在 Codex 中直接调用 \`$${invocationName}\`
${compatibilityLine}
- 如果需要更深的方法细节，再继续调用相关专题 skill

${(asset.body ?? `# ${describeAsset(asset)}\n`).trim()}
`;
}

function renderCodexSkillArtifacts(
  assets: readonly ToolkitAssetLike[],
  layout: ScopeLayout,
  naming: SkillNaming = namespacedSkillNaming,
): readonly PlatformArtifact[] {
  return assets.flatMap((asset) => {
    const directory = toCodexSkillDirectory(asset, layout, naming);

    return [
      createSkillArtifact({
        path: `${directory}/SKILL.md`,
        asset,
        name: toCodexSkillName(asset, naming),
        description: asset.summary ?? describeAsset(asset),
        body: asset.body ?? `# ${describeAsset(asset)}\n`,
      }),
      ...createAttachmentArtifacts({ directory, asset }),
    ];
  });
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
        ...(asset.codexAgent?.model
          ? [`model = ${renderTomlScalar(asset.codexAgent.model)}`]
          : []),
        ...(asset.codexAgent?.modelReasoningEffort
          ? [`model_reasoning_effort = ${renderTomlScalar(asset.codexAgent.modelReasoningEffort)}`]
          : []),
        ...(asset.codexAgent?.sandboxMode
          ? [`sandbox_mode = ${renderTomlScalar(asset.codexAgent.sandboxMode)}`]
          : []),
        `developer_instructions = ${renderTomlScalar(
          asset.body ?? `# ${describeAsset(asset)}\n`,
        )}`,
        "",
      ].join("\n"),
    };
  });
}

function hashCodexCompanionContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function renderCodexCompanionAgentArtifacts(
  assets: readonly ToolkitAssetLike[],
  options: {
    readonly pluginName: string;
    readonly marketplaceName: string;
    readonly pluginVersion: string;
  },
): readonly PlatformArtifact[] {
  const layout = getScopeLayout("dir");
  const agentArtifacts = renderCodexAgentArtifacts(assets, layout);
  const configContent = renderCodexAgentConfigArtifacts(assets, layout)[0]?.content ?? "";
  const agents = assets.map((asset, index) => {
    const artifact = agentArtifacts[index]!;

    return {
      name: toCodexAgentName(asset),
      path: artifact.path,
      sha256: hashCodexCompanionContent(artifact.content),
    };
  });
  const contentFingerprint = hashCodexCompanionContent(JSON.stringify(agents));

  return [
    {
      path: "assets/zc-agents/manifest.json",
      content: `${JSON.stringify({
        schemaVersion: 1,
        pluginId: `${options.pluginName}@${options.marketplaceName}`,
        pluginVersion: options.pluginVersion,
        contentFingerprint,
        config: {
          path: "config/agents.toml",
          sha256: hashCodexCompanionContent(configContent),
        },
        agents,
      }, null, 2)}\n`,
    },
    {
      path: "assets/zc-agents/config/agents.toml",
      content: configContent,
    },
    ...agentArtifacts.map((artifact) => ({
      path: `assets/zc-agents/${artifact.path}`,
      content: artifact.content,
    })),
  ];
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
  naming: SkillNaming = namespacedSkillNaming,
): readonly PlatformArtifact[] {
  return assets.flatMap((asset) => {
    const directory = toCodexSkillDirectory(asset, layout, naming);

    return [
      createSkillArtifact({
        path: `${directory}/SKILL.md`,
        asset,
        name: toCodexSkillName(asset, naming),
        description: asset.summary ?? describeAsset(asset),
        body: renderCodexCommandAliasBody(asset, naming),
      }),
      ...createAttachmentArtifacts({ directory, asset }),
    ];
  });
}

function renderCodexPluginCommandArtifacts(
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  return assets.map((asset) => {
    const slug = toCodexSkillSlug(asset);

    return createMarkdownCommandArtifact({
      path: `commands/${slug}.md`,
      asset,
      name: slug,
      description: asset.summary ?? describeAsset(asset),
      body: asset.body ?? `# /${slug}\n`,
    });
  });
}

function renderCodexPluginAgentArtifacts(
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  return assets.map((asset) => {
    const slug = toCodexSkillSlug(asset);

    return createMarkdownCommandArtifact({
      path: `agents/${slug}.md`,
      asset,
      name: slug,
      description: asset.summary ?? describeAsset(asset),
      body: asset.body ?? `# ${describeAsset(asset)}\n`,
    });
  });
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
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;
  const pluginName = options.pluginName ?? "zc-toolkit";
  const pluginVersion = options.pluginVersion ?? "0.0.0";
  const marketplaceName = options.marketplaceName ?? pluginName;

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability: {
      ...createCapability(layout),
      surfaces: ["plugin-dir", "commands-dir", "skills-dir", "agents-dir"],
      entryFile: undefined,
      commands: {
        relativeDir: "commands",
        fileExtension: ".md",
      },
      agents: {
        relativeDir: "agents",
        fileExtension: ".md",
      },
    },
    artifacts: [
      {
        path: templateFiles.pluginManifest,
        content: renderPluginManifest({
          name: pluginName,
          version: pluginVersion,
        }),
      },
      ...renderCodexPluginCommandArtifacts(commandAssets),
      ...renderCodexCommandAliasArtifacts(commandAssets, layout, pluginSkillNaming),
      ...renderCodexSkillArtifacts(skillAssets, layout, pluginSkillNaming),
      ...renderCodexPluginAgentArtifacts(agentAssets),
      ...renderCodexCompanionAgentArtifacts(agentAssets, {
        pluginName,
        marketplaceName,
        pluginVersion,
      }),
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
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const entryFile = marketplaceScope === "global"
    ? ".codex/AGENTS.md"
    : templateFiles.agents;
  const displayEntryFile = marketplaceScope === "global"
    ? "~/.codex/AGENTS.md"
    : templateFiles.agents;
  const displayPluginSkillsDir = marketplaceScope === "global"
    ? `~/.codex/plugins/${pluginName}/skills`
    : `${pluginRoot}/skills`;
  const displayPluginCommandsDir = marketplaceScope === "global"
    ? `~/.codex/plugins/${pluginName}/commands`
    : `${pluginRoot}/commands`;
  const displayPluginAgentsDir = marketplaceScope === "global"
    ? `~/.codex/plugins/${pluginName}/agents`
    : `${pluginRoot}/agents`;

  return attachPlanMetadata({
    ...pluginPlan,
    capability: {
      ...pluginPlan.capability,
      surfaces: ["entry-file", "plugin-dir", "commands-dir", "skills-dir", "agents-dir"],
      entryFile: {
        fileName: entryFile,
      },
      skills: {
        relativeDir: `${pluginRoot}/skills`,
        fileName: capability.skills!.fileName,
      },
      commands: {
        relativeDir: `${pluginRoot}/commands`,
        fileExtension: ".md",
      },
      agents: {
        relativeDir: `${pluginRoot}/agents`,
        fileExtension: ".md",
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
      {
        path: entryFile,
        content: renderPluginCompanionAgentsFile({
          manifestSource,
          assets: pluginPlan.matchedAssets,
          pluginName,
          displayEntryFile,
          displayPluginCommandsDir,
          displayPluginSkillsDir,
          displayPluginAgentsDir,
        }),
      },
      ...pluginPlan.artifacts.map((artifact) => ({
        path: `${pluginRoot}/${artifact.path}`,
        content: artifact.content,
      })),
    ],
  }) as GenerationPlan;
}

export function createCodexAgentGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const scope = options.scope ?? "dir";
  const layout = getScopeLayout(scope);
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets: agentAssets,
    capability: {
      ...createCapability(layout),
      surfaces: ["agents-dir"],
      entryFile: undefined,
      skills: undefined,
    },
    artifacts: [
      ...renderCodexAgentConfigArtifacts(agentAssets, layout),
      ...renderCodexAgentArtifacts(agentAssets, layout),
    ],
  }) as GenerationPlan;
}

export function createCodexAgentInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const generationPlan = createCodexAgentGenerationPlan(manifest, options);
  const installPlan = createInstallPlan(generationPlan, options);

  return {
    ...(installPlan as BaseInstallPlan),
    matchedAssets: generationPlan.matchedAssets,
    capability: generationPlan.capability,
    scope: options.scope ?? "project",
  };
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
