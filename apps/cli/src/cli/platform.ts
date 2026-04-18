import { Command, InvalidArgumentError } from "commander";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { attachPlanMetadata, type GenerationPlan, type InstallPlan, type OverwriteMode } from "@zmice/platform-core";
import { resolvePlatformInstallStatus } from "../platform-state/status.js";
import type { PlatformInstallStatusResult } from "../platform-state/types.js";
import { normalizeInstallSelector, resolveInstallTarget } from "../utils/install-target.js";
import {
  resolvePlatformInstallReceiptPath,
  writePlatformInstallReceiptForPlan,
} from "../utils/platform-install-receipt.js";
import {
  ArtifactConflictError,
  importWorkspaceDistModule,
  resolveWorkspacePath,
  writeArtifacts,
} from "../utils/workspace.js";

type PlatformName = "qwen" | "codex" | "qoder";
type PlatformOutputFormat = "text" | "json";
type PlatformInstallScope = "project" | "global" | "dir";
type PlatformAction = "generate" | "install" | "update";
type PlatformTargetSelectorOpts = {
  dir?: string;
  project?: boolean;
  global?: boolean;
};
const platformNames: readonly PlatformName[] = ["qwen", "codex", "qoder"];

interface ToolkitAssetMetaLike {
  kind: "skill" | "command" | "agent";
  title: string;
  description: string;
  platforms?: readonly PlatformName[];
}

interface ToolkitAssetLike {
  id: string;
  body: string;
  meta: ToolkitAssetMetaLike;
}

interface ToolkitManifestLike {
  generatedAt?: string;
  contentRoot: string;
  assets: readonly ToolkitAssetLike[];
}

interface PlatformAssetLike {
  id: string;
  kind: "skill" | "command" | "agent";
  platforms: readonly string[];
  title?: string;
  summary?: string;
  body?: string;
}

interface PlatformManifestLike {
  source?: string;
  assets: readonly PlatformAssetLike[];
}

type PlatformPlanLike = GenerationPlan | InstallPlan;

interface PlatformResolutionMetadata {
  autoResolvedRoot?: boolean;
  rootSource?: string;
  hint?: string;
  scope?: PlatformInstallScope;
}

interface PlatformResultExtra {
  receiptPath?: string | null;
  zcVersion?: string | null;
  contentFingerprint?: string | null;
  status?: string | null;
  noop?: boolean;
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
}

interface PlatformModule {
  createCodexGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => GenerationPlan;
  createCodexInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => InstallPlan;
  createQoderGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => GenerationPlan;
  createQoderInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => InstallPlan;
  createQwenGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => GenerationPlan;
  createQwenInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => InstallPlan;
}

const defaultPlatforms: readonly PlatformName[] = ["qwen", "codex", "qoder"];

function getCliVersion(): string {
  const packageJsonPath = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    version?: string;
  };
  return packageJson.version ?? "0.0.0";
}

function normalizeManifest(manifest: ToolkitManifestLike): PlatformManifestLike {
  return {
    source: manifest.contentRoot,
    assets: manifest.assets.map((asset) => ({
      id: asset.id,
      kind: asset.meta.kind,
      platforms: asset.meta.platforms ?? defaultPlatforms,
      title: asset.meta.title,
      summary: asset.meta.description,
      body: asset.body
    }))
  };
}

async function loadToolkitManifest(): Promise<PlatformManifestLike> {
  const toolkit = await importWorkspaceDistModule<ToolkitModule>("packages/toolkit/dist/index.js");
  return normalizeManifest(await toolkit.loadToolkitManifest());
}

function finalizePlan<T extends PlatformPlanLike>(plan: T): T {
  return attachPlanMetadata(plan) as T;
}

async function loadPlatformModule(platform: PlatformName): Promise<PlatformModule> {
  const packageMap: Record<PlatformName, string> = {
    qwen: "packages/platform-qwen/dist/index.js",
    codex: "packages/platform-codex/dist/index.js",
    qoder: "packages/platform-qoder/dist/index.js"
  };

  return importWorkspaceDistModule<PlatformModule>(packageMap[platform]);
}

