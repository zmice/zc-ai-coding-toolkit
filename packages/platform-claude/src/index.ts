import {
  attachPlanMetadata,
  describeAsset,
  prefixArtifacts,
  type InstallPlanOptions,
  type PlatformArtifact,
  type PlatformPlanMetadata,
  type ToolkitAssetLike,
  type ToolkitManifestLike,
} from "@zmice/platform-core";

export type InstallScope = "project" | "global" | "dir";

export type PlatformCapabilitySurface =
  | "entry-file"
  | "commands-dir"
  | "agents-dir";

export interface PlatformCapability {
  readonly platform: typeof platformName;
  readonly namespace: string;
  readonly surfaces: readonly PlatformCapabilitySurface[];
  readonly entryFile: {
    readonly fileName: string;
  };
  readonly commands: {
    readonly relativeDir: string;
    readonly fileExtension: ".md";
  };
  readonly agents: {
    readonly relativeDir: string;
    readonly fileExtension: ".md";
  };
}

export interface GenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
  readonly scope?: InstallScope;
}

export type InstallOptions = GenerationOptions & InstallPlanOptions;

export interface GenerationPlan {
  readonly platform: typeof platformName;
  readonly packageName: string;
  readonly manifestSource: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly capability: PlatformCapability;
  readonly artifacts: readonly PlatformArtifact[];
  readonly metadata?: PlatformPlanMetadata;
}

export interface InstallPlan extends GenerationPlan {
  readonly capability: PlatformCapability;
  readonly destinationRoot: string;
  readonly overwrite: "error" | "force";
  readonly scope: InstallScope;
}

export const platformName = "claude" as const;
export const packageName = "@zmice/platform-claude" as const;

export type {
  PlatformArtifact,
  ToolkitAssetLike,
  ToolkitManifestLike,
};

export const templateFiles = {
  claude: "CLAUDE.md",
} as const;

export const capability: PlatformCapability = {
  platform: platformName,
  namespace: "zc",
  surfaces: ["entry-file", "commands-dir", "agents-dir"],
  entryFile: {
    fileName: templateFiles.claude,
  },
  commands: {
    relativeDir: "commands",
    fileExtension: ".md",
  },
  agents: {
    relativeDir: "agents",
    fileExtension: ".md",
  },
};

function createCapability(scope: InstallScope): PlatformCapability {
  const relativeDir = (dir: string) => (scope === "project" ? `.claude/${dir}` : dir);

  return {
    ...capability,
    commands: {
      ...capability.commands,
      relativeDir: relativeDir("commands"),
    },
    agents: {
      ...capability.agents,
      relativeDir: relativeDir("agents"),
    },
  };
}

function selectMatchedAssetsByKind(
  manifest: ToolkitManifestLike,
  kind: ToolkitAssetLike["kind"],
): readonly ToolkitAssetLike[] {
  return selectMatchedAssets(manifest).filter((asset) => asset.kind === kind);
}

function selectMatchedAssets(
  manifest: ToolkitManifestLike,
): readonly ToolkitAssetLike[] {
  return manifest.assets.filter((asset) => asset.platforms.includes(platformName));
}

