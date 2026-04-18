import { loadToolkitContentTree } from "../loaders/asset-unit.js";
import { resolveToolkitContentRoot, resolveToolkitTemplatesRoot } from "../loaders/fs.js";
import { compareToolkitKinds } from "../schema/kinds.js";
import { validateToolkitManifest } from "../schema/manifest.js";
import type { ToolkitAssetUnit, ToolkitManifest, ToolkitKind } from "../types.js";

function compareAssets(left: ToolkitAssetUnit, right: ToolkitAssetUnit): number {
  const kindComparison = compareToolkitKinds(left.meta.kind, right.meta.kind);

  if (kindComparison !== 0) {
    return kindComparison;
  }

  return left.meta.name.localeCompare(right.meta.name);
}

export function createToolkitManifest(
  assets: readonly ToolkitAssetUnit[],
  contentRoot: string
): ToolkitManifest {
  const sortedAssets = [...assets].sort(compareAssets);
  const byId: Record<string, ToolkitAssetUnit> = Object.create(null);
  const counts = {
    skills: 0,
    commands: 0,
    agents: 0,
    total: sortedAssets.length
  };

  for (const asset of sortedAssets) {
    const existingAsset = byId[asset.id];

    if (existingAsset) {
      throw new Error(`Duplicate toolkit asset id: ${asset.id}`);
    }

    byId[asset.id] = asset;

    switch (asset.meta.kind) {
      case "skill":
        counts.skills += 1;
        break;
      case "command":
        counts.commands += 1;
        break;
      case "agent":
        counts.agents += 1;
        break;
    }
  }

  const manifest: ToolkitManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    contentRoot,
    counts,
    assets: sortedAssets,
    byId
  };

  return validateToolkitManifest(manifest);
}

export async function loadToolkitManifest(
  contentRoot: string = resolveToolkitContentRoot()
): Promise<ToolkitManifest> {
  return createToolkitManifest(await loadToolkitContentTree(contentRoot), contentRoot);
}

export function getToolkitAssetById(
  manifest: ToolkitManifest,
  assetId: string
): ToolkitAssetUnit | undefined {
  return manifest.byId[assetId];
}

export function listToolkitAssetsByKind(
  manifest: ToolkitManifest,
  kind: ToolkitKind
): readonly ToolkitAssetUnit[] {
  return manifest.assets.filter((asset) => asset.meta.kind === kind);
}

export function manifestTemplatePath(): string {
  return resolveToolkitTemplatesRoot();
}
