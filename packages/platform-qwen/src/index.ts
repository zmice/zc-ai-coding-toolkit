import {
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

export type InstallScope = "project" | "global" | "dir";
export type PlatformCapabilitySurface =
  | "entry-file"
  | "skills-dir"
  | "commands-dir"
  | "agents-dir"
  | "extension-dir";

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
    readonly fileExtension: ".md";
  };
  readonly extension?: {
    readonly relativeDir: string;
    readonly name: string;
    readonly manifestFile: string;
    readonly contextFileName?: string;
  };
}

export interface ToolkitAssetLike extends BaseToolkitAssetLike {
  readonly name?: string;
  readonly tools?: readonly string[];
  readonly requires?: readonly string[];
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

export interface GenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
  readonly scope?: InstallScope;
}

export type InstallOptions = GenerationOptions & InstallPlanOptions;

export const platformName = "qwen" as const;
export const packageName = "@zmice/platform-qwen" as const;

export type {
  PlatformArtifact,
};

export const templateFiles = {
  context: "QWEN.md",
  extensionManifest: "qwen-extension.json",
  extensionName: "zc-toolkit",
} as const;

export const capability: PlatformCapability = {
  platform: platformName,
  namespace: "zc",
  surfaces: ["entry-file", "commands-dir", "skills-dir", "agents-dir", "extension-dir"],
  entryFile: {
    fileName: templateFiles.context,
  },
  commands: {
    relativeDir: "commands/zc",
    fileExtension: ".md",
  },
  skills: {
    relativeDir: "skills",
    fileName: "SKILL.md",
  },
  agents: {
    relativeDir: "agents",
    fileExtension: ".md",
  },
  extension: {
    relativeDir: "extensions",
    name: templateFiles.extensionName,
    manifestFile: templateFiles.extensionManifest,
    contextFileName: templateFiles.context,
  },
};

function stripKindPrefix(asset: ToolkitAssetLike): string {
  const prefix = `${asset.kind}:`;
  return asset.id.startsWith(prefix) ? asset.id.slice(prefix.length) : asset.id;
}

function selectMatchedAssetsByKind(
  manifest: ToolkitManifestLike,
  kind: ToolkitAssetLike["kind"],
): readonly ToolkitAssetLike[] {
  return selectMatchedAssets(manifest, platformName).filter((asset) => asset.kind === kind);
}

function renderYamlFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      lines.push(`${key}:`);
      for (const entry of value) {
        lines.push(`  - ${JSON.stringify(String(entry))}`);
      }
      continue;
    }

    lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }

  lines.push("---");

  return `${lines.join("\n")}\n`;
}

function renderMarkdownCommandFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
  })}\n${options.body.trim()}\n`;
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

function renderMarkdownAgentFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly tools?: readonly string[];
  readonly skills?: readonly string[];
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
    tools: options.tools,
    skills: options.skills,
  })}\n${options.body.trim()}\n`;
}

function getExtensionRoot(scope: InstallScope = "project"): string {
  if (scope === "project") {
    return `.qwen/extensions/${templateFiles.extensionName}`;
  }

  return `extensions/${templateFiles.extensionName}`;
}

