export const toolkitKinds = ["skill", "command", "agent"] as const;
export const toolkitPlatforms = ["qwen", "codex", "qoder"] as const;

export type ToolkitKind = (typeof toolkitKinds)[number];
export type ToolkitPlatform = (typeof toolkitPlatforms)[number];

export interface ToolkitAssetMeta {
  kind: ToolkitKind;
  name: string;
  title: string;
  description: string;
  tags?: readonly string[];
  tools?: readonly string[];
  platforms?: readonly ToolkitPlatform[];
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
}
