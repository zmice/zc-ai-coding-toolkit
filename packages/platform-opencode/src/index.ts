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

export const platformName = "opencode" as const;
export const packageName = "@zmice/platform-opencode" as const;

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
    relativeDir: ".opencode/commands",
    fileExtension: ".md",
  },
  skills: {
    relativeDir: ".opencode/skills",
    fileName: "SKILL.md",
  },
  agents: {
    relativeDir: ".opencode/agents",
    fileExtension: ".md",
  },
};

function createCapability(layout: ScopeLayout): PlatformCapability {
  return {
    ...capability,
    commands: {
      ...capability.commands,
      relativeDir: layout.commandsDir,
    },
    skills: {
      ...capability.skills,
      relativeDir: layout.skillsDir,
    },
    agents: {
      ...capability.agents,
      relativeDir: layout.agentsDir,
    },
  };
}

interface ScopeLayout {
  readonly entryFile: string;
  readonly commandsDir: string;
  readonly skillsDir: string;
  readonly agentsDir: string;
  readonly displayCommandsDir: string;
  readonly displaySkillsDir: string;
  readonly displayAgentsDir: string;
}

function getScopeLayout(scope: InstallScope): ScopeLayout {
  if (scope === "global") {
    return {
      entryFile: "AGENTS.md",
      commandsDir: "commands",
      skillsDir: "skills",
      agentsDir: "agents",
      displayCommandsDir: "~/.config/opencode/commands",
      displaySkillsDir: "~/.config/opencode/skills",
      displayAgentsDir: "~/.config/opencode/agents",
    };
  }

  if (scope === "dir") {
    return {
      entryFile: "AGENTS.md",
      commandsDir: "commands",
      skillsDir: "skills",
      agentsDir: "agents",
      displayCommandsDir: "commands",
      displaySkillsDir: "skills",
      displayAgentsDir: "agents",
    };
  }

  return {
    entryFile: templateFiles.agents,
    commandsDir: ".opencode/commands",
    skillsDir: ".opencode/skills",
    agentsDir: ".opencode/agents",
    displayCommandsDir: ".opencode/commands",
    displaySkillsDir: ".opencode/skills",
    displayAgentsDir: ".opencode/agents",
  };
}

function isSupportedAsset(asset: ToolkitAssetLike): boolean {
  return asset.kind === "command" || asset.kind === "skill" || asset.kind === "agent";
}

function selectMatchedAssetsByKind(
  manifest: ToolkitManifestLike,
  kind: ToolkitAssetLike["kind"],
): readonly ToolkitAssetLike[] {
  return selectMatchedAssets(manifest, platformName).filter(
    (asset) => isSupportedAsset(asset) && asset.kind === kind,
  );
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

  return `# OpenCode 工作流入口

这是安装到 OpenCode 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 指向 \`${layout.displayCommandsDir}\`、\`${layout.displaySkillsDir}\`、\`${layout.displayAgentsDir}\` 里的详细内容

## 核心规则

- 默认先判断任务属于哪条 workflow，再决定入口
- OpenCode 侧通过自定义 \`/zc-*\` command 和按需加载 skills 承接统一语义
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证

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

- commands：查看 \`${layout.displayCommandsDir}/zc-*.md\`
- skills：查看 \`${layout.displaySkillsDir}/zc-*/SKILL.md\`
- agents：查看 \`${layout.displayAgentsDir}/zc-*.md\`
- 如果入口页不足以判断，就先打开对应 command、skill 或 agent 再继续

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
  readonly description: string;
  readonly body: string;
}): string {
  return `${renderYamlFrontmatter({
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
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
    tools: options.tools,
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

function renderCommandArtifacts(
  scope: InstallScope,
  assets: readonly ToolkitAssetLike[],
): readonly PlatformArtifact[] {
  const layout = getScopeLayout(scope);

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);

    return {
      path: `${layout.commandsDir}/${slug}.md`,
      content: renderMarkdownCommandFile({
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
  const layout = getScopeLayout(scope);

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);

    return {
      path: `${layout.skillsDir}/${slug}/SKILL.md`,
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
  const layout = getScopeLayout(scope);

  return assets.map((asset) => {
    const slug = toNamespacedSlug(asset);
    const assetTools =
      "tools" in asset && Array.isArray(asset.tools) ? (asset.tools as readonly string[]) : undefined;

    return {
      path: `${layout.agentsDir}/${slug}.md`,
      content: renderMarkdownAgentFile({
        name: slug,
        description: asset.summary ?? describeAsset(asset),
        body: asset.body ?? `# ${describeAsset(asset)}\n`,
        tools: assetTools,
      }),
    };
  });
}

export function createOpenCodeGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const scope = options.scope ?? "project";
  const layout = getScopeLayout(scope);
  const scopedCapability = createCapability(layout);
  const matchedAssets = selectMatchedAssets(manifest, platformName).filter((asset) =>
    isSupportedAsset(asset),
  );
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
    capability: scopedCapability,
    artifacts: [
      {
        path: layout.entryFile,
        content: renderAgentsFile(manifestSource, matchedAssets, layout),
      },
      ...renderCommandArtifacts(scope, commandAssets),
      ...renderSkillArtifacts(scope, skillAssets),
      ...renderAgentArtifacts(scope, agentAssets),
    ],
  }) as GenerationPlan;
}

export function createOpenCodeInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const scope = options.scope ?? "project";
  const generationPlan = createOpenCodeGenerationPlan(manifest, {
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
