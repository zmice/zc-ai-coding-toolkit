import type { Command } from "commander";
import { join, resolve } from "node:path";
import type { OverwriteMode } from "@zmice/platform-core";
import { normalizeInstallSelector, resolveInstallTarget } from "../utils/install-target.js";
import {
  ArtifactConflictError,
  importWorkspaceDistModule,
  resolveWorkspacePath,
  writeArtifacts,
} from "../utils/workspace.js";

type PlatformName = "qwen" | "codex" | "qoder";
type PlatformOutputFormat = "text" | "json";
type PlatformInstallScope = "project" | "global";
type PlatformTargetSelectorOpts = {
  dir?: string;
  out?: string;
  project?: boolean;
  global?: boolean;
  scope?: PlatformInstallScope;
};

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

interface PlatformPlanLike {
  artifacts: readonly {
    path: string;
    content: string;
  }[];
  overwrite?: OverwriteMode;
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
}

interface PlatformModule {
  createCodexGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createCodexInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => PlatformPlanLike;
  createQoderGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createQoderInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => PlatformPlanLike;
  createQwenGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createQwenInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; overwrite?: OverwriteMode }
  ) => PlatformPlanLike;
}

const defaultPlatforms: readonly PlatformName[] = ["qwen", "codex", "qoder"];

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
): PlatformPlanLike {
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenGenerationPlan) {
        throw new Error("Qwen 平台包未导出 createQwenGenerationPlan()");
      }
      return platformModule.createQwenGenerationPlan(manifest, { manifestSource: manifest.source });
    case "codex":
      if (!platformModule.createCodexGenerationPlan) {
        throw new Error("Codex 平台包未导出 createCodexGenerationPlan()");
      }
      return platformModule.createCodexGenerationPlan(manifest, { manifestSource: manifest.source });
    case "qoder":
      if (!platformModule.createQoderGenerationPlan) {
        throw new Error("Qoder 平台包未导出 createQoderGenerationPlan()");
      }
      return platformModule.createQoderGenerationPlan(manifest, { manifestSource: manifest.source });
  }
}

function createInstallPlan(
  platform: PlatformName,
  platformModule: PlatformModule,
  manifest: PlatformManifestLike,
  destinationRoot: string,
  overwrite: OverwriteMode
): PlatformPlanLike {
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenInstallPlan) {
        throw new Error("Qwen 平台包未导出 createQwenInstallPlan()");
      }
      return platformModule.createQwenInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      });
    case "codex":
      if (!platformModule.createCodexInstallPlan) {
        throw new Error("Codex 平台包未导出 createCodexInstallPlan()");
      }
      return platformModule.createCodexInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      });
    case "qoder":
      if (!platformModule.createQoderInstallPlan) {
        throw new Error("Qoder 平台包未导出 createQoderInstallPlan()");
      }
      return platformModule.createQoderInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        overwrite
      });
  }
}

function resolveOverwriteMode(force: boolean | undefined): OverwriteMode {
  return force ? "force" : "error";
}

function resolveOutputFormat(format: string | undefined): PlatformOutputFormat {
  return format === "json" ? "json" : "text";
}

