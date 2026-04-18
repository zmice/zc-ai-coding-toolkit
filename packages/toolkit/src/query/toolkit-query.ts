import type { ToolkitAssetUnit, ToolkitManifest } from "../types.js";

export interface ToolkitRecommendation {
  target: ToolkitAssetUnit;
  required: readonly ToolkitAssetUnit[];
  suggested: readonly ToolkitAssetUnit[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function assetSearchText(asset: ToolkitAssetUnit): string {
  return [
    asset.id,
    asset.meta.name,
    asset.meta.title,
    asset.meta.description,
    ...(asset.meta.tags ?? []),
    ...(asset.meta.aliases ?? [])
  ]
    .join("\n")
    .toLowerCase();
}

export function resolveToolkitAssetQuery(
  manifest: ToolkitManifest,
  query: string
): ToolkitAssetUnit | undefined {
  const normalizedQuery = normalize(query);
  const exactId = manifest.byId[normalizedQuery];

  if (exactId) {
    return exactId;
  }

  const matches = manifest.assets.filter((asset) => {
    const candidates = [asset.meta.name, asset.meta.title, ...(asset.meta.aliases ?? [])];
    return candidates.some((candidate) => normalize(candidate) === normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : undefined;
}

export function searchToolkitAssets(
  manifest: ToolkitManifest,
  keyword: string
): readonly ToolkitAssetUnit[] {
  const normalizedKeyword = normalize(keyword);

  return manifest.assets.filter((asset) => assetSearchText(asset).includes(normalizedKeyword));
}

export function recommendToolkitAssets(
  manifest: ToolkitManifest,
  query: string
): ToolkitRecommendation | undefined {
  const target = resolveToolkitAssetQuery(manifest, query);

  if (!target) {
    return undefined;
  }

  const required = (target.meta.requires ?? [])
    .map((assetId) => manifest.byId[assetId])
    .filter(Boolean);
  const suggested = (target.meta.suggests ?? [])
    .map((assetId) => manifest.byId[assetId])
    .filter(Boolean);

  return {
    target,
    required,
    suggested
  };
}
