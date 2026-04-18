import type { Command } from "commander";
import { join, resolve } from "node:path";
import type { OverwriteMode } from "@zmice/platform-core";
import {
  ArtifactConflictError,
  importWorkspaceDistModule,
  resolveWorkspacePath,
  writeArtifacts,
} from "../utils/workspace.js";

type PlatformName = "qwen" | "codex" | "qoder";

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

function summarizeResult(action: "generate" | "install", target: PlatformName, root: string, result: {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}): string {
  const mode = result.dryRun ? "预演完成" : "完成";
  return [
    `${target} ${action === "generate" ? "生成" : "安装"}${mode}：${root}`,
    `新增 ${result.created}，覆盖 ${result.overwritten}，未变更 ${result.unchanged}${
      result.dryRun ? `，跳过写入 ${result.skipped}` : ""
    }`
  ].join("\n");
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
  opts: { out?: string; dryRun?: boolean; force?: boolean }
): Promise<void> {
  const outputRoot = opts.out ? resolve(opts.out) : resolveWorkspacePath(`.generated/${target}`);
  const manifest = await loadToolkitManifest();
  const platformModule = await loadPlatformModule(target);
  const plan = createGenerationPlan(target, platformModule, manifest);
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

  console.log(summarizeResult("generate", target, outputRoot, result));
}

export async function runPlatformInstall(
  target: PlatformName,
  opts: { out: string; dryRun?: boolean; force?: boolean }
): Promise<void> {
  const destinationRoot = resolve(opts.out);
  const overwrite = resolveOverwriteMode(opts.force);
  const manifest = await loadToolkitManifest();
  const platformModule = await loadPlatformModule(target);
  const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, overwrite);

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

    console.log(summarizeResult("install", target, destinationRoot, result));
  } catch (error) {
    if (error instanceof ArtifactConflictError) {
      reportConflict(error, target, destinationRoot);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

export function registerPlatformCommand(program: Command): void {
  const platform = program.command("platform").description("平台生成和安装命令");

  platform
    .command("generate")
    .description("根据工具包清单生成平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .option("-o, --out <dir>", "输出目录")
    .option("--dry-run", "仅预览将要生成的产物，不落盘")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformGenerate);

  platform
    .command("install")
    .description("根据工具包清单生成并安装平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .requiredOption("-o, --out <dir>", "安装目标目录")
    .option("--dry-run", "仅预览将要安装的产物，不落盘")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformInstall);
}
