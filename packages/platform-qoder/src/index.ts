import {
  attachPlanMetadata,
  describeAsset,
  prefixArtifacts,
  selectMatchedAssets,
  type GenerationPlan as BaseGenerationPlan,
  type InstallPlan as BaseInstallPlan,
  type InstallPlanOptions,
  type PlatformArtifact,
  type ToolkitAssetLike,
  type ToolkitManifestLike,
} from "@zmice/platform-core";

export type InstallScope = "project" | "global" | "dir";

export type PlatformCapabilitySurface =
  | "entry-file"
  | "commands-dir"
  | "skills-dir"
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
  readonly skills: {
    readonly relativeDir: string;
    readonly fileName: "SKILL.md";
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

export interface GenerationPlan extends BaseGenerationPlan {
  readonly capability: PlatformCapability;
}

export interface InstallPlan extends BaseInstallPlan {
  readonly capability: PlatformCapability;
  readonly scope: InstallScope;
}

export const platformName = "qoder" as const;
export const packageName = "@zmice/platform-qoder" as const;

export type {
  PlatformArtifact,
  ToolkitAssetLike,
  ToolkitManifestLike,
};

export const templateFiles = {
  agents: "AGENTS.md",
} as const;

export const capability: PlatformCapability = {
  platform: platformName,
  namespace: "zc",
  surfaces: ["entry-file", "commands-dir", "skills-dir", "agents-dir"],
  entryFile: {
    fileName: templateFiles.agents,
  },
  commands: {
    relativeDir: "commands",
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
};

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

function renderAgentsFile(manifestSource: string, assets: readonly ToolkitAssetLike[]): string {
  const commandCount = assets.filter((asset) => asset.kind === "command").length;
  const skillCount = assets.filter((asset) => asset.kind === "skill").length;
  const agentCount = assets.filter((asset) => asset.kind === "agent").length;

  return `# Qoder 工作流入口

这是安装到 Qoder 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 指向 \`.qoder/commands\`、\`.qoder/skills\`、\`.qoder/agents\` 里的详细内容

## 核心规则

- 默认先评估任务类型，再选对应 workflow
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证
- 支撑型命令只做辅助，不替代主 workflow

## 固定 workflow

### 1. product-analysis
- 入口：\`zc-product-analysis\`
- 适用：需求模糊、范围未收敛、需要形成可落地方案

### 2. full-delivery
- 入口：\`zc-sdd-tdd\`
- 适用：新功能、较大改动、完整交付

### 3. bugfix
- 入口：\`zc-debug\`
- 适用：Bug、失败测试、异常行为

### 4. review-closure
- 入口：\`zc-quality-review\`
- 适用：已有改动，需要做审查与反馈收敛

### 5. docs-release
- 入口：\`zc-doc\` 或 \`zc-ship\`
- 适用：文档、ADR、发布说明、上线准备

### 6. investigation
- 入口：\`zc-onboard\` 或 \`zc-ctx-health\`
- 适用：陌生代码库、上下文失焦、技术摸底

## 推荐开始方式

- 不确定走哪条线：先用 \`zc-start\`
- 需求模糊：进 \`zc-product-analysis\`
- 已确认要完整交付：进 \`zc-sdd-tdd\`
- 明确是 bug：进 \`zc-debug\`

## 详细内容在哪里

- commands：查看 \`.qoder/commands/zc-*.md\`
- skills：查看 \`.qoder/skills/zc-*/SKILL.md\`
- agents：查看 \`.qoder/agents/zc-*.md\`

## 已安装能力

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- commands：${commandCount} 个
- skills：${skillCount} 个
- agents：${agentCount} 个

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

function stripKindPrefix(value: string): string {
  return value.replace(/^(command|skill|agent):/, "");
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
  return scope === "project" ? `.qoder/${relativeDir}` : relativeDir;
}

function renderCommandArtifacts(
  scope: InstallScope,
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  const relativeDir = toScopedRelativeDir(scope, capability.commands?.relativeDir ?? "commands");

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

function renderSkillArtifacts(
  scope: InstallScope,
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  const relativeDir = toScopedRelativeDir(scope, capability.skills?.relativeDir ?? "skills");

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);

    return {
      path: `${relativeDir}/${slug}/SKILL.md`,
      content: renderSkillFile({
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
  const relativeDir = toScopedRelativeDir(scope, capability.agents?.relativeDir ?? "agents");

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);
    const assetRequires =
      "requires" in asset && Array.isArray(asset.requires)
        ? (asset.requires as readonly string[])
        : undefined;
    const assetTools =
      "tools" in asset && Array.isArray(asset.tools) ? (asset.tools as readonly string[]) : undefined;
    const skillRequires = assetRequires
      ?.filter((entry: string) => entry.startsWith("skill:"))
      .map((entry: string) => `zc-${stripKindPrefix(entry)}` as const);

    return {
      path: `${relativeDir}/${slug}.md`,
      content: renderMarkdownAgentFile({
        name: slug,
        description: asset.summary ?? describeAsset(asset),
        body: asset.body ?? `# ${describeAsset(asset)}\n`,
        tools: assetTools,
        skills: skillRequires,
      }),
    };
  });
}

export function createQoderGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const commandAssets = selectMatchedAssetsByKind(manifest, "command");
  const skillAssets = selectMatchedAssetsByKind(manifest, "skill");
  const agentAssets = selectMatchedAssetsByKind(manifest, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;
  const scope = options.scope ?? "project";

  return attachPlanMetadata({
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability,
    artifacts: [
      {
        path: templateFiles.agents,
        content: renderAgentsFile(manifestSource, matchedAssets),
      },
      ...renderCommandArtifacts(scope, commandAssets),
      ...renderSkillArtifacts(scope, skillAssets),
      ...renderAgentArtifacts(scope, agentAssets),
    ],
  }) as GenerationPlan;
}

export function createQoderInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const scope = options.scope ?? "project";
  const generationPlan = createQoderGenerationPlan(manifest, {
    ...options,
    scope,
  });

  return attachPlanMetadata({
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    scope,
    overwrite: options.overwrite ?? "error",
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  }) as InstallPlan;
}
