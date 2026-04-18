import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { Command } from "commander";
import { resolveWorkspacePath } from "../utils/workspace.js";

interface UpstreamRecord {
  id: string;
  title?: string;
  kind?: string;
  status?: string;
  owner?: string;
  notesPath?: string;
  snapshotsPath?: string;
  sourcePaths: string[];
  compareAgainst?: string;
  publishTarget?: string;
}

interface SnapshotRecord {
  upstream: string;
  captured_at?: string;
  label?: string;
  metadata?: {
    title?: string;
    kind?: string;
    status?: string;
    owner?: string;
    source_paths?: string[];
  };
  notes?: {
    path?: string;
    content?: string;
  };
}

interface StructuralChange {
  path: string;
  kind: "added" | "removed";
}

interface TextChange {
  path: string;
  summary: string;
}

interface MetadataChange {
  field: string;
  before: string;
  after: string;
}

interface ImpactRecord {
  target: "references" | "toolkit" | "platform";
  effect: string;
  directWrite: false;
}

interface UpstreamDiffResult {
  upstream: string;
  mode: "diff";
  baseline: string;
  changes: {
    structural: StructuralChange[];
    text: TextChange[];
    metadata: MetadataChange[];
  };
  impacts: ImpactRecord[];
  recommendation: string;
  review_status: "pending-manual-review";
  evidence: {
    notes_path: string | null;
    snapshot: string;
  };
}

interface ImportDryRunResult {
  upstream: string;
  mode: "import-dry-run";
  baseline: string;
  planned_actions: string[];
  impacts: ImpactRecord[];
  blocking_conditions: string[];
  recommendation: string;
  review_status: "pending-manual-review";
}

type DiffFormat = "text" | "json";
type ReportFormat = "text" | "json" | "md";
type ImportFormat = "text" | "json";

function getUpstreamsFile(): string {
  return resolveWorkspacePath("references/upstreams.yaml");
}

function resolveReferencePath(pathValue: string): string {
  if (isAbsolute(pathValue)) {
    return pathValue;
  }
  return resolveWorkspacePath(pathValue);
}

function toWorkspaceRelative(pathValue: string): string {
  return relative(resolveWorkspacePath("."), pathValue) || ".";
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    key: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  };
}

function parseUpstreamBlocks(source: string): UpstreamRecord[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const upstreams: UpstreamRecord[] = [];
  let current: UpstreamRecord | null = null;
  let section: "source_paths" | "sync" | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("  - id:")) {
      if (current) {
        upstreams.push(current);
      }
      current = {
        id: line.slice("  - id:".length).trim(),
        sourcePaths: [],
      };
      section = null;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("    source_paths:")) {
      section = "source_paths";
      continue;
    }

    if (line.startsWith("    sync:")) {
      section = "sync";
      continue;
    }

    if (section === "source_paths" && line.startsWith("      - ")) {
      current.sourcePaths.push(line.slice("      - ".length).trim());
      continue;
    }

    if (section === "sync" && line.startsWith("      ")) {
      const parsed = parseKeyValue(line.trim());
      if (!parsed) {
        continue;
      }

      switch (parsed.key) {
        case "compare_against":
          current.compareAgainst = parsed.value;
          break;
        case "publish_target":
          current.publishTarget = parsed.value;
          break;
        default:
          break;
      }
      continue;
    }

    if (!line.startsWith("    ")) {
      section = null;
      continue;
    }

    section = null;
    const parsed = parseKeyValue(line.trim());
    if (!parsed) {
      continue;
    }

    switch (parsed.key) {
      case "title":
        current.title = parsed.value;
        break;
      case "kind":
        current.kind = parsed.value;
        break;
      case "status":
        current.status = parsed.value;
        break;
      case "owner":
        current.owner = parsed.value;
        break;
      case "notes_path":
        current.notesPath = parsed.value;
        break;
      case "snapshots_path":
        current.snapshotsPath = parsed.value;
        break;
      default:
        break;
    }
  }

  if (current) {
    upstreams.push(current);
  }

  return upstreams;
}

async function loadUpstreams(): Promise<UpstreamRecord[]> {
  return parseUpstreamBlocks(await readFile(getUpstreamsFile(), "utf8"));
}

async function collectSnapshotFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSnapshotFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function resolveBaselinePath(item: UpstreamRecord, against?: string): Promise<string> {
  if (!item.snapshotsPath) {
    throw new Error(`上游 ${item.id} 未配置 snapshots_path。`);
  }

  const snapshotsRoot = resolveReferencePath(item.snapshotsPath);
  const files = (await collectSnapshotFiles(snapshotsRoot)).sort();

  if (against) {
    const requested = isAbsolute(against) ? against : resolve(snapshotsRoot, against);
    if (!files.includes(requested)) {
      throw new Error(`未找到指定基线：${against}`);
    }
    return requested;
  }

  const latest = files.at(-1);
  if (!latest) {
    throw new Error(`上游 ${item.id} 没有可用的 snapshot 基线。`);
  }
  return latest;
}

