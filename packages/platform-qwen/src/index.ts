import { join } from "node:path";

export type ToolkitAssetKind = "skill" | "command" | "agent";

export interface ToolkitAssetLike {
  readonly id: string;
  readonly kind: ToolkitAssetKind;
  readonly platforms: readonly string[];
  readonly title?: string;
  readonly summary?: string;
  readonly body?: string;
}

export interface ToolkitManifestLike {
  readonly source?: string;
  readonly assets: readonly ToolkitAssetLike[];
}

export interface PlatformArtifact {
  readonly path: string;
  readonly content: string;
}

export interface GenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
}

export interface InstallOptions extends GenerationOptions {
  readonly destinationRoot: string;
}

export interface GenerationPlan {
  readonly platform: typeof platformName;
  readonly packageName: string;
  readonly manifestSource: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly artifacts: readonly PlatformArtifact[];
}

export interface InstallPlan extends GenerationPlan {
  readonly destinationRoot: string;
}

export const platformName = "qwen" as const;
export const packageName = "@zmice/platform-qwen" as const;

export const templateFiles = {
  context: "QWEN.md",
  extensionManifest: "qwen-extension.json",
} as const;

function describeAsset(asset: ToolkitAssetLike): string {
  return asset.title ?? asset.summary ?? asset.id;
}

function selectMatchedAssets(manifest: ToolkitManifestLike): readonly ToolkitAssetLike[] {
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

function prefixArtifacts(
  destinationRoot: string,
  artifacts: readonly PlatformArtifact[],
): readonly PlatformArtifact[] {
  return artifacts.map((artifact) => ({
    path: join(destinationRoot, artifact.path),
    content: artifact.content,
  }));
}

export function createQwenGenerationPlan(
  manifest: ToolkitManifestLike,
  options: GenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest);
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
  const generationPlan = createQwenGenerationPlan(manifest, options);

  return {
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  };
}
