export const toolkitKinds = ["skill", "command", "agent"] as const;
export const toolkitPlatforms = ["qwen", "codex", "qoder"] as const;
export const toolkitAssetTiers = ["core", "recommended", "optional", "experimental"] as const;
export const toolkitAssetAudiences = ["default", "advanced", "maintainer"] as const;
export const toolkitAssetStabilities = ["stable", "evolving", "experimental", "deprecated"] as const;

export type ToolkitKind = (typeof toolkitKinds)[number];
export type ToolkitPlatform = (typeof toolkitPlatforms)[number];
export type ToolkitAssetTier = (typeof toolkitAssetTiers)[number];
export type ToolkitAssetAudience = (typeof toolkitAssetAudiences)[number];
export type ToolkitAssetStability = (typeof toolkitAssetStabilities)[number];

export interface ToolkitAssetSource {
  upstream: string;
  strategy: string;
  notes?: string;
}

export interface ToolkitAssetRelationships {
  requires?: readonly string[];
  suggests?: readonly string[];
  conflictsWith?: readonly string[];
  supersedes?: readonly string[];
}

export interface ToolkitAssetMeta {
  kind: ToolkitKind;
  name: string;
  title: string;
  description: string;
  tier?: ToolkitAssetTier;
  audience?: ToolkitAssetAudience;
  stability?: ToolkitAssetStability;
  tags?: readonly string[];
  tools?: readonly string[];
  platforms?: readonly ToolkitPlatform[];
  aliases?: readonly string[];
  requires?: readonly string[];
  suggests?: readonly string[];
  conflictsWith?: readonly string[];
  supersedes?: readonly string[];
  source?: ToolkitAssetSource;
}

export interface ToolkitAssetAttachment {
  relativePath: string;
  contents: string;
}

export interface ToolkitAssetSourcePaths {
  directory: string;
  meta: string;
  body: string;
  assets: string;
}

export interface ToolkitAssetUnit {
  id: string;
  meta: ToolkitAssetMeta;
  body: string;
  attachments: readonly ToolkitAssetAttachment[];
  source: ToolkitAssetSourcePaths;
}

export interface ToolkitManifestCounts {
  skills: number;
  commands: number;
  agents: number;
  total: number;
}

export interface ToolkitManifest {
  version: 1;
  generatedAt: string;
  contentRoot: string;
  counts: ToolkitManifestCounts;
  assets: readonly ToolkitAssetUnit[];
  byId: Readonly<Record<string, ToolkitAssetUnit>>;
  byRelationship: {
    requires: Readonly<Record<string, readonly string[]>>;
    suggests: Readonly<Record<string, readonly string[]>>;
    conflictsWith: Readonly<Record<string, readonly string[]>>;
    supersedes: Readonly<Record<string, readonly string[]>>;
  };
}
