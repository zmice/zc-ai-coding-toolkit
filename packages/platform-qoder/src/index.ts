import {
  createInstallPlan,
  describeAsset,
  selectMatchedAssets,
  type GenerationPlan,
  type InstallPlan,
  type InstallPlanOptions,
  type PlatformArtifact,
  type ToolkitAssetLike,
  type ToolkitManifestLike,
} from "@zmice/platform-core";

export interface GenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
}

export type InstallOptions = GenerationOptions & InstallPlanOptions;

export const platformName = "qoder" as const;
export const packageName = "@zmice/platform-qoder" as const;

export type {
  GenerationPlan,
  InstallPlan,
  PlatformArtifact,
  ToolkitAssetLike,
  ToolkitManifestLike,
};

export const templateFiles = {
  agents: "AGENTS.md",
} as const;

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

export function createQoderGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest, platformName);
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? packageName;

  return {
    platform: platformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    artifacts: [
      {
        path: templateFiles.agents,
        content: renderAgentsFile(manifestSource, matchedAssets),
      },
    ],
  };
}

export function createQoderInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  return createInstallPlan(createQoderGenerationPlan(manifest, options), options);
}
