import type { Command } from "commander";
import { join, resolve } from "node:path";
import { importWorkspaceDistModule, resolveWorkspacePath, writeArtifacts } from "../utils/workspace.js";

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
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
}

interface PlatformModule {
  createCodexGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createCodexInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string }
  ) => PlatformPlanLike;
  createQoderGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createQoderInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string }
  ) => PlatformPlanLike;
  createQwenGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string }) => PlatformPlanLike;
  createQwenInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string }
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
  destinationRoot: string
): PlatformPlanLike {
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenInstallPlan) {
        throw new Error("Qwen 平台包未导出 createQwenInstallPlan()");
      }
      return platformModule.createQwenInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot
      });
    case "codex":
      if (!platformModule.createCodexInstallPlan) {
        throw new Error("Codex 平台包未导出 createCodexInstallPlan()");
      }
      return platformModule.createCodexInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot
      });
    case "qoder":
      if (!platformModule.createQoderInstallPlan) {
        throw new Error("Qoder 平台包未导出 createQoderInstallPlan()");
      }
      return platformModule.createQoderInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot
      });
  }
}

export function registerPlatformCommand(program: Command): void {
  const platform = program.command("platform").description("平台生成和安装命令");

  platform
    .command("generate")
    .description("根据工具包清单生成平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .option("-o, --out <dir>", "输出目录")
    .action(async (target: PlatformName, opts: { out?: string }) => {
      const outputRoot = opts.out ? resolve(opts.out) : resolveWorkspacePath(`.generated/${target}`);
      const manifest = await loadToolkitManifest();
      const platformModule = await loadPlatformModule(target);
      const plan = createGenerationPlan(target, platformModule, manifest);
      await writeArtifacts(
        plan.artifacts.map((artifact) => ({
          path: join(outputRoot, artifact.path),
          content: artifact.content
        }))
      );

      console.log(`已为 ${target} 在 ${outputRoot} 生成 ${plan.artifacts.length} 个产物`);
    });

  platform
    .command("install")
    .description("根据工具包清单生成并安装平台产物")
    .argument("<target>", "目标平台 (qwen|codex|qoder)")
    .requiredOption("-o, --out <dir>", "安装目标目录")
    .action(async (target: PlatformName, opts: { out: string }) => {
      const destinationRoot = resolve(opts.out);
      const manifest = await loadToolkitManifest();
      const platformModule = await loadPlatformModule(target);
      const plan = createInstallPlan(target, platformModule, manifest, destinationRoot);

      await writeArtifacts(
        plan.artifacts.map((artifact) => ({
          path: artifact.path,
          content: artifact.content
        }))
      );

      console.log(`已将 ${target} 的 ${plan.artifacts.length} 个产物安装到 ${destinationRoot}`);
    });
}