function createGenerationPlan(
  platform: PlatformName,
  platformModule: PlatformModule,
  manifest: PlatformManifestLike
): GenerationPlan {
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenGenerationPlan) {
        throw new Error("Qwen 平台包未导出 createQwenGenerationPlan()");
      }
      return finalizePlan(platformModule.createQwenGenerationPlan(manifest, { manifestSource: manifest.source }));
    case "codex":
      if (!platformModule.createCodexGenerationPlan) {
        throw new Error("Codex 平台包未导出 createCodexGenerationPlan()");
      }
      return finalizePlan(platformModule.createCodexGenerationPlan(manifest, { manifestSource: manifest.source }));
    case "qoder":
      if (!platformModule.createQoderGenerationPlan) {
        throw new Error("Qoder 平台包未导出 createQoderGenerationPlan()");
      }
      return finalizePlan(platformModule.createQoderGenerationPlan(manifest, { manifestSource: manifest.source }));
  }
}

function createInstallPlan(
  platform: PlatformName,
  platformModule: PlatformModule,
  manifest: PlatformManifestLike,
  destinationRoot: string,
  overwrite: OverwriteMode
): InstallPlan {
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenInstallPlan) {
        throw new Error("Qwen 平台包未导出 createQwenInstallPlan()");
      }
      return finalizePlan(platformModule.createQwenInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      }));
    case "codex":
      if (!platformModule.createCodexInstallPlan) {
        throw new Error("Codex 平台包未导出 createCodexInstallPlan()");
      }
      return finalizePlan(platformModule.createCodexInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      }));
    case "qoder":
      if (!platformModule.createQoderInstallPlan) {
        throw new Error("Qoder 平台包未导出 createQoderInstallPlan()");
      }
      return finalizePlan(platformModule.createQoderInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      }));
  }
}

function resolveOverwriteMode(force: boolean | undefined): OverwriteMode {
  return force ? "force" : "error";
}

function resolveOutputFormat(json?: boolean): PlatformOutputFormat {
  return json ? "json" : "text";
}

function resolveScopeFromSelector(opts: PlatformTargetSelectorOpts): PlatformInstallScope {
  return normalizeInstallSelector(opts).mode;
}