async function loadSnapshot(pathValue: string): Promise<SnapshotRecord> {
  const payload = JSON.parse(await readFile(pathValue, "utf8")) as SnapshotRecord;
  if (!payload.upstream) {
    throw new Error(`snapshot 文件缺少 upstream 字段：${toWorkspaceRelative(pathValue)}`);
  }
  return payload;
}

async function readOptionalFile(pathValue?: string): Promise<string> {
  if (!pathValue) {
    return "";
  }
  return readFile(resolveReferencePath(pathValue), "utf8");
}

function comparePathLists(baseline: readonly string[], current: readonly string[]): StructuralChange[] {
  const removed = baseline
    .filter((pathValue) => !current.includes(pathValue))
    .map((pathValue) => ({ path: pathValue, kind: "removed" as const }));
  const added = current
    .filter((pathValue) => !baseline.includes(pathValue))
    .map((pathValue) => ({ path: pathValue, kind: "added" as const }));
  return [...removed, ...added];
}

function countMeaningfulLines(source: string): number {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function compareNotes(baseline: SnapshotRecord, currentNotesPath: string | undefined, currentContent: string): TextChange[] {
  const baselineContent = baseline.notes?.content ?? "";
  if (baselineContent === currentContent) {
    return [];
  }

  const beforeLines = countMeaningfulLines(baselineContent);
  const afterLines = countMeaningfulLines(currentContent);
  return [
    {
      path: currentNotesPath ?? baseline.notes?.path ?? "-",
      summary: `治理说明正文变化（有效行数 ${beforeLines} -> ${afterLines}）。`,
    },
  ];
}

function compareMetadata(item: UpstreamRecord, baseline: SnapshotRecord): MetadataChange[] {
  const currentMetadata: Record<string, string> = {
    title: item.title ?? "-",
    kind: item.kind ?? "-",
    status: item.status ?? "-",
    owner: item.owner ?? "-",
  };

  const baselineMetadata: Record<string, string> = {
    title: baseline.metadata?.title ?? "-",
    kind: baseline.metadata?.kind ?? "-",
    status: baseline.metadata?.status ?? "-",
    owner: baseline.metadata?.owner ?? "-",
  };

  return Object.keys(currentMetadata)
    .filter((field) => currentMetadata[field] !== baselineMetadata[field])
    .map((field) => ({
      field,
      before: baselineMetadata[field],
      after: currentMetadata[field],
    }));
}

function buildImpacts(result: UpstreamDiffResult["changes"]): ImpactRecord[] {
  const impacts: ImpactRecord[] = [];

  if (result.text.length > 0 || result.metadata.length > 0) {
    impacts.push({
      target: "references",
      effect: "治理记录或审阅结论需要更新，但当前命令不会直接写回。",
      directWrite: false,
    });
  }

  if (result.structural.length > 0 || result.metadata.some((item) => item.field === "status")) {
    impacts.push({
      target: "toolkit",
      effect: "变更可能影响 canonical content 的采纳决策，但不会直接写入 `packages/toolkit`。",
      directWrite: false,
    });
    impacts.push({
      target: "platform",
      effect: "变更可能影响平台产物生成判断，但不会直接写入 `packages/platform-*`。",
      directWrite: false,
    });
  }

  if (impacts.length === 0) {
    impacts.push({
      target: "references",
      effect: "当前未发现需要传播的治理变化。",
      directWrite: false,
    });
  }

  return impacts;
}

async function createDiffResult(item: UpstreamRecord, against?: string): Promise<UpstreamDiffResult> {
  const baselinePath = await resolveBaselinePath(item, against);
  const baseline = await loadSnapshot(baselinePath);
  const currentNotesContent = await readOptionalFile(item.notesPath);

  const changes = {
    structural: comparePathLists(baseline.metadata?.source_paths ?? [], item.sourcePaths),
    text: compareNotes(baseline, item.notesPath, currentNotesContent),
    metadata: compareMetadata(item, baseline),
  };

  return {
    upstream: item.id,
    mode: "diff",
    baseline: toWorkspaceRelative(baselinePath),
    changes,
    impacts: buildImpacts(changes),
    recommendation: "human-review-required",
    review_status: "pending-manual-review",
    evidence: {
      notes_path: item.notesPath ?? null,
      snapshot: toWorkspaceRelative(baselinePath),
    },
  };
}

function formatImpactLines(impacts: readonly ImpactRecord[]): string[] {
  return impacts.map(
    (impact) => `- ${impact.target}: ${impact.effect}（direct_write=${impact.directWrite ? "yes" : "no"}）`,
  );
}

function formatDiffText(result: UpstreamDiffResult): string {
  const structuralLines =
    result.changes.structural.length > 0
      ? result.changes.structural.map((change) => `- ${change.kind}: ${change.path}`)
      : ["- 无"];
  const textLines =
    result.changes.text.length > 0
      ? result.changes.text.map((change) => `- ${change.path}: ${change.summary}`)
      : ["- 无"];
  const metadataLines =
    result.changes.metadata.length > 0
      ? result.changes.metadata.map((change) => `- ${change.field}: ${change.before} -> ${change.after}`)
      : ["- 无"];

  return [
    `上游：${result.upstream}`,
    `模式：${result.mode}`,
    `基线：${result.baseline}`,
    `审阅状态：${result.review_status}`,
    "",
    "结构变化：",
    ...structuralLines,
    "",
    "文本变化：",
    ...textLines,
    "",
    "元数据变化：",
    ...metadataLines,
    "",
    "下游影响：",
    ...formatImpactLines(result.impacts),
    "",
    "风险与阻断条件：",
    "- 不会直接写入 `packages/toolkit`。",
    "- 不会直接写入 `packages/platform-*`。",
    "- 需要人工审阅后再决定是否导入。",
  ].join("\n");
}

function formatReportText(results: readonly UpstreamDiffResult[]): string {
  return results
    .map((result) =>
      [
        `上游：${result.upstream}`,
        "模式：report",
        `决策：${result.review_status}`,
        "",
        "摘要：",
        `- 结构变化：${result.changes.structural.length}`,
        `- 文本变化：${result.changes.text.length}`,
        `- 元数据变化：${result.changes.metadata.length}`,
        "",
        "影响范围：",
        ...formatImpactLines(result.impacts),
        "",
        "下一步：",
        "- 人工审阅仍是最终决策入口。",
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

function formatReportMarkdown(results: readonly UpstreamDiffResult[]): string {
  const sections = results.map((result) =>
    [
      "# Upstream Report",
      "",
      "## Summary",
      `- upstream: \`${result.upstream}\``,
      "- mode: `report`",
      `- decision: \`${result.review_status}\``,
      "",
      "## Evidence",
      `- baseline snapshot: \`${result.evidence.snapshot}\``,
      `- current notes: \`${result.evidence.notes_path ?? "-"}\``,
      "",
      "## Changes",
      `- structural: ${result.changes.structural.length}`,
      `- text: ${result.changes.text.length}`,
      `- metadata: ${result.changes.metadata.length}`,
      "",
      "## Impact",
      ...formatImpactLines(result.impacts),
      "",
      "## Decision",
      "- status: `pending-manual-review`",
      "- next step: 人工审阅后再决定是否导入。",
    ].join("\n"),
  );

  return sections.join("\n\n---\n\n");
}

function createImportDryRunResult(diff: UpstreamDiffResult): ImportDryRunResult {
  return {
    upstream: diff.upstream,
    mode: "import-dry-run",
    baseline: diff.baseline,
    planned_actions: [
      "整理 upstream 变化摘要，生成人工审阅材料。",
      "标记可能影响 `toolkit` 和 `platform` 的候选变化。",
      "等待人工审阅结论后，再进入独立的写入型流程。",
    ],
    impacts: diff.impacts,
    blocking_conditions: [
      "必须先完成人工审阅。",
      "当前阶段不会写入 `packages/toolkit`。",
      "当前阶段不会写入 `packages/platform-*`。",
      "若需要真实导入，必须进入后续显式审批步骤。",
    ],
    recommendation: "manual-review-before-import",
    review_status: "pending-manual-review",
  };
}

function formatImportDryRunText(result: ImportDryRunResult): string {
  return [
    `上游：${result.upstream}`,
    `模式：${result.mode}`,
    `基线：${result.baseline}`,
    `审阅状态：${result.review_status}`,
    "",
    "计划动作：",
    ...result.planned_actions.map((action) => `- ${action}`),
    "",
    "影响范围：",
    ...formatImpactLines(result.impacts),
    "",
    "阻断条件：",
    ...result.blocking_conditions.map((item) => `- ${item}`),
  ].join("\n");
}

function writePayload(format: DiffFormat | ReportFormat | ImportFormat, payload: object, fallbackText: string): void {
  if (format === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(fallbackText);
}

function findUpstreamOrExit(upstreams: readonly UpstreamRecord[], id: string): UpstreamRecord | null {
  const item = upstreams.find((entry) => entry.id === id);

  if (!item) {
    console.error(`未找到上游记录：${id}`);
    process.exitCode = 1;
    return null;
  }

  return item;
}

function printCommandError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[zc upstream] 错误：${message}`);
  process.exitCode = 1;
}

export function registerUpstreamCommand(program: Command): void {
  const upstream = program.command("upstream").description("上游治理命令");

  upstream
    .command("list")
    .description("列出已登记的上游源")
    .action(async () => {
      const upstreams = await loadUpstreams();

      if (upstreams.length === 0) {
        console.log("未登记任何上游源。");
        return;
      }

      console.log(`${"ID".padEnd(28)} ${"状态".padEnd(12)} ${"类型".padEnd(16)} 标题`);
      console.log("-".repeat(88));
      for (const item of upstreams) {
        console.log(
          `${item.id.padEnd(28)} ${(item.status ?? "-").padEnd(12)} ${(item.kind ?? "-").padEnd(16)} ${item.title ?? "-"}`
        );
      }
    });

  upstream
    .command("show")
    .description("查看单个上游源的治理信息")
    .argument("<id>", "上游 ID")
    .action(async (id: string) => {
      const upstreams = await loadUpstreams();
      const item = findUpstreamOrExit(upstreams, id);

      if (!item) {
        return;
      }

      console.log(`ID：${item.id}`);
      console.log(`标题：${item.title ?? "-"}`);
      console.log(`类型：${item.kind ?? "-"}`);
      console.log(`状态：${item.status ?? "-"}`);
      console.log(`负责人：${item.owner ?? "-"}`);
      console.log(`说明：${item.notesPath ? resolve(item.notesPath) : "-"}`);
      console.log(`快照：${item.snapshotsPath ? resolve(item.snapshotsPath) : "-"}`);
    });

  upstream
    .command("review")
    .description("输出手动审阅入口信息")
    .argument("[id]", "上游 ID")
    .action(async (id?: string) => {
      const upstreams = await loadUpstreams();
      const items = id ? upstreams.filter((entry) => entry.id === id) : upstreams;

      if (items.length === 0) {
        console.error(id ? `未找到上游记录：${id}` : "没有可审阅的上游记录。");
        process.exitCode = 1;
        return;
      }

      for (const item of items) {
        console.log(`\n[${item.id}] ${item.title ?? "-"}`);
        console.log(`- 状态：${item.status ?? "-"}`);
        console.log(`- 说明：${item.notesPath ?? "-"}`);
        console.log(`- 快照：${item.snapshotsPath ?? "-"}`);
        console.log("- 模式：manual-review");
      }
    });

  upstream
    .command("diff")
    .description("比较当前上游状态与基线 snapshot 的差异")
    .argument("<id>", "上游 ID")
    .option("--against <baseline>", "指定基线 snapshot，相对 snapshots_path 解析")
    .option("--format <format>", "输出格式：text | json", "text")
    .action(async (id: string, options: { against?: string; format?: DiffFormat }) => {
      try {
        const upstreams = await loadUpstreams();
        const item = findUpstreamOrExit(upstreams, id);

        if (!item) {
          return;
        }

        const result = await createDiffResult(item, options.against);
        writePayload(options.format ?? "text", result, formatDiffText(result));
      } catch (error) {
        printCommandError(error);
      }
    });

  upstream
    .command("report")
    .description("生成 upstream 审阅材料")
    .argument("<target>", "上游 ID 或 all")
    .option("--format <format>", "输出格式：text | json | md", "text")
    .action(async (target: string, options: { format?: ReportFormat }) => {
      try {
        const upstreams = await loadUpstreams();
        const items =
          target === "all"
            ? upstreams
            : upstreams.filter((entry) => entry.id === target);

        if (items.length === 0) {
          console.error(`未找到上游记录：${target}`);
          process.exitCode = 1;
          return;
        }

        const results = await Promise.all(items.map((item) => createDiffResult(item)));
        const format = options.format ?? "text";

        if (format === "md") {
          console.log(formatReportMarkdown(results));
          return;
        }

        writePayload(format, { mode: "report", review_status: "pending-manual-review", results }, formatReportText(results));
      } catch (error) {
        printCommandError(error);
      }
    });

  upstream
    .command("import")
    .description("生成导入提案；当前阶段仅支持 --dry-run")
    .argument("<id>", "上游 ID")
    .option("--dry-run", "只输出提案，不执行写入")
    .option("--format <format>", "输出格式：text | json", "text")
    .action(async (id: string, options: { dryRun?: boolean; format?: ImportFormat }) => {
      if (!options.dryRun) {
        console.error("当前阶段只支持 `import --dry-run`，不会执行任何真实写入。");
        process.exitCode = 1;
        return;
      }

      try {
        const upstreams = await loadUpstreams();
        const item = findUpstreamOrExit(upstreams, id);

        if (!item) {
          return;
        }

        const diff = await createDiffResult(item);
        const result = createImportDryRunResult(diff);
        writePayload(options.format ?? "text", result, formatImportDryRunText(result));
      } catch (error) {
        printCommandError(error);
      }
    });
}