function resolveOutputFormatFromFlags(format: string | undefined, json?: boolean): PlatformOutputFormat {
  if (json) {
    return "json";
  }
  return resolveOutputFormat(format);
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

function summarizeResult(action: "generate" | "install", target: PlatformName, root: string, result: {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}, metadata?: { autoResolvedRoot?: boolean; rootSource?: string; hint?: string }): string {
  const mode = result.dryRun ? "预演完成" : "完成";
  const rootLabel =
    action === "install" && metadata?.autoResolvedRoot
      ? `安装目录自动解析（${metadata.rootSource ?? "project-root"}）：${root}`
      : `${action === "generate" ? "生成目录" : "安装目录"}：${root}`;
  return [
    `${target} ${action === "generate" ? "生成" : "安装"}${mode}`,
    rootLabel,
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    `新增 ${result.created}，覆盖 ${result.overwritten}，未变更 ${result.unchanged}${result.dryRun ? `，跳过写入 ${result.skipped}` : ""}`,
  ].join("\n");
}

function summarizePlan(action: "generate" | "install", target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: {
  autoResolvedRoot?: boolean;
  rootSource?: string;
  hint?: string;
}): string {
  const rootLabel =
    action === "install" && metadata?.autoResolvedRoot
      ? `安装目录自动解析（${metadata.rootSource ?? "project-root"}）：${root}`
      : `${action === "generate" ? "生成目录" : "安装目录"}：${root}`;

  return [
    `${target} ${action === "generate" ? "生成" : "安装"}计划`,
    rootLabel,
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    `产物数量：${plan.artifacts.length}`,
    ...plan.artifacts.map((artifact) => `- ${artifact.path}`),
  ].join("\n");
}

function buildPlanPayload(action: "generate" | "install", target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: {
  autoResolvedRoot?: boolean;
  rootSource?: string;
  hint?: string;
  scope?: PlatformInstallScope;
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
    artifactCount: plan.artifacts.length,
    overwrite: plan.overwrite ?? "error",
    artifacts: plan.artifacts,
  };
}

function buildResultPayload(action: "generate" | "install", target: PlatformName, root: string, result: {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}, metadata?: {
  autoResolvedRoot?: boolean;
  rootSource?: string;
  hint?: string;
  scope?: PlatformInstallScope;
}) {
  return {
    mode: "result",
    action,
    target,
    root,
    scope: metadata?.scope ?? "project",
    rootSource: metadata?.rootSource ?? (metadata?.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: metadata?.autoResolvedRoot ?? false,
    hint: metadata?.hint ?? null,
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
    `范围：${metadata.scope === "global" ? "global" : "project"}`,
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

export async function runPlatformGenerate(
  target: PlatformName,
  opts: { dir?: string; out?: string; dryRun?: boolean; force?: boolean; plan?: boolean; format?: string; json?: boolean }
): Promise<void> {
  const outputRoot = opts.dir ? resolve(opts.dir) : opts.out ? resolve(opts.out) : resolveWorkspacePath(`.generated/${target}`);
  const format = resolveOutputFormatFromFlags(opts.format, opts.json);
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
      dryRun: opts.dryRun ?? false,
      overwrite: resolveOverwriteMode(opts.force)
    }
  );

  emitOutput(format, buildResultPayload("generate", target, outputRoot, result), summarizeResult("generate", target, outputRoot, result));
}

export async function runPlatformInstall(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & {
    dryRun?: boolean;
    force?: boolean;
    plan?: boolean;
    format?: string;
    json?: boolean;
  }
): Promise<void> {
  const scope = resolveScopeFromSelector(opts);
  const targetResolution = await resolveInstallTarget(target, {
    dir: opts.dir,
    out: opts.out,
    cwd: process.cwd(),
    project: opts.project,
    global: opts.global,
    scope: opts.scope,
  });
  const autoResolvedRoot = targetResolution.source !== "explicit";
  const destinationRoot = resolve(targetResolution.root);
  const overwrite = resolveOverwriteMode(opts.force);
  const format = resolveOutputFormatFromFlags(opts.format, opts.json);
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

  try {
    const result = await writeArtifacts(
      plan.artifacts.map((artifact) => ({
        path: artifact.path,
        content: artifact.content
      })),
      {
        dryRun: opts.dryRun ?? false,
        overwrite
      }
    );

    emitOutput(
      format,
      buildResultPayload("install", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
      }),
      summarizeResult("install", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
      })
    );
  } catch (error) {
    if (error instanceof ArtifactConflictError) {
      reportConflict(error, target, destinationRoot);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

export async function runPlatformWhere(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & { format?: string; json?: boolean },
): Promise<void> {
  const scope = resolveScopeFromSelector(opts);
  const targetResolution = await resolveInstallTarget(target, {
    dir: opts.dir,
    out: opts.out,
    cwd: process.cwd(),
    project: opts.project,
    global: opts.global,
    scope: opts.scope,
  });
  const format = resolveOutputFormatFromFlags(opts.format, opts.json);
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
}

export function registerPlatformCommand(program: Command): void {
  const platform = program.command("platform").description("平台生成和安装命令");

  platform
    .command("generate")
    .alias("g")
    .description("根据工具包清单生成平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .option("-d, --dir <dir>", "输出目录")
    .option("-o, --out <dir>", "兼容旧参数：输出目录")
    .option("--plan", "只输出产物计划，不落盘")
    .option("--format <format>", "输出格式：text | json", "text")
    .option("-j, --json", "直接输出 JSON")
    .option("--dry-run", "仅预览将要生成的产物，不落盘")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformGenerate);

  platform
    .command("install")
    .alias("i")
    .description("根据工具包清单生成并安装平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "安装到当前目录向上解析出的最近项目根")
    .option("-g, --global", "安装到官方文档定义的默认全局位置")
    .option("-o, --out <dir>", "兼容旧参数：显式安装目录")
    .option("--scope <scope>", "兼容旧参数：project | global")
    .option("--plan", "只输出安装计划，不落盘")
    .option("--format <format>", "输出格式：text | json", "text")
    .option("-j, --json", "直接输出 JSON")
    .option("--dry-run", "仅预览将要安装的产物，不落盘")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformInstall);

  platform
    .command("where")
    .alias("w")
    .description("解析平台安装目录，不执行写入")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .option("-d, --dir <dir>", "显式安装目录")
    .option("-p, --project", "解析最近项目根")
    .option("-g, --global", "解析官方文档定义的默认全局位置")
    .option("-o, --out <dir>", "兼容旧参数：显式安装目录")
    .option("--scope <scope>", "兼容旧参数：project | global")
    .option("--format <format>", "输出格式：text | json", "text")
    .option("-j, --json", "直接输出 JSON")
    .action(runPlatformWhere);
}
