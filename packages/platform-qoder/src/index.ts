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
  return `# Qoder 平台说明

此工件由工具包资产生成。

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}

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
