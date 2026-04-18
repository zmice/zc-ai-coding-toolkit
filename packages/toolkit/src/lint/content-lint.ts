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

const chineseCharacterPattern = /[\u3400-\u9fff]/u;
const longEnglishFragmentPattern = /\b[A-Za-z]+(?:\s+[A-Za-z]+){3,}\b/u;

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

function checkLocalizedSummary(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];
  const needsChineseSummary = meta.tier === "core" || meta.tier === "recommended";

  if (!needsChineseSummary) {
    return issues;
  }

  if (!chineseCharacterPattern.test(meta.description)) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-chinese-summary",
      message: "核心或推荐资产的 description 应优先提供中文摘要，便于面向用户稳定输出。"
    });
    return issues;
  }

  if (longEnglishFragmentPattern.test(meta.description)) {
    issues.push({
      level: "warning",
      assetId,
      rule: "mixed-language-summary",
      message: "description 中包含较长英文片段，建议改成中文优先、英文术语点到为止。"
    });
  }

  return issues;
}

function normalizeSummary(summary: string): string {
  return summary
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[。！？!?,，；;:：]+$/gu, "")
    .trim()
    .toLowerCase();
}

function checkDuplicateSummaries(manifest: ToolkitManifest): ToolkitLintIssue[] {
  const summaryMap = new Map<string, string[]>();

  for (const asset of manifest.assets) {
    const normalized = normalizeSummary(asset.meta.description);
    if (!normalized) {
      continue;
    }

    summaryMap.set(normalized, [...(summaryMap.get(normalized) ?? []), asset.id]);
  }

  const issues: ToolkitLintIssue[] = [];

  for (const assetIds of summaryMap.values()) {
    if (assetIds.length < 2) {
      continue;
    }

    const related = assetIds.join(", ");
    for (const assetId of assetIds) {
      issues.push({
        level: "warning",
        assetId,
        rule: "duplicate-summary",
        message: `与其他资产共享相同摘要，建议归并或明确区分定位：${related}`
      });
    }
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

function checkRelationshipCycles(
  manifest: ToolkitManifest,
  relationName: "requires" | "suggests"
): ToolkitLintIssue[] {
  const knownIds = new Set(manifest.assets.map((asset) => asset.id));
  const graph = new Map<string, readonly string[]>(
    manifest.assets.map((asset) => [
      asset.id,
      (relationName === "requires" ? asset.meta.requires : asset.meta.suggests)?.filter(
        (target) => knownIds.has(target)
      ) ?? []
    ])
  );
  const visited = new Set<string>();
  const stack: string[] = [];
  const issues: ToolkitLintIssue[] = [];
  const emitted = new Set<string>();

  function visit(node: string): void {
    visited.add(node);
    stack.push(node);

    for (const target of graph.get(node) ?? []) {
      const cycleStartIndex = stack.indexOf(target);

      if (cycleStartIndex >= 0) {
        const cycleMembers = stack.slice(cycleStartIndex);
        const cyclePath = [...cycleMembers, target].join(" -> ");
        const cycleKey = `${relationName}:${[...cycleMembers].sort().join("|")}`;

        if (!emitted.has(cycleKey)) {
          emitted.add(cycleKey);
          for (const assetId of cycleMembers) {
            issues.push({
              level: "warning",
              assetId,
              rule: "relationship-cycle",
              message: `${relationName} 存在循环依赖：${cyclePath}`
            });
          }
        }

        continue;
      }

      if (!visited.has(target)) {
        visit(target);
      }
    }

    stack.pop();
  }

  for (const asset of manifest.assets) {
    if (!visited.has(asset.id)) {
      visit(asset.id);
    }
  }

  return issues;
}

export function lintToolkitManifest(manifest: ToolkitManifest): ToolkitLintResult {
  const issues = manifest.assets.flatMap((asset) => [
    ...checkMissingGovernanceFields(asset.id, asset.meta),
    ...checkGovernanceConsistency(asset.id, asset.meta),
    ...checkLocalizedSummary(asset.id, asset.meta)
  ]).concat(
    checkDuplicateSummaries(manifest),
    checkRelationshipTargets(manifest),
    checkRelationshipCycles(manifest, "requires"),
    checkRelationshipCycles(manifest, "suggests")
  );

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
