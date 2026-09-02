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
const maxDiscoveryAliases = 5;
const maxDiscoveryAliasLength = 64;
const maxDiscoveryTags = 8;
const maxDiscoveryTagLength = 32;
const slashCommandTokenPattern = /(?:^|[\s，、,;；])\/[a-z][a-z0-9-]+/gu;
const lifecyclePhaseTokenPattern = /\b(?:Brainstorm|Specify|Plan|Build|Review|Commit)\b/gu;
const markdownSectionHeadingPattern = /^##\s+\S/mu;
const skillActivationHeadingPattern =
  /^##\s+(?:Overview|何时使用|When to Use|使用条件|角色定位|Skill Discovery)(?:\s|$)/mu;
const assetReferenceTokenPattern =
  /^(?:(?:skill|command|agent):)?[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const kindPrefixedAssetReferencePattern =
  /^(?:skill|command|agent):[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const inlineCodeSpanPattern = /`([^`\n]+)`/gu;
const localSupportFileReferencePattern =
  /`((?:references|assets|templates|examples|scripts)\/[^`\n]+)`/gu;
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
  "platform-default",
  "project-local",
  "refactor",
  "readonly-consult",
  "serial-subagent",
  "test",
  "text-primary",
  "update-available",
  "worktree-team"
]);
const agentLoopBoundaryAssetIds = new Set<string>([
  "command:start",
  "skill:planning-and-task-breakdown",
  "skill:sdd-tdd-workflow",
  "skill:parallel-agent-dispatch",
  "skill:subagent-driven-development",
  "skill:team-orchestration"
]);
const agentDispatchSignalPattern =
  /(?:agent_opportunity|dispatch_now|fan-out|Context Fan-Out|zc team|worker|子代理|多 agent|multi-agent|subagent)/iu;
const agentLoopBoundaryPattern =
  /(?:loop_budget|Loop budget|Bounded Loop|Bounded Team Loop|stop gate|停线|最多\s*\d+\s*轮|fan-in gate)/iu;

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

function countPatternMatches(text: string, pattern: RegExp): number {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)].length;
}

function stripFencedCodeBlocks(text: string): string {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gmu, "");
}

function checkDescriptionDiscoveryScope(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  const commandMentions = countPatternMatches(meta.description, slashCommandTokenPattern);
  const lifecycleMentions = countPatternMatches(meta.description, lifecyclePhaseTokenPattern);

  if (commandMentions < 3 && lifecycleMentions < 4) {
    return [];
  }

  return [
    {
      level: "warning",
      assetId,
      rule: "description-workflow-summary",
      message: "description 应只负责发现和触发条件，不应承载命令清单或完整生命周期摘要；请把流程细节移到 body.md 或 assets/。"
    }
  ];
}

function normalizeDiscoveryToken(value: string): string {
  return value.trim().toLowerCase();
}

function checkDiscoveryMetadata(assetId: string, meta: ToolkitAssetMeta): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];
  const aliases = meta.aliases ?? [];
  const tags = meta.tags ?? [];

  if (aliases.length > maxDiscoveryAliases) {
    issues.push({
      level: "error",
      assetId,
      rule: "too-many-discovery-aliases",
      message: `aliases 数量为 ${aliases.length}，超过 ${maxDiscoveryAliases}；只保留稳定且可唯一解析的替代名称。`
    });
  }

  const seenAliases = new Set<string>();
  for (const alias of aliases) {
    const normalized = normalizeDiscoveryToken(alias);
    if (!normalized) {
      issues.push({
        level: "error",
        assetId,
        rule: "empty-discovery-alias",
        message: "aliases 不能包含空白项。"
      });
      continue;
    }
    if (alias.length > maxDiscoveryAliasLength) {
      issues.push({
        level: "error",
        assetId,
        rule: "discovery-alias-too-long",
        message: `alias 长度为 ${alias.length}，超过 ${maxDiscoveryAliasLength} 字符。`
      });
    }
    if (seenAliases.has(normalized)) {
      issues.push({
        level: "error",
        assetId,
        rule: "duplicate-discovery-alias",
        message: `aliases 包含规范化后重复的值：${alias}`
      });
    }
    seenAliases.add(normalized);
  }

  if (tags.length > maxDiscoveryTags) {
    issues.push({
      level: "error",
      assetId,
      rule: "too-many-discovery-tags",
      message: `tags 数量为 ${tags.length}，超过 ${maxDiscoveryTags}；避免用关键词堆叠模拟自然语言排名。`
    });
  }

  const seenTags = new Set<string>();
  for (const tag of tags) {
    const normalized = normalizeDiscoveryToken(tag);
    if (!normalized) {
      issues.push({
        level: "error",
        assetId,
        rule: "empty-discovery-tag",
        message: "tags 不能包含空白项。"
      });
      continue;
    }
    if (tag.length > maxDiscoveryTagLength) {
      issues.push({
        level: "error",
        assetId,
        rule: "discovery-tag-too-long",
        message: `tag 长度为 ${tag.length}，超过 ${maxDiscoveryTagLength} 字符；请使用短搜索词。`
      });
    }
    if (seenTags.has(normalized)) {
      issues.push({
        level: "error",
        assetId,
        rule: "duplicate-discovery-tag",
        message: `tags 包含规范化后重复的值：${tag}`
      });
    }
    seenTags.add(normalized);
  }

  return issues;
}

