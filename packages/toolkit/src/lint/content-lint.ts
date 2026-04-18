import type { ToolkitAssetMeta, ToolkitManifest } from "../types.js";

export type ToolkitLintLevel = "warning" | "error";

export interface ToolkitLintIssue {
  level: ToolkitLintLevel;
  assetId: string;
  rule: string;
  message: string;
}

export interface ToolkitLintResult {
  summary: {
    assets: number;
    warnings: number;
    errors: number;
  };
  issues: readonly ToolkitLintIssue[];
}

function checkMissingGovernanceFields(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];

  if (!meta.tier) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-tier",
      message: "缺少 tier，无法判断该资产是否属于 core/recommended/optional。"
    });
  }

  if (!meta.audience) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-audience",
      message: "缺少 audience，无法判断默认面向的使用者层级。"
    });
  }

  if (!meta.stability) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-stability",
      message: "缺少 stability，无法判断该资产的成熟度。"
    });
  }

  if (!meta.source) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-source",
      message: "缺少 source，无法追溯该资产的上游来源或吸收策略。"
    });
  }

  return issues;
}

function checkGovernanceConsistency(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];

  if (meta.tier === "core" && meta.stability && meta.stability !== "stable") {
    issues.push({
      level: "warning",
      assetId,
      rule: "core-not-stable",
      message: "core 资产通常应保持 stable，当前治理属性不一致。"
    });
  }

  return issues;
}

function checkRelationshipTargets(manifest: ToolkitManifest): ToolkitLintIssue[] {
  const knownIds = new Set(manifest.assets.map((asset) => asset.id));
  const issues: ToolkitLintIssue[] = [];

  for (const asset of manifest.assets) {
    const relationships: Array<[string, readonly string[] | undefined]> = [
      ["requires", asset.meta.requires],
      ["suggests", asset.meta.suggests],
      ["conflicts_with", asset.meta.conflictsWith],
      ["supersedes", asset.meta.supersedes]
    ];

    for (const [field, targets] of relationships) {
      for (const target of targets ?? []) {
        if (knownIds.has(target)) {
          continue;
        }

        issues.push({
          level: "warning",
          assetId: asset.id,
          rule: "unknown-relationship-target",
          message: `${field} 指向了不存在的资产：${target}`
        });
      }
    }
  }

  return issues;
}

export function lintToolkitManifest(manifest: ToolkitManifest): ToolkitLintResult {
  const issues = manifest.assets.flatMap((asset) => [
    ...checkMissingGovernanceFields(asset.id, asset.meta),
    ...checkGovernanceConsistency(asset.id, asset.meta)
  ]).concat(checkRelationshipTargets(manifest));

  const warnings = issues.filter((issue) => issue.level === "warning").length;
  const errors = issues.filter((issue) => issue.level === "error").length;

  return {
    summary: {
      assets: manifest.assets.length,
      warnings,
      errors
    },
    issues
  };
}