function emitOutput(format: PlatformOutputFormat, payload: object, text: string): void {
  if (format === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(text);
}

function emitPlatformError(
  format: PlatformOutputFormat,
  target: PlatformName | undefined,
  action: PlatformAction | "where" | "status",
  error: string,
  details?: object,
): void {
  if (format === "json") {
    console.error(JSON.stringify({
      mode: "error",
      action,
      target: target ?? null,
      error,
      ...details,
    }, null, 2));
    return;
  }

  console.error(error);
}

function formatActionLabel(action: PlatformAction): string {
  switch (action) {
    case "generate":
      return "生成";
    case "install":
      return "安装";
    case "update":
      return "更新";
  }
}

function formatRootLabel(action: PlatformAction, root: string, metadata?: PlatformResolutionMetadata): string {
  const noun = action === "generate" ? "生成目录" : "安装目录";
  if (action !== "generate" && metadata?.autoResolvedRoot) {
    return `${noun}自动解析（${metadata.rootSource ?? "project-root"}）：${root}`;
  }

  return `${noun}：${root}`;
}

function formatStatusLabel(kind: PlatformInstallStatusResult["kind"]): string {
  switch (kind) {
    case "not-installed":
      return "未安装";
    case "up-to-date":
      return "已是最新";
    case "update-available":
      return "可更新";
    case "drifted":
      return "已漂移";
  }
}

function summarizeResult(action: PlatformAction, target: PlatformName, root: string, result: {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}, metadata?: PlatformResolutionMetadata & PlatformResultExtra): string {
  const mode = result.dryRun ? "预演完成" : "完成";
  return [
    `${target} ${formatActionLabel(action)}${mode}`,
    formatRootLabel(action, root, metadata),
    ...(metadata?.status ? [`状态：${metadata.status}`] : []),
    ...(metadata?.receiptPath ? [`回执：${metadata.receiptPath}`] : []),
    ...(metadata?.zcVersion ? [`zc 版本：${metadata.zcVersion}`] : []),
    ...(metadata?.contentFingerprint ? [`内容指纹：${metadata.contentFingerprint}`] : []),
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    metadata?.noop
      ? "无需写入，当前安装已满足目标状态。"
      : `新增 ${result.created}，覆盖 ${result.overwritten}，未变更 ${result.unchanged}${result.dryRun ? `，跳过写入 ${result.skipped}` : ""}`,
  ].join("\n");
}

function summarizePlan(action: PlatformAction, target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: PlatformResolutionMetadata & {
  status?: string;
}): string {
  return [
    `${target} ${formatActionLabel(action)}计划`,
    formatRootLabel(action, root, metadata),
    ...(metadata?.status ? [`状态：${metadata.status}`] : []),
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    `产物数量：${plan.artifacts.length}`,
    ...plan.artifacts.map((artifact) => `- ${artifact.path}`),
  ].join("\n");
}

function buildPlanPayload(action: PlatformAction, target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: PlatformResolutionMetadata & {
  status?: string | null;
}) {
  return {
    mode: "plan",
    action,
    target,
    root,
    scope: metadata?.scope ?? "project",
    rootSource: metadata?.rootSource ?? (metadata?.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: metadata?.autoResolvedRoot ?? false,
    hint: metadata?.hint ?? null,
    status: metadata?.status ?? null,
    artifactCount: plan.artifacts.length,
    contentFingerprint: plan.metadata?.fingerprint.value ?? null,
    overwrite: "overwrite" in plan ? plan.overwrite : null,
    artifacts: plan.artifacts,
  };
}

function buildResultPayload(action: PlatformAction, target: PlatformName, root: string, result: {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}, metadata?: PlatformResolutionMetadata & PlatformResultExtra) {
  return {
    mode: "result",
    action,
    target,
    root,
    scope: metadata?.scope ?? "project",
    rootSource: metadata?.rootSource ?? (metadata?.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: metadata?.autoResolvedRoot ?? false,
    hint: metadata?.hint ?? null,
    receiptPath: metadata?.receiptPath ?? null,
    zcVersion: metadata?.zcVersion ?? null,
    status: metadata?.status ?? null,
    noop: metadata?.noop ?? false,
    contentFingerprint: metadata?.contentFingerprint ?? null,
    ...result,
  };
}

function summarizeWhere(target: PlatformName, root: string, metadata: {
  rootSource: string;
  hint?: string;
  scope: PlatformInstallScope;
  marker?: string;
}): string {
  return [
    `${target} 安装目标`,
    `范围：${metadata.scope}`,
    `解析来源：${metadata.rootSource}`,
    ...(metadata.marker ? [`命中标记：${metadata.marker}`] : []),
    `目录：${root}`,
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
  ].join("\n");
}

function buildWherePayload(target: PlatformName, root: string, metadata: {
  rootSource: string;
  hint?: string;
  scope: PlatformInstallScope;
  marker?: string;
}): object {
  return {
    mode: "where",
    target,
    scope: metadata.scope,
    root,
    rootSource: metadata.rootSource,
    marker: metadata.marker ?? null,
    hint: metadata.hint ?? null,
  };
}

function reportConflict(error: ArtifactConflictError, target: PlatformName, destinationRoot: string): void {
  console.error(`${target} 安装失败：目标目录存在冲突文件。`);
  console.error(`目标目录：${destinationRoot}`);
  console.error("冲突文件：");
  for (const conflict of error.conflicts) {
    console.error(`- ${conflict.path}`);
  }
  console.error("如需覆盖，请追加 --force。");
}

function summarizeStatus(target: PlatformName, root: string, status: PlatformInstallStatusResult, metadata: {
  scope: PlatformInstallScope;
  rootSource: string;
  hint?: string;
  zcVersion?: string;
}): string {
  return [
    `${target} 安装状态`,
    `范围：${metadata.scope}`,
    `目录：${root}`,
    `状态：${status.kind}（${formatStatusLabel(status.kind)}）`,
    `回执：${status.receiptPath}`,
    ...(status.installedZcVersion ? [`已安装 zc 版本：${status.installedZcVersion}`] : []),
    ...(metadata.zcVersion ? [`当前 zc 版本：${metadata.zcVersion}`] : []),
    ...(status.installedContentFingerprint ? [`已安装内容指纹：${status.installedContentFingerprint}`] : []),
    ...(status.contentFingerprint ? [`当前内容指纹：${status.contentFingerprint}`] : []),
    `跟踪产物：${status.summary.trackedArtifacts}，漂移：${status.summary.driftedArtifacts}，缺失：${status.summary.missingArtifacts}，待更新：${status.summary.plannedChanges}`,
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
  ].join("\n");
}

function buildStatusPayload(target: PlatformName, root: string, status: PlatformInstallStatusResult, metadata: {
  scope: PlatformInstallScope;
  rootSource: string;
  hint?: string;
  zcVersion?: string;
}) {
  return {
    mode: "status",
    target,
    scope: metadata.scope,
    root,
    rootSource: metadata.rootSource,
    hint: metadata.hint ?? null,
    status: status.kind,
    receiptPath: status.receiptPath,
    zcVersion: metadata.zcVersion ?? null,
    installedZcVersion: status.installedZcVersion ?? null,
    contentFingerprint: status.contentFingerprint ?? null,
    installedContentFingerprint: status.installedContentFingerprint ?? null,
    summary: status.summary,
    artifacts: status.artifacts,
  };
}

export async function runPlatformGenerate(
  target: PlatformName,
  opts: { dir?: string; force?: boolean; plan?: boolean; json?: boolean }
): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  const outputRoot = opts.dir ? resolve(opts.dir) : resolveWorkspacePath(`.generated/${target}`);

  try {
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createGenerationPlan(target, platformModule, manifest);

    if (opts.plan) {
      emitOutput(format, buildPlanPayload("generate", target, outputRoot, {
        ...plan,
        artifacts: plan.artifacts.map((artifact) => ({
          path: join(outputRoot, artifact.path),
          content: artifact.content
        }))
      }), summarizePlan("generate", target, outputRoot, {
        ...plan,
        artifacts: plan.artifacts.map((artifact) => ({
          path: join(outputRoot, artifact.path),
          content: artifact.content
        }))
      }));
      return;
    }

    const result = await writeArtifacts(
      plan.artifacts.map((artifact) => ({
        path: join(outputRoot, artifact.path),
        content: artifact.content
      })),
      {
        dryRun: false,
        overwrite: resolveOverwriteMode(opts.force)
      }
    );

    emitOutput(format, buildResultPayload("generate", target, outputRoot, result), summarizeResult("generate", target, outputRoot, result));
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "generate",
      error instanceof Error ? `${target} 生成失败：${error.message}` : `${target} 生成失败。`,
    );
    process.exitCode = 1;
  }
}

function getUpdateOverwriteMode(
  status: PlatformInstallStatusResult,
  force: boolean | undefined,
): OverwriteMode {
  if (status.kind === "update-available") {
    return "force";
  }

  return resolveOverwriteMode(force);
}

export async function runPlatformInstall(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & {
    force?: boolean;
    plan?: boolean;
    json?: boolean;
  }
): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  let destinationRoot = "";
  try {
    const scope = resolveScopeFromSelector(opts);
    const targetResolution = await resolveInstallTarget(target, {
      dir: opts.dir,
      cwd: process.cwd(),
      project: opts.project,
      global: opts.global,
    });
    const autoResolvedRoot = targetResolution.source !== "explicit";
    destinationRoot = resolve(targetResolution.root);
    const overwrite = resolveOverwriteMode(opts.force);
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, overwrite);

    if (opts.plan) {
      emitOutput(
        format,
        buildPlanPayload("install", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
        }),
        summarizePlan("install", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
        })
      );
      return;
    }

    const result = await writeArtifacts(
      plan.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content
      })),
      {
        dryRun: false,
        overwrite
      }
    );
    await writePlatformInstallReceiptForPlan(plan, {
      installedAt: new Date().toISOString(),
      zcVersion: getCliVersion(),
    });

    emitOutput(
      format,
      buildResultPayload("install", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: "installed",
      }),
      summarizeResult("install", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: "installed",
      })
    );
  } catch (error) {
    if (error instanceof ArtifactConflictError) {
      reportConflict(error, target, destinationRoot);
      process.exitCode = 1;
      return;
    }

    emitPlatformError(
      format,
      target,
      "install",
      error instanceof Error ? `${target} 安装失败：${error.message}` : `${target} 安装失败。`,
    );
    process.exitCode = 1;
  }
}