function checkBodyStructure(asset: ToolkitAssetUnit): ToolkitLintIssue[] {
  const issues: ToolkitLintIssue[] = [];
  const rawBody = asset.body.trim();

  if (!rawBody) {
    issues.push({
      level: "error",
      assetId: asset.id,
      rule: "empty-body",
      message: "body.md 为空，平台产物无法提供可执行流程。"
    });
    return issues;
  }

  const body = stripFencedCodeBlocks(rawBody);

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

function checkAgentLoopBoundary(asset: ToolkitAssetUnit): ToolkitLintIssue[] {
  if (!agentLoopBoundaryAssetIds.has(asset.id)) {
    return [];
  }

  const body = stripFencedCodeBlocks(asset.body);

  if (!agentDispatchSignalPattern.test(body)) {
    return [];
  }

  if (agentLoopBoundaryPattern.test(body)) {
    return [];
  }

  return [
    {
      level: "warning",
      assetId: asset.id,
      rule: "missing-agent-loop-boundary",
      message: "多 agent 调度内容必须声明 loop budget、stop gate 或 fan-in gate，避免无边界重试。"
    }
  ];
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

function checkDuplicateDiscoveryIdentities(manifest: ToolkitManifest): ToolkitLintIssue[] {
  const ownersByToken = new Map<string, Set<string>>();

  for (const asset of manifest.assets) {
    const identities = [asset.id, asset.meta.name, asset.meta.title, ...(asset.meta.aliases ?? [])];
    for (const identity of identities) {
      const normalized = normalizeDiscoveryToken(identity);
      if (!normalized) {
        continue;
      }
      const owners = ownersByToken.get(normalized) ?? new Set<string>();
      owners.add(asset.id);
      ownersByToken.set(normalized, owners);
    }
  }

  const issues: ToolkitLintIssue[] = [];
  for (const asset of manifest.assets) {
    for (const alias of asset.meta.aliases ?? []) {
      const owners = ownersByToken.get(normalizeDiscoveryToken(alias));
      const conflictingOwners = [...(owners ?? [])].filter((owner) => owner !== asset.id);
      if (conflictingOwners.length === 0) {
        continue;
      }
      issues.push({
        level: "error",
        assetId: asset.id,
        rule: "duplicate-discovery-identity",
        message: `alias 无法唯一解析：${alias}；同时属于 ${conflictingOwners.join(", ")}`
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
      `${asset.meta.description}\n${stripFencedCodeBlocks(asset.body)}`,
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

function normalizeLocalSupportFileReference(reference: string): string {
  return reference.split("#", 1)[0]!.replace(/^\.\//u, "");
}

function normalizeAttachmentOutputPath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  return normalized.startsWith("assets/")
    ? normalized.slice("assets/".length)
    : normalized;
}

function checkLocalSupportFileReferences(asset: ToolkitAssetUnit): ToolkitLintIssue[] {
  const availablePaths = new Set(
    asset.attachments.map((attachment) => normalizeAttachmentOutputPath(attachment.relativePath))
  );
  const referencedPaths = new Set<string>();

  for (const match of stripFencedCodeBlocks(asset.body).matchAll(localSupportFileReferencePattern)) {
    const reference = match[1];
    if (reference) {
      referencedPaths.add(normalizeLocalSupportFileReference(reference));
    }
  }

  return [...referencedPaths]
    .filter((reference) => !availablePaths.has(reference))
    .map((reference) => ({
      level: "error" as const,
      assetId: asset.id,
      rule: "missing-local-support-file",
      message: `引用的本地支持文件不存在或未纳入附件：${reference}`
    }));
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
    ...checkDescriptionDiscoveryScope(asset.id, asset.meta),
    ...checkDiscoveryMetadata(asset.id, asset.meta),
    ...checkLocalizedSummary(asset.id, asset.meta),
    ...checkUpstreamRegistryConsistency(asset.id, asset.meta, options.knownUpstreams),
    ...checkSourceTraceability(asset.id, asset.meta),
    ...checkBodyStructure(asset),
    ...checkAgentLoopBoundary(asset),
    ...checkLocalSupportFileReferences(asset)
  ]).concat(
    checkDuplicateSummaries(manifest),
    checkDuplicateDiscoveryIdentities(manifest),
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