function renderAssetList(assets: readonly ToolkitAssetLike[]): string {
  if (assets.length === 0) {
    return "- 尚未匹配到任何工具包资产。";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function renderContextFile(
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
  commands: readonly ToolkitAssetLike[],
  skills: readonly ToolkitAssetLike[],
  agents: readonly ToolkitAssetLike[],
): string {
  return `# Qwen 工作流入口

这是安装到 Qwen extension 里的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 指向 extension 内的 \`commands/\`、\`skills/\`、\`agents/\` 详细内容

## 核心规则

- 默认先评估任务类型，再选对应 workflow
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证
- 命令统一使用 \`zc:\` 命名空间，避免和平台内置能力冲突

## 固定 workflow

### 1. product-analysis
- 入口：\`zc:product-analysis\`
- 适用：需求模糊、价值与范围未收敛

### 2. full-delivery
- 入口：\`zc:sdd-tdd\`
- 适用：新功能、较大改动、完整交付

### 3. bugfix
- 入口：\`zc:debug\`
- 适用：Bug、失败测试、异常行为

### 4. review-closure
- 入口：\`zc:quality-review\`
- 适用：已有改动，需要审查与反馈收敛

### 5. docs-release
- 入口：\`zc:doc\` 或 \`zc:ship\`
- 适用：文档、ADR、发布说明、上线准备

### 6. investigation
- 入口：\`zc:onboard\` 或 \`zc:ctx-health\`
- 适用：陌生代码库、上下文失焦、技术摸底

## 推荐开始方式

- 不确定走哪条线：先用 \`zc:start\`
- 需求模糊：进 \`zc:product-analysis\`
- 已确认是完整交付：进 \`zc:sdd-tdd\`
- 明确是 bug：进 \`zc:debug\`

## 详细内容在哪里

- commands：\`commands/zc/*.md\`
- skills：\`skills/zc-*/SKILL.md\`
- agents：\`agents/zc-*.md\`

## 已安装能力

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- 命令入口：${commands.length} 个，统一暴露为 \`zc:<command>\`
- skills：${skills.length} 个
- agents：${agents.length} 个

${renderAssetList(assets)}
`;
}

function renderExtensionManifest(
  packageName: string,
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
  commands: readonly ToolkitAssetLike[],
  skills: readonly ToolkitAssetLike[],
  agents: readonly ToolkitAssetLike[],
): string {
  return `${JSON.stringify(
    {
      name: templateFiles.extensionName,
      packageName,
      platform: platformName,
      namespace: capability.namespace,
      manifestSource,
      extensionType: "toolkit-bundle",
      contextFile: templateFiles.context,
      commandsDir: capability.commands?.relativeDir,
      skillsDir: capability.skills?.relativeDir,
      agentsDir: capability.agents?.relativeDir,
      assetCount: assets.length,
      commandCount: commands.length,
      skillCount: skills.length,
      agentCount: agents.length,
    },
    null,
    2,
  )}\n`;
}

function renderCommandArtifact(
  extensionRoot: string,
  asset: ToolkitAssetLike,
): PlatformArtifact {
  const slug = stripKindPrefix(asset);

  return {
    path: `${extensionRoot}/commands/zc/${slug}.md`,
    content: renderMarkdownCommandFile({
      name: `zc:${slug}`,
      description: describeAsset(asset),
      body:
        asset.body ??
        `这是由工具包资产 \`${asset.id}\` 生成的 Qwen 命令入口，用于触发 \`zc:${slug}\`。`,
    }),
  };
}

function renderSkillArtifact(
  extensionRoot: string,
  asset: ToolkitAssetLike,
): PlatformArtifact {
  const slug = stripKindPrefix(asset);

  return {
    path: `${extensionRoot}/skills/zc-${slug}/SKILL.md`,
    content: renderSkillFile({
      name: `zc-${slug}`,
      description: describeAsset(asset),
      body:
        asset.body ??
        `这是由工具包资产 \`${asset.id}\` 生成的 Qwen skill，供 extension 目录直接加载。`,
    }),
  };
}

function renderAgentArtifact(
  extensionRoot: string,
  asset: ToolkitAssetLike,
): PlatformArtifact {
  const slug = stripKindPrefix(asset);
  const skillRefs = asset.requires
    ?.filter((entry) => entry.startsWith("skill:"))
    .map((entry) => `zc-${entry.slice("skill:".length)}`);

  return {
    path: `${extensionRoot}/agents/zc-${slug}.md`,
    content: renderMarkdownAgentFile({
      name: `zc-${slug}`,
      description: describeAsset(asset),
      body:
        asset.body ??
        `这是由工具包资产 \`${asset.id}\` 生成的 Qwen agent，用于承接 \`zc-${slug}\` 角色能力。`,
      tools: asset.tools,
      skills: skillRefs,
    }),
  };
}

export function createQwenGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const commands = selectMatchedAssetsByKind(manifest, "command");
  const skills = selectMatchedAssetsByKind(manifest, "skill");
  const agents = selectMatchedAssetsByKind(manifest, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;
  const extensionRoot = getExtensionRoot(options.scope);

  return {
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability,
    artifacts: [
      {
        path: `${extensionRoot}/${templateFiles.context}`,
        content: renderContextFile(manifestSource, matchedAssets, commands, skills, agents),
      },
      {
        path: `${extensionRoot}/${templateFiles.extensionManifest}`,
        content: renderExtensionManifest(
          resolvedPackageName,
          manifestSource,
          matchedAssets,
          commands,
          skills,
          agents,
        ),
      },
      ...commands.map((asset: ToolkitAssetLike) => renderCommandArtifact(extensionRoot, asset)),
      ...skills.map((asset: ToolkitAssetLike) => renderSkillArtifact(extensionRoot, asset)),
      ...agents.map((asset: ToolkitAssetLike) => renderAgentArtifact(extensionRoot, asset)),
    ],
  };
}

export function createQwenInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const generationPlan = createQwenGenerationPlan(manifest, {
    ...options,
    scope: options.scope,
  });
  const installPlan = createInstallPlan(generationPlan, options);

  return {
    ...(installPlan as BaseInstallPlan),
    matchedAssets: generationPlan.matchedAssets,
    capability,
    scope: options.scope ?? "project",
  };
}