export async function runPlatformStatus(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & { json?: boolean },
): Promise<void> {
  const format = resolveOutputFormat(opts.json);

  try {
    const scope = resolveScopeFromSelector(opts);
    const targetResolution = await resolveInstallTarget(target, {
      dir: opts.dir,
      cwd: process.cwd(),
      project: opts.project,
      global: opts.global,
    });
    const destinationRoot = resolve(targetResolution.root);
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, "error");
    const status = await resolvePlatformInstallStatus(plan);
    const zcVersion = getCliVersion();

    emitOutput(
      format,
      buildStatusPayload(target, destinationRoot, {
        ...status,
        zcVersion,
      }, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        zcVersion,
      }),
      summarizeStatus(target, destinationRoot, status, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        zcVersion,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "status",
      error instanceof Error ? `${target} 状态检查失败：${error.message}` : `${target} 状态检查失败。`,
    );
    process.exitCode = 1;
  }
}

export async function runPlatformUpdate(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & {
    force?: boolean;
    plan?: boolean;
    json?: boolean;
  },
): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  let destinationRoot = "";

  try {
    const scope = resolveScopeFromSelector(opts);
    const targetResolution = await resolveInstallTarget(target, {
      dir: opts.dir,
      cwd: process.cwd(),
      project: opts.project,
      global: opts.global,
    });
    const autoResolvedRoot = targetResolution.source !== "explicit";
    destinationRoot = resolve(targetResolution.root);
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const statusPlan = createInstallPlan(target, platformModule, manifest, destinationRoot, "error");
    const status = await resolvePlatformInstallStatus(statusPlan);
    const zcVersion = getCliVersion();

    if (status.kind === "not-installed") {
      emitPlatformError(
        format,
        target,
        "update",
        `${target} 尚未安装到该目录。请先运行 \`zc platform install ${target}\`。`,
        {
          root: destinationRoot,
          receiptPath: status.receiptPath,
        },
      );
      process.exitCode = 1;
      return;
    }

    if (status.kind === "up-to-date") {
      const result = {
        created: 0,
        overwritten: 0,
        unchanged: status.summary.trackedArtifacts,
        skipped: 0,
        dryRun: false,
      };

      emitOutput(
        format,
        buildResultPayload("update", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: status.receiptPath,
          zcVersion,
          contentFingerprint: status.contentFingerprint ?? null,
          status: status.kind,
          noop: true,
        }),
        summarizeResult("update", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          receiptPath: status.receiptPath,
          zcVersion,
          contentFingerprint: status.contentFingerprint ?? null,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          noop: true,
        }),
      );
      return;
    }

    if (status.kind === "drifted" && !opts.force) {
      emitPlatformError(
        format,
        target,
        "update",
        `${target} 安装目录已漂移。请先运行 \`zc platform status ${target}\` 检查差异，确认后追加 \`--force\` 再更新。`,
        {
          root: destinationRoot,
          receiptPath: status.receiptPath,
          status: status.kind,
        },
      );
      process.exitCode = 1;
      return;
    }

    const overwrite = getUpdateOverwriteMode(status, opts.force);
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, overwrite);

    if (opts.plan) {
      emitOutput(
        format,
        buildPlanPayload("update", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          status: status.kind,
        }),
        summarizePlan("update", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
        }),
      );
      return;
    }

    const result = await writeArtifacts(
      plan.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content,
      })),
      {
        dryRun: false,
        overwrite,
      },
    );
    await writePlatformInstallReceiptForPlan(plan, {
      installedAt: new Date().toISOString(),
      zcVersion,
    });

    emitOutput(
      format,
      buildResultPayload("update", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion,
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: status.kind,
      }),
      summarizeResult("update", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion,
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
      }),
    );
  } catch (error) {
    if (error instanceof ArtifactConflictError) {
      reportConflict(error, target, destinationRoot);
      process.exitCode = 1;
      return;
    }

    emitPlatformError(
      format,
      target,
      "update",
      error instanceof Error ? `${target} 更新失败：${error.message}` : `${target} 更新失败。`,
    );
    process.exitCode = 1;
  }
}

