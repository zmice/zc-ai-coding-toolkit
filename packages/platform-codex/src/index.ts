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
}

export type InstallScope = "project" | "global" | "dir";
export type PlatformCapabilitySurface = "entry-file" | "skills-dir";

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
} as const;

export const capability: PlatformCapability = {
  platform: platformName,
  namespace: "zc",
  surfaces: ["entry-file", "skills-dir"],
  entryFile: {
    fileName: templateFiles.agents,
  },
  skills: {
    relativeDir: "skills",
    fileName: "SKILL.md",
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

  return `# Codex 工作流入口

这是安装到 Codex 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 把 \`zc:*\` 命令语义映射成 Codex 实际可调用的 \`$zc-*\` skill

详细方法不写在这里，完整内容都在 \`skills/zc-*/SKILL.md\`。
其中：

- \`$zc-start\`、\`$zc-spec\`、\`$zc-build\` 这类是 command-alias skill
- \`$zc-sdd-tdd-workflow\`、\`$zc-debugging-and-error-recovery\` 这类是专题/流程 skill

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

## 已安装能力

此安装当前包含：

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- command-alias skills：${commandCount} 个
- skills：${skillCount} 个

${renderAssetList(assets)}
`;
}

function toCodexSkillSlug(asset: ToolkitAssetLike): string {
  return asset.id.replace(/^(skill|command):/, "");
}

function toCodexSkillDirectory(asset: ToolkitAssetLike): string {
  return `skills/zc-${toCodexSkillSlug(asset)}`;
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

function renderCodexSkillArtifacts(assets: readonly ToolkitAssetLike[]): readonly PlatformArtifact[] {
  return assets.map((asset) => ({
    path: `${toCodexSkillDirectory(asset)}/SKILL.md`,
    content: renderSkillFile({
      name: `zc-${asset.name ?? toCodexSkillSlug(asset)}`,
      description: asset.summary ?? describeAsset(asset),
      body: asset.body ?? `# ${describeAsset(asset)}\n`,
    }),
  }));
}

function renderCodexCommandAliasArtifacts(assets: readonly ToolkitAssetLike[]): readonly PlatformArtifact[] {
  return assets.map((asset) => ({
    path: `${toCodexSkillDirectory(asset)}/SKILL.md`,
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
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const commandAssets = selectMatchedAssetsByKind(manifest, "command");
  const skillAssets = selectMatchedAssetsByKind(manifest, "skill");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;

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
      ...renderCodexCommandAliasArtifacts(commandAssets),
      ...renderCodexSkillArtifacts(skillAssets),
    ],
  }) as GenerationPlan;
}

export function createCodexInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const generationPlan = createCodexGenerationPlan(manifest, options);

  if (options.scope === "project") {
    const installPlan = createInstallPlan(
      {
        ...generationPlan,
        artifacts: generationPlan.artifacts.filter((artifact) => artifact.path === templateFiles.agents),
      },
      options,
    );

    return {
      ...(installPlan as BaseInstallPlan),
      matchedAssets: generationPlan.matchedAssets,
      capability,
      scope: options.scope ?? "project",
    };
  }

  const installPlan = createInstallPlan(generationPlan, options);

  return {
    ...(installPlan as BaseInstallPlan),
    matchedAssets: generationPlan.matchedAssets,
    capability,
    scope: options.scope ?? "project",
  };
}
