import {
  toolkitPlatformExposureModes,
  toolkitWorkflowRoles,
  toolkitWorkflowRoutes
} from "../types.js";
import type { ToolkitAssetMeta, ToolkitAssetUnit, ToolkitManifest } from "../types.js";

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

export interface ToolkitLintOptions {
  knownUpstreams?: readonly string[];
}

const chineseCharacterPattern = /[\u3400-\u9fff]/u;
const longEnglishFragmentPattern = /\b[A-Za-z]+(?:\s+[A-Za-z]+){3,}\b/u;
const maxDescriptionLength = 1024;
const markdownSectionHeadingPattern = /^##\s+\S/mu;
const skillActivationHeadingPattern =
  /^##\s+(?:Overview|何时使用|When to Use|使用条件|角色定位|Skill Discovery)(?:\s|$)/mu;
const assetReferenceTokenPattern =
  /^(?:(?:skill|command|agent):)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const kindPrefixedAssetReferencePattern =
  /^(?:skill|command|agent):[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const inlineCodeSpanPattern = /`([^`\n]+)`/gu;
const contextualAssetReferencePattern =
  /`((?:(?:skill|command|agent):)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*)`\s+(?:skill|command|agent|技能|命令|代理)|(?:skill|command|agent|技能|命令|代理)\s+`((?:(?:skill|command|agent):)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*)`/gu;
const routeArrowReferencePattern =
  /→\s*((?:(?:skill|command|agent):)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*)(?=$|[^a-zA-Z0-9_-])/gu;
const nonAssetReferenceAllowlist = new Set<string>([
  ...toolkitWorkflowRoutes,
  ...toolkitWorkflowRoles,
  ...toolkitPlatformExposureModes,
  "bg-surface",
  "border-default",
  "chore",
  "context-fanout",
  "doc-verified",
  "docs",
  "feat",
  "feature",
  "fix",
  "high-risk",
  "localize",
  "needs-follow-up",
  "official-global",
  "project-local",
  "refactor",
  "readonly-consult",
  "serial-subagent",
  "test",
  "text-primary",
  "update-available",
  "zc-team"
]);

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

function checkDescriptionLength(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  if (meta.description.length <= maxDescriptionLength) {
    return [];
  }

  return [
    {
      level: "error",
      assetId,
      rule: "description-too-long",
      message: `description 长度为 ${meta.description.length}，超过 ${maxDescriptionLength} 字符；平台通常会把 description 注入发现上下文，应保持短而准。`
    }
  ];
}

function checkBodyStructure(asset: ToolkitAssetUnit): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];
  const body = asset.body.trim();

  if (!body) {
    issues.push({
      level: "error",
      assetId: asset.id,
      rule: "empty-body",
      message: "body.md 为空，平台产物无法提供可执行流程。"
    });
    return issues;
  }

  if (asset.meta.kind === "skill" && !markdownSectionHeadingPattern.test(body)) {
    issues.push({
      level: "warning",
      assetId: asset.id,
      rule: "missing-body-sections",
      message: "skill body.md 缺少二级标题，难以按渐进式披露加载。"
    });
  }

  if (asset.meta.kind === "skill" && !skillActivationHeadingPattern.test(body)) {
    issues.push({
      level: "warning",
      assetId: asset.id,
      rule: "missing-activation-section",
      message: "skill body.md 应说明何时使用或角色定位，避免自动路由只能依赖标题。"
    });
  }

  return issues;
}

function checkUpstreamRegistryConsistency(
  assetId: string,
  meta: ToolkitAssetMeta,
  knownUpstreams: readonly string[] | undefined
): ToolkitLintIssue[] {
  if (!meta.source || !knownUpstreams) {
    return [];
  }

  if (knownUpstreams.includes(meta.source.upstream)) {
    return [];
  }

  return [
    {
      level: "warning",
      assetId,
      rule: "unknown-source-upstream",
      message: `source.upstream 未在 references/upstreams.yaml 中登记：${meta.source.upstream}`
    }
  ];
}

function checkSourceTraceability(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  if (!meta.source || meta.source.upstream === "toolkit-original") {
    return [];
  }

  const issues: ToolkitLintIssue[] = [];
  const hasAnyOriginField = Boolean(
    meta.source.originName || meta.source.originPath || meta.source.originId
  );
  const hasFullOriginMapping = Boolean(
    meta.source.originName && meta.source.originPath && meta.source.originId
  );

  if (hasAnyOriginField && !hasFullOriginMapping) {
    issues.push({
      level: "warning",
      assetId,
      rule: "partial-origin-mapping",
      message: "source.origin_* 映射已开始填写时，应同时提供 origin_name / origin_path / origin_id。"
    });
  }

  if (meta.source.strategy === "adapted" && !hasFullOriginMapping) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-origin-mapping",
      message: "外部 upstream 的 adapted 资产应提供完整 source.origin_*，以便后续 diff 和人工同步。"
    });
  }

  if (meta.source.strategy === "inspired" && !meta.source.notes) {
    issues.push({
      level: "warning",
      assetId,
      rule: "missing-source-notes",
      message: "外部 upstream 的 inspired 资产应保留 source.notes，说明吸收边界和改写方式。"
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

function stripAssetKindPrefix(assetId: string): string {
  const separatorIndex = assetId.indexOf(":");
  return separatorIndex >= 0 ? assetId.slice(separatorIndex + 1) : assetId;
}

function isReferenceToken(text: string): boolean {
  return assetReferenceTokenPattern.test(text);
}

function shouldCollectAssetReference(ref: string, knownReferences: ReadonlySet<string>): boolean {
  if (!isReferenceToken(ref)) {
    return false;
  }

  if (knownReferences.has(ref) || kindPrefixedAssetReferencePattern.test(ref)) {
    return true;
  }

  return ref.includes("-");
}

function collectInlineCodeReferences(
  text: string,
  knownReferences: ReadonlySet<string>
): readonly string[] {
  const refs = new Set<string>();

  inlineCodeSpanPattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineCodeSpanPattern.exec(text)) !== null) {
    const ref = match[1]?.trim();
    if (ref && shouldCollectAssetReference(ref, knownReferences)) {
      refs.add(ref);
    }
  }

  return [...refs];
}

function collectContextualReferences(text: string): readonly string[] {
  const refs = new Set<string>();

  contextualAssetReferencePattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = contextualAssetReferencePattern.exec(text)) !== null) {
    const ref = match[1] ?? match[2];
    if (ref) {
      refs.add(ref);
    }
  }

  return [...refs];
}

function collectRouteArrowReferences(text: string): readonly string[] {
  const refs = new Set<string>();

  routeArrowReferencePattern.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = routeArrowReferencePattern.exec(text)) !== null) {
    refs.add(match[1]);
  }

  return [...refs];
}

function collectTableCellReferences(
  text: string,
  knownReferences: ReadonlySet<string>
): readonly string[] {
  const refs = new Set<string>();

  for (const line of text.split("\n")) {
    if (!line.includes("|")) {
      continue;
    }

    for (const rawCell of line.split("|")) {
      const cell = rawCell.trim();
      if (shouldCollectAssetReference(cell, knownReferences)) {
        refs.add(cell);
      }
    }
  }

  return [...refs];
}

function collectExplicitAssetReferences(
  text: string,
  knownReferences: ReadonlySet<string>
): readonly string[] {
  return [
    ...new Set([
      ...collectInlineCodeReferences(text, knownReferences),
      ...collectContextualReferences(text),
      ...collectRouteArrowReferences(text),
      ...collectTableCellReferences(text, knownReferences)
    ])
  ];
}

function checkExplicitAssetReferences(manifest: ToolkitManifest): ToolkitLintIssue[] {
  const knownReferences = new Set<string>();
  const issues: ToolkitLintIssue[] = [];

  for (const asset of manifest.assets) {
    knownReferences.add(asset.id);
    knownReferences.add(stripAssetKindPrefix(asset.id));
    knownReferences.add(asset.meta.name);
    for (const alias of asset.meta.aliases ?? []) {
      knownReferences.add(alias);
    }
  }

  for (const asset of manifest.assets) {
    const refs = collectExplicitAssetReferences(
      `${asset.meta.description}\n${asset.body}`,
      knownReferences
    );

    for (const ref of refs) {
      if (knownReferences.has(ref) || nonAssetReferenceAllowlist.has(ref)) {
        continue;
      }

      issues.push({
        level: "warning",
        assetId: asset.id,
        rule: "unknown-explicit-asset-reference",
        message: `显式引用了不存在的 toolkit 资产：${ref}`
      });
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

export function lintToolkitManifest(
  manifest: ToolkitManifest,
  options: ToolkitLintOptions = {}
): ToolkitLintResult {
  const issues = manifest.assets.flatMap((asset) => [
    ...checkMissingGovernanceFields(asset.id, asset.meta),
    ...checkGovernanceConsistency(asset.id, asset.meta),
    ...checkDescriptionLength(asset.id, asset.meta),
    ...checkLocalizedSummary(asset.id, asset.meta),
    ...checkUpstreamRegistryConsistency(asset.id, asset.meta, options.knownUpstreams),
    ...checkSourceTraceability(asset.id, asset.meta),
    ...checkBodyStructure(asset)
  ]).concat(
    checkDuplicateSummaries(manifest),
    checkExplicitAssetReferences(manifest),
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
