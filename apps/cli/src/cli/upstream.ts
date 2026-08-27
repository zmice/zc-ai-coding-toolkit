import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { Command } from "commander";
import { Command as CommanderCommand } from "commander";
import { resolveWorkspacePath } from "../utils/workspace.js";

function execFileAsync(
  file: string,
  args: readonly string[],
  options: { timeout?: number; maxBuffer?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(file, [...args], options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise({
        stdout: String(stdout),
        stderr: String(stderr),
      });
    });
  });
}

type TemporaryDirectoryRemover = (
  pathValue: string,
  options: { recursive: true; force: true; maxRetries: number; retryDelay: number },
) => Promise<void>;

export async function removeTemporaryDirectory(
  pathValue: string,
  removeDirectory: TemporaryDirectoryRemover = (target, options) => rm(target, options),
  warn: (message: string) => void = console.error,
): Promise<boolean> {
  try {
    await removeDirectory(pathValue, {
      recursive: true,
      force: true,
      maxRetries: 4,
      retryDelay: 100,
    });
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
    if (!code || !["EBUSY", "EPERM", "ENOTEMPTY"].includes(code)) {
      throw error;
    }

    warn(`[upstream governance] 警告：临时目录仍被占用，已保留供后续清理：${pathValue} (${code})`);
    return false;
  }
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`并发数必须是正整数：${concurrency}`);
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await task(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function buildMetadataFetchArgs(checkoutRoot: string, headSha: string): string[] {
  return [
    "-C",
    checkoutRoot,
    "fetch",
    "--depth=1",
    "--filter=blob:none",
    "--no-tags",
    "origin",
    headSha,
  ];
}

interface UpstreamRecord {
  id: string;
  title?: string;
  kind?: string;
  status?: string;
  owner?: string;
  sourceUrl?: string;
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
    source_url?: string;
    source_paths?: string[];
  };
  remote?: RemoteHeadEvidence;
  source_tree?: RemoteSourceTreeEvidence;
  notes?: {
    path?: string;
    content?: string;
  };
}

interface RemoteHeadEvidence {
  source_url: string;
  checked_at: string;
  command: "git ls-remote HEAD";
  head_sha: string | null;
  error?: string;
}

interface RemoteSourceTreeEntry {
  mode: string;
  type: "blob" | "tree" | "commit";
  object: string;
  path: string;
}

interface RemoteSourceTreeEvidence {
  source_url: string;
  checked_at: string;
  command: "git fetch/ls-tree source_paths";
  head_sha: string;
  source_paths: string[];
  entry_count: number;
  manifest_sha256: string;
  entries: RemoteSourceTreeEntry[];
}

interface RemoteContentPathChange {
  status: string;
  path: string;
  previous_path?: string;
}

interface RemoteContentEvidence {
  source_url: string;
  checked_at: string;
  command: "git fetch/diff source_paths";
  baseline_head_sha: string | null;
  head_sha: string | null;
  source_paths: string[];
  status: "unchanged-same-head" | "unchanged" | "changed" | "source-paths-gap" | "unknown";
  changed_paths: RemoteContentPathChange[];
  unregistered_changed_path_count: number;
  unregistered_changed_paths: string[];
  unregistered_ai_asset_path_count: number;
  unregistered_ai_asset_paths: string[];
  source_paths_gap: boolean;
  error?: string;
}