function renderAssetList(assets: readonly ToolkitAssetLike[]): string {
  if (assets.length === 0) {
    return "- 尚未匹配到任何工具包资产。";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function renderClaudeFile(
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
  skippedSkills: readonly ToolkitAssetLike[],
): string {
  const commandCount = assets.filter((asset) => asset.kind === "command").length;
  const agentCount = assets.filter((asset) => asset.kind === "agent").length;

  return `# Claude Code 工作流入口

这是安装到 Claude Code 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 指向 \`.claude/commands\`、\`.claude/agents\` 里的详细内容

## 核心规则

- 默认先判断任务属于哪条 workflow，再决定入口
- Claude Code 侧的统一命令语义通过自定义 slash command 承接
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证
- 第一版不伪造 Claude 官方未明确给出的独立 skills 安装面

## 固定 workflow

### 1. product-analysis
- 入口：\`/zc-product-analysis\`
- 适用：需求模糊、范围和验收标准未收敛

### 2. full-delivery
- 入口：\`/zc-sdd-tdd\`
- 适用：新功能、较大改动、完整交付

### 3. bugfix
- 入口：\`/zc-debug\`
- 适用：Bug、失败测试、异常行为

### 4. review-closure
- 入口：\`/zc-quality-review\`
- 适用：已有改动，需要审查与反馈收敛

### 5. docs-release
- 入口：\`/zc-doc\` 或 \`/zc-ship\`
- 适用：文档、ADR、发布说明、上线准备

### 6. investigation
- 入口：\`/zc-onboard\` 或 \`/zc-ctx-health\`
- 适用：陌生代码库、上下文失焦、技术摸底

## 推荐开始方式

- 不确定走哪条线：先用 \`/zc-start\`
- 需求模糊：进 \`/zc-product-analysis\`
- 已确认是完整交付：进 \`/zc-sdd-tdd\`
- 明确是 bug：进 \`/zc-debug\`

## 最常用入口速查

- 做新需求但范围还没收敛：\`/zc-product-analysis\`
- 进入完整交付主流程：\`/zc-sdd-tdd\`
- 修 bug：\`/zc-debug\`
- 做代码审查和反馈收敛：\`/zc-quality-review\`
- 补文档或发布说明：\`/zc-doc\`
- 陌生项目先摸底：\`/zc-onboard\` 或 \`/zc-ctx-health\`

## 详细内容在哪里

- commands：查看 \`.claude/commands/zc-*.md\`
- agents：查看 \`.claude/agents/zc-*.md\`
- 如果入口页不足以判断，就先打开对应 command 或 agent 再继续

## 已安装能力

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- commands：${commandCount} 个
- agents：${agentCount} 个
- 未生成的 skill 资产：${skippedSkills.length} 个

${renderAssetList(assets)}
`;
}

function renderYamlFrontmatter(fields: Record<string, string | readonly string[] | undefined>): string {
  const lines = ["---"];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      lines.push(`${key}:`);
      for (const entry of value) {
        lines.push(`  - ${JSON.stringify(entry)}`);
      }
      continue;
    }

    lines.push(`${key}: ${JSON.stringify(value)}`);
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

function renderMarkdownAgentFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly tools?: readonly string[];
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
    tools: options.tools,
  })}\n${options.body.trim()}\n`;
}

function stripKindPrefix(value: string): string {
  return value.replace(/^(command|skill|agent)[:-]/, "");
}

function toNamespacedSlug(asset: ToolkitAssetLike): string {
  const assetName = "name" in asset && typeof asset.name === "string" ? asset.name : undefined;
  const base = (assetName ?? stripKindPrefix(asset.id))
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return `zc-${base || stripKindPrefix(asset.id)}`;
}

function toScopedRelativeDir(scope: InstallScope, relativeDir: string): string {
  return scope === "project" ? `.claude/${relativeDir}` : relativeDir;
}

function renderCommandArtifacts(
  scope: InstallScope,
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  const relativeDir = toScopedRelativeDir(scope, capability.commands.relativeDir);

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);

    return {
      path: `${relativeDir}/${slug}.md`,
      content: renderMarkdownCommandFile({
        name: slug,
        description: asset.summary ?? describeAsset(asset),
        body: asset.body ?? `# ${describeAsset(asset)}\n`,
      }),
    };
  });
}

function renderAgentArtifacts(
  scope: InstallScope,
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  const relativeDir = toScopedRelativeDir(scope, capability.agents.relativeDir);

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);
    const assetTools =
      "tools" in asset && Array.isArray(asset.tools) ? (asset.tools as readonly string[]) : undefined;

    return {
      path: `${relativeDir}/${slug}.md`,
      content: renderMarkdownAgentFile({
        name: slug,
        description: asset.summary ?? describeAsset(asset),
        body: asset.body ?? `# ${describeAsset(asset)}\n`,
        tools: assetTools,
      }),
    };
  });
}

export function createClaudeGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest);
  const commandAssets = selectMatchedAssetsByKind(manifest, "command");
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");
  const skippedSkills = selectMatchedAssetsByKind(manifest, "skill");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;
  const scope = options.scope ?? "project";
  const scopedCapability = createCapability(scope);

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability: scopedCapability,
    artifacts: [
      {
        path: templateFiles.claude,
        content: renderClaudeFile(manifestSource, matchedAssets, skippedSkills),
      },
      ...renderCommandArtifacts(scope, commandAssets),
      ...renderAgentArtifacts(scope, agentAssets),
    ],
  } as never) as unknown as GenerationPlan;
}

export function createClaudeInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const scope = options.scope ?? "project";
  const generationPlan = createClaudeGenerationPlan(manifest, {
    ...options,
    scope,
  });

  return attachPlanMetadata({
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    scope,
    overwrite: options.overwrite ?? "error",
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  } as never) as unknown as InstallPlan;
}
