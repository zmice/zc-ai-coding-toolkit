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
  const skillCount = assets.filter((asset) => asset.kind === "skill").length;

  return `# Codex 工作流入口

这是安装到 Codex 的薄入口文件。

它负责三件事：

1. 给出统一任务开始方式
2. 说明固定 workflow 的选路规则
3. 把 \`zc:*\` 命令语义映射成 Codex 实际可调用的 \`$zc-*\` skill

详细方法不写在这里，完整内容都在 \`skills/zc-*/SKILL.md\`。

## 核心规则

- 默认先判断任务属于哪条 workflow，再决定入口
- Codex 侧没有 \`zc:start\` 这类原生命令，请把它们理解为统一语义入口
- 在 Codex 中，统一命令语义通过 \`$zc-*\` skill 来承接
- 中文优先，技术契约保持原样
- 证据先于断言，完成前必须验证
- 不做超出任务边界的顺手修改

## 统一命令语义到 Codex skill 的映射

- \`zc:start\` -> 先判型，再选下面某个 workflow 对应的默认 skill
- \`zc:product-analysis\` -> \`$zc-brainstorming-and-design\`，必要时接 \`$zc-spec-driven-development\`
- \`zc:sdd-tdd\` -> \`$zc-sdd-tdd-workflow\`
- \`zc:spec\` -> \`$zc-spec-driven-development\`
- \`zc:task-plan\` -> \`$zc-planning-and-task-breakdown\`
- \`zc:build\` -> \`$zc-incremental-implementation\`，必要时接 \`$zc-test-driven-development\`
- \`zc:quality-review\` -> \`$zc-code-review-and-quality\`
- \`zc:verify\` -> \`$zc-verification-before-completion\`
- \`zc:debug\` -> \`$zc-debugging-and-error-recovery\`
- \`zc:doc\` -> \`$zc-documentation-and-adrs\`
- \`zc:ship\` -> \`$zc-shipping-and-launch\`
- \`zc:onboard\` -> \`$zc-codebase-onboarding\`
- \`zc:ctx-health\` -> \`$zc-context-engineering\`

## 固定 workflow

### 1. product-analysis

适用：
- 需求还模糊
- 需要先把目标、范围和验收标准收敛清楚

默认 skill：
- \`$zc-brainstorming-and-design\`
- 必要时接 \`$zc-spec-driven-development\`

### 2. full-delivery

适用：
- 新功能、较大改动、完整交付

默认 skill：
- \`$zc-sdd-tdd-workflow\`

### 3. bugfix

适用：
- Bug、失败测试、异常行为

默认 skill：
- \`$zc-debugging-and-error-recovery\`

### 4. review-closure

适用：
- 已有改动，当前重点是审查、反馈处理、收尾

默认 skill：
- \`$zc-code-review-and-quality\`
- 必要时接 \`$zc-review-response-and-resolution\`

### 5. docs-release

适用：
- 文档、ADR、发布说明、发布后同步

默认 skill：
- \`$zc-documentation-and-adrs\`
- 必要时接 \`$zc-release-documentation-sync\`

### 6. investigation

适用：
- 陌生代码库
- 上下文失焦
- 需要先摸清项目或限制

默认 skill：
- \`$zc-codebase-onboarding\`
- 必要时接 \`$zc-context-engineering\`

## 推荐开始方式

- 需求还模糊：先说“先帮我做产品分析”，再调用 \`$zc-brainstorming-and-design\`
- 已确认是完整交付：直接用 \`$zc-sdd-tdd-workflow\`
- 明确是 bug：直接用 \`$zc-debugging-and-error-recovery\`
- 明确是审查：直接用 \`$zc-code-review-and-quality\`

## 已安装能力

此安装当前包含：

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}
- skills：${skillCount} 个

${renderAssetList(assets)}
`;
}

function toCodexSkillDirectory(asset: ToolkitAssetLike): string {
  const skillName = asset.id.replace(/^skill:/, "");
  return `skills/zc-${skillName}`;
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

function renderCodexSkillArtifacts(assets: readonly ToolkitAssetLike[]): readonly PlatformArtifact[] {
  return assets.map((asset) => ({
    path: `${toCodexSkillDirectory(asset)}/SKILL.md`,
    content: renderSkillFile({
      name: `zc-${asset.name ?? asset.id.replace(/^skill:/, "")}`,
      description: asset.summary ?? describeAsset(asset),
      body: asset.body ?? `# ${describeAsset(asset)}\n`,
    }),
  }));
}

export function createCodexGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest, platformName);
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