interface SnapshotResult {
  upstream: string;
  mode: "snapshot";
  snapshot_path: string;
  captured_at: string;
  label: string | null;
  review_status: "pending-manual-review";
  summary: {
    source_paths: number;
    notes_lines: number;
    remote_head: string | null;
    source_tree_entries: number;
    source_tree_sha256: string | null;
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
    source_url: string | null;
    source_paths: string[];
    remote?: RemoteHeadEvidence;
    remote_content?: RemoteContentEvidence;
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

function toDisplayPath(pathValue: string): string {
  const relativePath = relative(resolveWorkspacePath("."), pathValue);
  return relativePath.startsWith("..") ? pathValue : relativePath || ".";
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
      case "source_url":
        current.sourceUrl = parsed.value;
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

  validateSnapshotSourceTree(payload, pathValue);
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

function sanitizeSnapshotLabel(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/-+/g, "-");
}

function buildSnapshotFileName(capturedAt: string, label?: string): string {
  const safeTimestamp = capturedAt.replace(/[:.]/g, "-");
  const safeLabel = label ? sanitizeSnapshotLabel(label) : "";
  return safeLabel ? `${safeTimestamp}-${safeLabel}.json` : `${safeTimestamp}.json`;
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
    source_url: item.sourceUrl ?? "-",
  };

  const baselineMetadata: Record<string, string> = {
    title: baseline.metadata?.title ?? "-",
    kind: baseline.metadata?.kind ?? "-",
    status: baseline.metadata?.status ?? "-",
    owner: baseline.metadata?.owner ?? "-",
    source_url: baseline.metadata?.source_url ?? "-",
  };

  return Object.keys(currentMetadata)
    .filter((field) => currentMetadata[field] !== baselineMetadata[field])
    .map((field) => ({
      field,
      before: baselineMetadata[field],
      after: currentMetadata[field],
    }));
}

function buildImpacts(
  result: UpstreamDiffResult["changes"],
  remoteContent?: RemoteContentEvidence,
): ImpactRecord[] {
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

  const hasRemoteContentChanges = Boolean(
    remoteContent &&
      (remoteContent.changed_paths.length > 0 || remoteContent.source_paths_gap),
  );
  const hasUnregisteredAiAssetPaths = Boolean(
    remoteContent && remoteContent.unregistered_ai_asset_path_count > 0,
  );

  if (hasUnregisteredAiAssetPaths) {
    impacts.push({
      target: "references",
      effect: "远端出现未登记的疑似 AI asset 路径，需要更新 `references/upstreams.yaml` 或记录不采纳边界。",
      directWrite: false,
    });
  }

  if (hasRemoteContentChanges) {
    const remoteToolkitEffect = hasUnregisteredAiAssetPaths
      ? "远端未登记路径疑似包含 AI asset，需要人工判断是否扩展 source_paths 并吸收 canonical content。"
      : remoteContent?.source_paths_gap
        ? "远端有变化但登记 source_paths 未命中，需要人工复核上游路径覆盖。"
        : "远端登记路径已有内容变化，需要人工判断是否影响 canonical content。";
    const existingToolkitImpact = impacts.find((impact) => impact.target === "toolkit");

    if (existingToolkitImpact) {
      existingToolkitImpact.effect = `${existingToolkitImpact.effect} ${remoteToolkitEffect}`;
    } else {
      impacts.push({
        target: "toolkit",
        effect: remoteToolkitEffect,
        directWrite: false,
      });
    }
  }

  if (hasRemoteContentChanges && !impacts.some((impact) => impact.target === "platform")) {
    impacts.push({
      target: "platform",
      effect: "远端内容变化可能影响平台产物生成判断，但不会直接写入 `packages/platform-*`。",
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

function parseNameStatusOutput(source: string): RemoteContentPathChange[] {
  return source
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, firstPath, secondPath] = line.split("\t");
      if (status.startsWith("R") || status.startsWith("C")) {
        return {
          status,
          previous_path: firstPath,
          path: secondPath ?? firstPath ?? "-",
        };
      }

      return {
        status,
        path: firstPath ?? "-",
      };
    });
}

function parseNameOnlyOutput(source: string): string[] {
  return source
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSourceTreeOutput(source: string): RemoteSourceTreeEntry[] {
  return source
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const match = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\t([\s\S]+)$/u.exec(record);
      if (!match) {
        throw new Error(`无法解析 source tree 条目：${record}`);
      }

      return {
        mode: match[1],
        type: match[2] as RemoteSourceTreeEntry["type"],
        object: match[3],
        path: match[4],
      };
    });
}

function serializeSourceTreeEntries(entries: readonly RemoteSourceTreeEntry[]): string {
  if (entries.length === 0) {
    return "";
  }

  return `${entries.map((entry) => `${entry.mode} ${entry.type} ${entry.object}\t${entry.path}`).join("\0")}\0`;
}

function createSourceTreeHash(entries: readonly RemoteSourceTreeEntry[]): string {
  return createHash("sha256").update(serializeSourceTreeEntries(entries)).digest("hex");
}

function validateSnapshotSourceTree(snapshot: SnapshotRecord, pathValue: string): void {
  const sourceTree = snapshot.source_tree;
  if (!sourceTree) {
    return;
  }

  const displayPath = toWorkspaceRelative(pathValue);
  if (sourceTree.entry_count !== sourceTree.entries.length) {
    throw new Error(`snapshot source_tree.entry_count 不匹配：${displayPath}`);
  }

  if (sourceTree.head_sha !== snapshot.remote?.head_sha) {
    throw new Error(`snapshot source_tree.head_sha 与 remote.head_sha 不匹配：${displayPath}`);
  }

  const metadataPaths = snapshot.metadata?.source_paths ?? [];
  if (
    sourceTree.source_paths.length !== metadataPaths.length ||
    sourceTree.source_paths.some((pathValueEntry, index) => pathValueEntry !== metadataPaths[index])
  ) {
    throw new Error(`snapshot source_tree.source_paths 与 metadata.source_paths 不匹配：${displayPath}`);
  }

  if (sourceTree.entries.some((entry) => !isCoveredBySourcePaths(entry.path, sourceTree.source_paths))) {
    throw new Error(`snapshot source_tree 包含登记范围外路径：${displayPath}`);
  }

  if (sourceTree.manifest_sha256 !== createSourceTreeHash(sourceTree.entries)) {
    throw new Error(`snapshot source_tree.manifest_sha256 校验失败：${displayPath}`);
  }
}

const aiAssetPathPatterns = [
  /^AGENTS\.md$/u,
  /^CLAUDE\.md$/u,
  /^GEMINI\.md$/u,
  /^QWEN\.md$/u,
  /(^|\/)(?:agents|commands|skills|prompts)\//u,
  /^\.agents\/(?:agents|commands|skills|plugins)(?:\/|$)/u,
  /^\.agents\/plugins\/marketplace\.json$/u,
  /^\.codex-plugin(?:\/|$)/u,
  /^\.claude-plugin(?:\/|$)/u,
  /^\.claude\/(?:agents|commands|skills)(?:\/|$)/u,
  /^\.opencode\/(?:agents|commands|skills)(?:\/|$)/u,
  /^\.gemini\/(?:agents|commands|skills)(?:\/|$)/u,
];

function isLikelyAiAssetPath(pathValue: string): boolean {
  return aiAssetPathPatterns.some((pattern) => pattern.test(pathValue));
}

function isCoveredBySourcePaths(pathValue: string, sourcePaths: readonly string[]): boolean {
  return sourcePaths.some((sourcePath) => {
    const normalized = sourcePath.replace(/\/+$/g, "");
    return normalized === "." || pathValue === normalized || pathValue.startsWith(`${normalized}/`);
  });
}

async function createRemoteHeadEvidence(item: UpstreamRecord): Promise<RemoteHeadEvidence> {
  const checkedAt = new Date().toISOString();

  if (!item.sourceUrl) {
    return {
      source_url: "-",
      checked_at: checkedAt,
      command: "git ls-remote HEAD",
      head_sha: null,
      error: "未配置 source_url。",
    };
  }

  try {
    const { stdout } = await execFileAsync("git", ["ls-remote", item.sourceUrl, "HEAD"], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    const [headSha] = stdout.trim().split(/\s+/);
    return {
      source_url: item.sourceUrl,
      checked_at: checkedAt,
      command: "git ls-remote HEAD",
      head_sha: headSha || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      source_url: item.sourceUrl,
      checked_at: checkedAt,
      command: "git ls-remote HEAD",
      head_sha: null,
      error: message,
    };
  }
}

async function createRemoteSourceTreeEvidence(
  item: UpstreamRecord,
  remote: RemoteHeadEvidence,
): Promise<RemoteSourceTreeEvidence> {
  if (!item.sourceUrl) {
    throw new Error(`上游 ${item.id} 未配置 source_url，无法生成 source tree manifest。`);
  }

  if (!remote.head_sha || remote.error) {
    throw new Error(remote.error ?? `上游 ${item.id} 未采集到远端 HEAD。`);
  }

  if (item.sourcePaths.length === 0) {
    throw new Error(`上游 ${item.id} 未配置 source_paths，无法生成 source tree manifest。`);
  }

  const checkedAt = new Date().toISOString();
  const checkoutRoot = await mkdtemp(resolve(tmpdir(), "zc-upstream-tree-"));

  try {
    await execFileAsync("git", ["init", checkoutRoot], { timeout: 15000, maxBuffer: 1024 * 1024 });
    await execFileAsync("git", ["-C", checkoutRoot, "remote", "add", "origin", item.sourceUrl], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    await execFileAsync("git", buildMetadataFetchArgs(checkoutRoot, remote.head_sha), {
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const { stdout } = await execFileAsync(
      "git",
      ["-C", checkoutRoot, "ls-tree", "-r", "-z", remote.head_sha, "--", ...item.sourcePaths],
      { timeout: 30000, maxBuffer: 16 * 1024 * 1024 },
    );
    const entries = parseSourceTreeOutput(stdout);
    if (entries.length === 0) {
      throw new Error(`上游 ${item.id} 的 source_paths 未匹配任何远端文件。`);
    }

    return {
      source_url: item.sourceUrl,
      checked_at: checkedAt,
      command: "git fetch/ls-tree source_paths",
      head_sha: remote.head_sha,
      source_paths: item.sourcePaths,
      entry_count: entries.length,
      manifest_sha256: createSourceTreeHash(entries),
      entries,
    };
  } finally {
    await removeTemporaryDirectory(checkoutRoot);
  }
}

async function createRemoteContentEvidence(
  item: UpstreamRecord,
  baseline: SnapshotRecord,
  remote: RemoteHeadEvidence,
): Promise<RemoteContentEvidence> {
  const checkedAt = new Date().toISOString();
  const baselineHead = baseline.remote?.head_sha ?? null;
  const currentHead = remote.head_sha;
  const base = {
    source_url: item.sourceUrl ?? "-",
    checked_at: checkedAt,
    command: "git fetch/diff source_paths" as const,
    baseline_head_sha: baselineHead,
    head_sha: currentHead,
    source_paths: item.sourcePaths,
    changed_paths: [],
    unregistered_changed_path_count: 0,
    unregistered_changed_paths: [],
    unregistered_ai_asset_path_count: 0,
    unregistered_ai_asset_paths: [],
    source_paths_gap: false,
  };

  if (!item.sourceUrl) {
    return {
      ...base,
      status: "unknown",
      error: "未配置 source_url。",
    };
  }

  if (!currentHead || remote.error) {
    return {
      ...base,
      status: "unknown",
      error: remote.error ?? "未采集到当前远端 HEAD。",
    };
  }

  if (!baselineHead) {
    return {
      ...base,
      status: "unknown",
      error: "基线 snapshot 缺少 remote.head_sha，无法执行真实内容 diff。",
    };
  }

  if (baselineHead === currentHead) {
    return {
      ...base,
      status: "unchanged-same-head",
    };
  }

  const checkoutRoot = await mkdtemp(resolve(tmpdir(), "zc-upstream-"));

  try {
    await execFileAsync("git", ["init", checkoutRoot], { timeout: 15000, maxBuffer: 1024 * 1024 });
    await execFileAsync("git", ["-C", checkoutRoot, "remote", "add", "origin", item.sourceUrl], {
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });
    await execFileAsync("git", buildMetadataFetchArgs(checkoutRoot, currentHead), {
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });
    await execFileAsync("git", buildMetadataFetchArgs(checkoutRoot, baselineHead), {
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    });

    const registeredDiff =
      item.sourcePaths.length > 0
        ? await execFileAsync(
            "git",
            [
              "-C",
              checkoutRoot,
              "diff",
              "--no-renames",
              "--name-status",
              baselineHead,
              currentHead,
              "--",
              ...item.sourcePaths,
            ],
            { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
          )
        : { stdout: "", stderr: "" };
    const allDiff = await execFileAsync(
      "git",
      ["-C", checkoutRoot, "diff", "--no-renames", "--name-only", baselineHead, currentHead],
      { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
    );
    const changedPaths = parseNameStatusOutput(registeredDiff.stdout);
    const allChangedPaths = parseNameOnlyOutput(allDiff.stdout);
    const unregisteredChangedPaths = allChangedPaths.filter(
      (pathValue) => !isCoveredBySourcePaths(pathValue, item.sourcePaths),
    );
    const unregisteredAiAssetPaths = unregisteredChangedPaths.filter(isLikelyAiAssetPath);
    const sourcePathsGap = allChangedPaths.length > 0 && changedPaths.length === 0;

    return {
      ...base,
      status: sourcePathsGap ? "source-paths-gap" : changedPaths.length > 0 ? "changed" : "unchanged",
      changed_paths: changedPaths,
      unregistered_changed_path_count: unregisteredChangedPaths.length,
      unregistered_changed_paths: unregisteredChangedPaths.slice(0, 50),
      unregistered_ai_asset_path_count: unregisteredAiAssetPaths.length,
      unregistered_ai_asset_paths: unregisteredAiAssetPaths.slice(0, 50),
      source_paths_gap: sourcePathsGap,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: "unknown",
      error: message,
    };
  } finally {
    await removeTemporaryDirectory(checkoutRoot);
  }
}

async function createDiffResult(
  item: UpstreamRecord,
  against?: string,
  options: { withRemote?: boolean } = {},
): Promise<UpstreamDiffResult> {
  const baselinePath = await resolveBaselinePath(item, against);
  const baseline = await loadSnapshot(baselinePath);
  const currentNotesContent = await readOptionalFile(item.notesPath);
  const remote = options.withRemote ? await createRemoteHeadEvidence(item) : undefined;
  const remoteContent = remote ? await createRemoteContentEvidence(item, baseline, remote) : undefined;

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
    impacts: buildImpacts(changes, remoteContent),
    recommendation: "human-review-required",
    review_status: "pending-manual-review",
    evidence: {
      notes_path: item.notesPath ?? null,
      snapshot: toWorkspaceRelative(baselinePath),
      source_url: item.sourceUrl ?? null,
      source_paths: item.sourcePaths,
      ...(remote ? { remote } : {}),
      ...(remoteContent ? { remote_content: remoteContent } : {}),
    },
  };
}

function formatImpactLines(impacts: readonly ImpactRecord[]): string[] {
  return impacts.map(
    (impact) => `- ${impact.target}: ${impact.effect}（direct_write=${impact.directWrite ? "yes" : "no"}）`,
  );
}

function formatRemoteEvidenceLines(
  remote: RemoteHeadEvidence | undefined,
  remoteContent: RemoteContentEvidence | undefined,
): string[] {
  if (!remote) {
    return ["- remote_head: 未采集（使用 `--with-remote` 启用）"];
  }

  const lines = [
    `- remote_source: \`${remote.source_url}\``,
    `- remote_checked_at: \`${remote.checked_at}\``,
    `- remote_head: \`${remote.head_sha ?? "-"}\``,
  ];

  if (remote.error) {
    lines.push(`- remote_error: \`${remote.error}\``);
  }

  if (!remoteContent) {
    lines.push("- remote_content: 未采集");
    return lines;
  }

  lines.push(`- remote_content_status: \`${remoteContent.status}\``);
  lines.push(`- remote_content_changed_paths: ${remoteContent.changed_paths.length}`);
  lines.push(`- remote_content_source_paths_gap: ${remoteContent.source_paths_gap ? "yes" : "no"}`);
  lines.push(`- remote_content_unregistered_changed_paths: ${remoteContent.unregistered_changed_path_count}`);
  lines.push(`- remote_content_unregistered_ai_asset_paths: ${remoteContent.unregistered_ai_asset_path_count}`);

  if (remoteContent.unregistered_changed_paths.length > 0) {
    lines.push(
      `- remote_content_unregistered_sample: ${remoteContent.unregistered_changed_paths
        .slice(0, 5)
        .map((pathValue) => `\`${pathValue}\``)
        .join(", ")}`,
    );
  }

  if (remoteContent.unregistered_ai_asset_paths.length > 0) {
    lines.push(
      `- remote_content_unregistered_ai_asset_sample: ${remoteContent.unregistered_ai_asset_paths
        .slice(0, 5)
        .map((pathValue) => `\`${pathValue}\``)
        .join(", ")}`,
    );
  }

  if (remoteContent.error) {
    lines.push(`- remote_content_error: \`${remoteContent.error}\``);
  }

  return lines;
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
    `源地址：${result.evidence.source_url ?? "-"}`,
    `源路径：${result.evidence.source_paths.join(", ") || "-"}`,
    ...formatRemoteEvidenceLines(result.evidence.remote, result.evidence.remote_content),
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
        `- 源地址：${result.evidence.source_url ?? "-"}`,
        `- 源路径：${result.evidence.source_paths.join(", ") || "-"}`,
        ...formatRemoteEvidenceLines(result.evidence.remote, result.evidence.remote_content),
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
      `- source url: \`${result.evidence.source_url ?? "-"}\``,
      `- source paths: ${result.evidence.source_paths.map((pathValue) => `\`${pathValue}\``).join(", ") || "-"}`,
      ...formatRemoteEvidenceLines(result.evidence.remote, result.evidence.remote_content),
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

function formatSnapshotText(result: SnapshotResult): string {
  return [
    `上游：${result.upstream}`,
    `模式：${result.mode}`,
    `快照：${result.snapshot_path}`,
    `采集时间：${result.captured_at}`,
    `标签：${result.label ?? "-"}`,
    `审阅状态：${result.review_status}`,
    "",
    "摘要：",
    `- source paths：${result.summary.source_paths}`,
    `- notes 有效行数：${result.summary.notes_lines}`,
    `- remote head：${result.summary.remote_head ?? "未采集"}`,
    `- source tree 条目：${result.summary.source_tree_entries}`,
    `- source tree SHA-256：${result.summary.source_tree_sha256 ?? "未采集"}`,
    "",
    "说明：",
    "- snapshot 为追加式治理记录，不会直接写入 `packages/toolkit`。",
    "- snapshot 为追加式治理记录，不会直接写入 `packages/platform-*`。",
  ].join("\n");
}

function formatSnapshotMarkdown(result: SnapshotResult): string {
  return [
    "# Upstream Snapshot",
    "",
    "## Summary",
    `- upstream: \`${result.upstream}\``,
    "- mode: `snapshot`",
    `- captured_at: \`${result.captured_at}\``,
    `- label: \`${result.label ?? "-"}\``,
    `- review_status: \`${result.review_status}\``,
    "",
    "## Evidence",
    `- snapshot_path: \`${result.snapshot_path}\``,
    `- source_paths: ${result.summary.source_paths}`,
    `- notes_lines: ${result.summary.notes_lines}`,
    `- remote_head: \`${result.summary.remote_head ?? "未采集"}\``,
    `- source_tree_entries: ${result.summary.source_tree_entries}`,
    `- source_tree_sha256: \`${result.summary.source_tree_sha256 ?? "未采集"}\``,
    "",
    "## Boundary",
    "- append-only snapshot",
    "- no direct write to `packages/toolkit`",
    "- no direct write to `packages/platform-*`",
  ].join("\n");
}

function formatPayload(format: DiffFormat | ReportFormat | ImportFormat, payload: object, fallbackText: string): string {
  if (format === "json") {
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  return `${fallbackText}\n`;
}

async function emitOutput(
  content: string,
  outputPath?: string,
): Promise<void> {
  if (!outputPath) {
    console.log(content.trimEnd());
    return;
  }

  const absolutePath = isAbsolute(outputPath) ? outputPath : resolveWorkspacePath(outputPath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  console.log(`已写入输出：${toDisplayPath(absolutePath)}`);
}

async function emitPayload(
  format: DiffFormat | ReportFormat | ImportFormat,
  payload: object,
  fallbackText: string,
  outputPath?: string,
): Promise<void> {
  await emitOutput(formatPayload(format, payload, fallbackText), outputPath);
}

async function createSnapshot(
  item: UpstreamRecord,
  label?: string,
  options: { withRemote?: boolean } = {},
): Promise<SnapshotResult> {
  if (!item.snapshotsPath) {
    throw new Error(`上游 ${item.id} 未配置 snapshots_path。`);
  }

  const capturedAt = new Date().toISOString();
  const currentNotesContent = await readOptionalFile(item.notesPath);
  const remote = options.withRemote ? await createRemoteHeadEvidence(item) : undefined;
  const sourceTree = remote ? await createRemoteSourceTreeEvidence(item, remote) : undefined;
  const snapshotPayload: SnapshotRecord = {
    upstream: item.id,
    captured_at: capturedAt,
    label: label ?? undefined,
    metadata: {
      title: item.title,
      kind: item.kind,
      status: item.status,
      owner: item.owner,
      source_url: item.sourceUrl,
      source_paths: item.sourcePaths,
    },
    remote,
    source_tree: sourceTree,
    notes: item.notesPath
      ? {
          path: item.notesPath,
          content: currentNotesContent,
        }
      : undefined,
  };

  const snapshotsRoot = resolveReferencePath(item.snapshotsPath);
  const snapshotName = buildSnapshotFileName(capturedAt, label);
  const snapshotPath = resolve(snapshotsRoot, snapshotName);
  const tempSnapshotPath = `${snapshotPath}.tmp-${process.pid}`;

  await mkdir(snapshotsRoot, { recursive: true });
  try {
    await writeFile(tempSnapshotPath, `${JSON.stringify(snapshotPayload, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(tempSnapshotPath, snapshotPath);
  } catch (error) {
    await rm(tempSnapshotPath, { force: true });
    throw error;
  }

  return {
    upstream: item.id,
    mode: "snapshot",
    snapshot_path: toWorkspaceRelative(snapshotPath),
    captured_at: capturedAt,
    label: label ?? null,
    review_status: "pending-manual-review",
    summary: {
      source_paths: item.sourcePaths.length,
      notes_lines: countMeaningfulLines(currentNotesContent),
      remote_head: remote?.head_sha ?? null,
      source_tree_entries: sourceTree?.entry_count ?? 0,
      source_tree_sha256: sourceTree?.manifest_sha256 ?? null,
    },
  };
}

export async function createUpstreamSnapshot(id: string, label?: string): Promise<SnapshotResult> {
  const upstreams = await loadUpstreams();
  const item = upstreams.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`未找到上游记录：${id}`);
  }
  return createSnapshot(item, label);
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
  console.error(`[upstream governance] 错误：${message}`);
  process.exitCode = 1;
}

export function registerUpstreamCommand(program: Command): void {
  program.addCommand(buildUpstreamCommand());
}

export function createUpstreamProgram(): CommanderCommand {
  const program = buildUpstreamCommand();
  program.name("upstream-governance").description("仓库内上游治理命令");
  return program;
}

function buildUpstreamCommand(): CommanderCommand {
  const upstream = new CommanderCommand("upstream").description("上游治理命令");

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
    .option("--with-remote", "采集远端 HEAD，并在 HEAD 变化时对 source_paths 执行真实内容 diff")
    .action(async (id: string, options: { against?: string; format?: DiffFormat; withRemote?: boolean }) => {
      try {
        const upstreams = await loadUpstreams();
        const item = findUpstreamOrExit(upstreams, id);

        if (!item) {
          return;
        }

        const result = await createDiffResult(item, options.against, { withRemote: options.withRemote });
        await emitPayload(options.format ?? "text", result, formatDiffText(result));
      } catch (error) {
        printCommandError(error);
      }
    });

  upstream
    .command("snapshot")
    .description("冻结当前 upstream 状态，生成追加式 snapshot")
    .argument("<id>", "上游 ID")
    .option("--label <label>", "附加到 snapshot 文件名的标签")
    .option("--format <format>", "输出格式：text | json | md", "text")
    .option("--with-remote", "采集远端 HEAD 与 source_paths tree manifest 并写入 snapshot")
    .action(async (id: string, options: { label?: string; format?: ReportFormat; withRemote?: boolean }) => {
      try {
        const upstreams = await loadUpstreams();
        const item = findUpstreamOrExit(upstreams, id);

        if (!item) {
          return;
        }

        const result = await createSnapshot(item, options.label, { withRemote: options.withRemote });
        const format = options.format ?? "text";

        if (format === "md") {
          await emitOutput(`${formatSnapshotMarkdown(result)}\n`);
          return;
        }

        await emitPayload(format, result, formatSnapshotText(result));
      } catch (error) {
        printCommandError(error);
      }
    });

  upstream
    .command("report")
    .description("生成 upstream 审阅材料")
    .argument("<target>", "上游 ID 或 all")
    .option("--format <format>", "输出格式：text | json | md", "text")
    .option("--output <path>", "把输出写入文件，而不是打印到终端")
    .option("--with-remote", "采集远端 HEAD，并在 HEAD 变化时对 source_paths 执行真实内容 diff")
    .action(async (target: string, options: { format?: ReportFormat; output?: string; withRemote?: boolean }) => {
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

        const shouldReportRemoteProgress = target === "all" && options.withRemote === true && items.length > 1;
        let completedRemoteReports = 0;

        if (shouldReportRemoteProgress) {
          console.error(`[upstream governance] 正在采集远端证据：0/${items.length}`);
        }

        const results = await mapWithConcurrency(
          items,
          options.withRemote ? 4 : items.length,
          async (item) => {
            const result = await createDiffResult(item, undefined, { withRemote: options.withRemote });

            if (shouldReportRemoteProgress) {
              completedRemoteReports += 1;
              console.error(
                `[upstream governance] 远端证据采集完成：${completedRemoteReports}/${items.length} (${item.id})`,
              );
            }

            return result;
          },
        );
        const format = options.format ?? "text";

        if (format === "md") {
          await emitOutput(`${formatReportMarkdown(results)}\n`, options.output);
          return;
        }

        await emitPayload(
          format,
          { mode: "report", review_status: "pending-manual-review", results },
          formatReportText(results),
          options.output,
        );
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
    .option("--output <path>", "把输出写入文件，而不是打印到终端")
    .action(async (id: string, options: { dryRun?: boolean; format?: ImportFormat; output?: string }) => {
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
        await emitPayload(options.format ?? "text", result, formatImportDryRunText(result), options.output);
      } catch (error) {
        printCommandError(error);
      }
    });

  return upstream;
}
