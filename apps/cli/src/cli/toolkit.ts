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
  console.log(`工具包清单 v${manifest.version}`);
  console.log(`内容根目录：${manifest.contentRoot}`);
  console.log(
    `统计：技能=${manifest.counts.skills} 命令=${manifest.counts.commands} 代理=${manifest.counts.agents} 总计=${manifest.counts.total}`
  );

  if (manifest.assets.length === 0) {
    console.log("资产：无");
    return;
  }

  console.log("资产：");
  for (const asset of manifest.assets) {
    const platforms = asset.meta.platforms?.join(", ") ?? "全部";
    console.log(`- ${asset.id} [${platforms}] ${asset.meta.title}`);
  }
}

export function registerToolkitCommand(program: Command): void {
  const toolkit = program.command("toolkit").description("工具包资产管理命令");

  toolkit
    .command("manifest")
    .description("加载并显示工具包清单")
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
    .description("验证工具包清单可成功加载")
    .action(async () => {
      const manifest = await loadManifest();
      console.log(
        `工具包清单已加载：来自 ${manifest.contentRoot} 的 ${manifest.counts.total} 个资产`
      );
    });
}