export async function runPlatformWhere(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & { json?: boolean },
): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  try {
    const scope = resolveScopeFromSelector(opts);
    const targetResolution = await resolveInstallTarget(target, {
      dir: opts.dir,
      cwd: process.cwd(),
      project: opts.project,
      global: opts.global,
    });
    const root = resolve(targetResolution.root);

    emitOutput(
      format,
      buildWherePayload(target, root, {
        scope,
        rootSource: targetResolution.source,
        marker: targetResolution.marker,
        hint: targetResolution.hint,
      }),
      summarizeWhere(target, root, {
        scope,
        rootSource: targetResolution.source,
        marker: targetResolution.marker,
        hint: targetResolution.hint,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "where",
      error instanceof Error ? `${target} 目录解析失败：${error.message}` : `${target} 目录解析失败。`,
    );
    process.exitCode = 1;
  }
}

function parsePlatformName(value: string): PlatformName {
  if (platformNames.includes(value as PlatformName)) {
    return value as PlatformName;
  }

  throw new InvalidArgumentError(`不支持的平台：${value}。可选值：${platformNames.join(" | ")}`);
}

export function registerPlatformCommand(program: Command): void {
  const platform = program.command("platform").description("平台生成和安装命令");

  platform
    .command("generate")
    .alias("g")
    .description("根据工具包清单生成平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)", parsePlatformName)
    .option("-d, --dir <dir>", "输出目录")
    .option("--plan", "只输出产物计划，不落盘")
    .option("-j, --json", "直接输出 JSON")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformGenerate);

  platform
    .command("install")
    .alias("i")
    .description("根据工具包清单生成并安装平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)", parsePlatformName)
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "安装到当前目录向上解析出的最近项目根")
    .option("-g, --global", "安装到官方文档定义的默认全局位置")
    .option("--plan", "只输出安装计划，不落盘")
    .option("-j, --json", "直接输出 JSON")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformInstall);

  platform
    .command("where")
    .alias("w")
    .description("解析平台安装目录，不执行写入")
    .argument("<target>", "目标平台 (qwen|codex|qoder)", parsePlatformName)
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "解析最近项目根")
    .option("-g, --global", "解析官方文档定义的默认全局位置")
    .option("-j, --json", "直接输出 JSON")
    .action(runPlatformWhere);

  platform
    .command("status")
    .description("读取安装回执并检查平台内容状态")
    .argument("<target>", "目标平台 (qwen|codex|qoder)", parsePlatformName)
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "解析最近项目根")
    .option("-g, --global", "解析官方文档定义的默认全局位置")
    .option("-j, --json", "直接输出 JSON")
    .action(runPlatformStatus);

  platform
    .command("update")
    .description("基于安装回执更新平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)", parsePlatformName)
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "解析最近项目根")
    .option("-g, --global", "解析官方文档定义的默认全局位置")
    .option("--plan", "只输出更新计划，不落盘")
    .option("-j, --json", "直接输出 JSON")
    .option("-f, --force", "覆盖已漂移的已安装产物")
    .action(runPlatformUpdate);
}
