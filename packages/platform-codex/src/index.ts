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

export const platformName = "codex" as const;
export const packageName = "@zmice/platform-codex" as const;

export const templateFiles = {
  agents: "AGENTS.md",
} as const;

function describeAsset(asset: ToolkitAssetLike): string {
  return asset.title ?? asset.summary ?? asset.id;
}

function selectMatchedAssets(manifest: ToolkitManifestLike): readonly ToolkitAssetLike[] {
  return manifest.assets.filter((asset) => asset.platforms.includes(platformName));
}

function renderAssetList(assets: readonly ToolkitAssetLike[]): string {
  if (assets.length === 0) {
    return "- No toolkit assets matched yet.";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function renderAgentsFile(manifestSource: string, assets: readonly ToolkitAssetLike[]): string {
  return `# Codex Platform Instructions

This artifact is generated from toolkit assets.

- Manifest source: \`${manifestSource}\`
- Matched assets: ${assets.length}

${renderAssetList(assets)}
`;
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

export function createCodexGenerationPlan(
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
        path: templateFiles.agents,
        content: renderAgentsFile(manifestSource, matchedAssets),
      },
    ],
  };
}

export function createCodexInstallPlan(
  manifest: ToolkitManifestLike,
  options: InstallOptions,
): InstallPlan {
  const generationPlan = createCodexGenerationPlan(manifest, options);

  return {
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  };
}
