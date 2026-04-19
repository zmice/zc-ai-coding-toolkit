export const toolkitKinds = ["skill", "command", "agent"] as const;
export const toolkitPlatforms = ["qwen", "codex", "qoder"] as const;
export const toolkitAssetTiers = ["core", "recommended", "optional", "experimental"] as const;
export const toolkitAssetAudiences = ["default", "advanced", "maintainer"] as const;
export const toolkitAssetStabilities = ["stable", "evolving", "experimental", "deprecated"] as const;
export const toolkitWorkflowFamilies = ["intake", "lifecycle", "specialized", "support"] as const;
export const toolkitWorkflowRoutes = [
  "product-analysis",
  "full-delivery",
  "bugfix",
  "review-closure",
  "docs-release",
  "investigation"
] as const;
export const toolkitWorkflowRoles = [
  "intake-router",
  "workflow-entry",
  "stage-entry",
  "specialized-entry",
  "guardrail",
  "support"
] as const;
export const toolkitTaskTypes = ["feature", "bugfix", "review", "docs", "release", "investigation"] as const;
export const toolkitPlatformExposureModes = [
  "hidden",
  "listed",
  "primary",
  "prompt-entry",
  "command-style"
] as const;

export type ToolkitKind = (typeof toolkitKinds)[number];
export type ToolkitPlatform = (typeof toolkitPlatforms)[number];
export type ToolkitAssetTier = (typeof toolkitAssetTiers)[number];
export type ToolkitAssetAudience = (typeof toolkitAssetAudiences)[number];
export type ToolkitAssetStability = (typeof toolkitAssetStabilities)[number];
export type ToolkitWorkflowFamily = (typeof toolkitWorkflowFamilies)[number];
export type ToolkitWorkflowRoute = (typeof toolkitWorkflowRoutes)[number];
export type ToolkitWorkflowRole = (typeof toolkitWorkflowRoles)[number];
export type ToolkitTaskType = (typeof toolkitTaskTypes)[number];
export type ToolkitPlatformExposureMode = (typeof toolkitPlatformExposureModes)[number];

export interface ToolkitAssetSource {
  upstream: string;
  strategy: string;
  originName?: string;
  originPath?: string;
  originId?: string;
  notes?: string;
}

export interface ToolkitAssetRelationships {
  requires?: readonly string[];
  suggests?: readonly string[];
  conflictsWith?: readonly string[];
  supersedes?: readonly string[];
}

export interface ToolkitPlatformExposure {
  codex?: ToolkitPlatformExposureMode;
  qwen?: ToolkitPlatformExposureMode;
  qoder?: ToolkitPlatformExposureMode;
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
  workflowFamily?: ToolkitWorkflowFamily;
  workflowRole?: ToolkitWorkflowRole;
  routingWorkflows?: readonly ToolkitWorkflowRoute[];
  taskTypes?: readonly ToolkitTaskType[];
  platformExposure?: ToolkitPlatformExposure;
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

export interface ToolkitRouteHint {
  family: ToolkitWorkflowFamily;
  role: ToolkitWorkflowRole;
  workflows: readonly ToolkitWorkflowRoute[];
  workflowEntries: Readonly<Partial<Record<ToolkitWorkflowRoute, string>>>;
  taskTypes: readonly ToolkitTaskType[];
  next: readonly string[];
  requiresFullLifecycle: boolean;
}

export interface ToolkitRecommendation {
  target: ToolkitAssetUnit;
  required: readonly ToolkitAssetUnit[];
  suggested: readonly ToolkitAssetUnit[];
  route?: ToolkitRouteHint;
  entry?: {
    commandId: string;
    reason: string;
  };
}
