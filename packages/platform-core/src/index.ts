import { join } from "node:path";

export type PlatformName = "qwen" | "codex" | "qoder";
export type ToolkitAssetKind = "skill" | "command" | "agent";
export type OverwriteMode = "error" | "force";

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

export interface GenerationPlan {
  readonly platform: PlatformName;
  readonly packageName: string;
  readonly manifestSource: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly artifacts: readonly PlatformArtifact[];
}

export interface InstallPlan extends GenerationPlan {
  readonly destinationRoot: string;
  readonly overwrite: OverwriteMode;
}

export interface InstallPlanOptions {
  readonly destinationRoot: string;
  readonly overwrite?: OverwriteMode;
}

export function describeAsset(asset: ToolkitAssetLike): string {
  return asset.title ?? asset.summary ?? asset.id;
}

export function selectMatchedAssets(
  manifest: ToolkitManifestLike,
  platform: PlatformName,
): readonly ToolkitAssetLike[] {
  return manifest.assets.filter((asset) => asset.platforms.includes(platform));
}

export function prefixArtifacts(
  destinationRoot: string,
  artifacts: readonly PlatformArtifact[],
): readonly PlatformArtifact[] {
  return artifacts.map((artifact) => ({
    path: join(destinationRoot, artifact.path),
    content: artifact.content,
  }));
}

export function createInstallPlan(
  generationPlan: GenerationPlan,
  options: InstallPlanOptions,
): InstallPlan {
  return {
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    overwrite: options.overwrite ?? "error",
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  };
}
