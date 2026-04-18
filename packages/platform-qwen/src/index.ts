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

export const platformName = "qwen" as const;
export const packageName = "@zmice/platform-qwen" as const;

export type {
  GenerationPlan,
  InstallPlan,
  PlatformArtifact,
  ToolkitAssetLike,
  ToolkitManifestLike,
};

export const templateFiles = {
  context: "QWEN.md",
  extensionManifest: "qwen-extension.json",
} as const;

function renderAssetList(assets: readonly ToolkitAssetLike[]): string {
  if (assets.length === 0) {
    return "- 尚未匹配到任何工具包资产。";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function renderContextFile(manifestSource: string, assets: readonly ToolkitAssetLike[]): string {
  return `# Qwen 平台上下文

此工件由工具包资产生成。

- 清单来源：\`${manifestSource}\`
- 匹配到的资产：${assets.length}

${renderAssetList(assets)}
`;
}

function renderExtensionManifest(
  packageName: string,
  manifestSource: string,
  assets: readonly ToolkitAssetLike[],
): string {
  return `${JSON.stringify(
    {
      name: packageName,
      platform: platformName,
      manifestSource,
      contextFile: templateFiles.context,
      assetCount: assets.length,
    },
    null,
    2,
  )}\n`;
}

export function createQwenGenerationPlan(
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
        path: templateFiles.context,
        content: renderContextFile(manifestSource, matchedAssets),
      },
      {
        path: templateFiles.extensionManifest,
        content: renderExtensionManifest(resolvedPackageName, manifestSource, matchedAssets),
      },
    ],
  };
}

export function createQwenInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  return createInstallPlan(createQwenGenerationPlan(manifest, options), options);
}
