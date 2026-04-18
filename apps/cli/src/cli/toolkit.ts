import type { Command } from "commander";
import { importWorkspaceDistModule } from "../utils/workspace.js";

interface ToolkitAssetMetaLike {
  kind: string;
  title: string;
  description: string;
  platforms?: readonly string[];
}

interface ToolkitAssetLike {
  id: string;
  meta: ToolkitAssetMetaLike;
}

interface ToolkitManifestLike {
  version: number;
  contentRoot: string;
  counts: {
    skills: number;
    commands: number;
    agents: number;
    total: number;
  };
  assets: readonly ToolkitAssetLike[];
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
}

async function loadManifest(): Promise<ToolkitManifestLike> {
  const toolkit = await importWorkspaceDistModule<ToolkitModule>(
    "packages/toolkit/dist/index.js"
  );
  return toolkit.loadToolkitManifest();
}

function printManifestSummary(manifest: ToolkitManifestLike): void {
  console.log(`Toolkit manifest v${manifest.version}`);
  console.log(`Content root: ${manifest.contentRoot}`);
  console.log(
    `Counts: skills=${manifest.counts.skills} commands=${manifest.counts.commands} agents=${manifest.counts.agents} total=${manifest.counts.total}`
  );

  if (manifest.assets.length === 0) {
    console.log("Assets: none");
    return;
  }

  console.log("Assets:");
  for (const asset of manifest.assets) {
    const platforms = asset.meta.platforms?.join(", ") ?? "all";
    console.log(`- ${asset.id} [${platforms}] ${asset.meta.title}`);
  }
}

export function registerToolkitCommand(program: Command): void {
  const toolkit = program.command("toolkit").description("Toolkit 资产管理命令");

  toolkit
    .command("manifest")
    .description("加载并显示 toolkit manifest")
    .option("--json", "输出完整 JSON")
    .action(async (opts: { json?: boolean }) => {
      const manifest = await loadManifest();

      if (opts.json) {
        console.log(JSON.stringify(manifest, null, 2));
        return;
      }

      printManifestSummary(manifest);
    });

  toolkit
    .command("validate")
    .description("验证 toolkit manifest 可成功加载")
    .action(async () => {
      const manifest = await loadManifest();
      console.log(
        `Toolkit manifest loaded: ${manifest.counts.total} asset(s) from ${manifest.contentRoot}`
      );
    });
}
