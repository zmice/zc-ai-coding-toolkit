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
  lintToolkitManifest(manifest: ToolkitManifestLike): {
    summary: {
      assets: number;
      warnings: number;
      errors: number;
    };
    issues: Array<{
      level: "warning" | "error";
      assetId: string;
      rule: string;
      message: string;
    }>;
  };
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

  toolkit
    .command("lint")
    .description("检查 toolkit 内容治理元数据，输出 warning/error 视图")
    .option("--json", "输出完整 JSON")
    .option("--strict", "只要存在 warning/error 就以非零退出")
    .action(async (opts: { json?: boolean; strict?: boolean }) => {
      const toolkitModule = await importWorkspaceDistModule<ToolkitModule>(
        "packages/toolkit/dist/index.js"
      );
      const manifest = await toolkitModule.loadToolkitManifest();
      const result = toolkitModule.lintToolkitManifest(manifest);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("toolkit lint");
        console.log(`- assets: ${result.summary.assets}`);
        console.log(`- warnings: ${result.summary.warnings}`);
        console.log(`- errors: ${result.summary.errors}`);

        for (const issue of result.issues.slice(0, 20)) {
          console.log(`- [${issue.level}] ${issue.assetId} (${issue.rule}) ${issue.message}`);
        }

        if (result.issues.length > 20) {
          console.log(`- ... 其余 ${result.issues.length - 20} 条已省略`);
        }
      }

      if (opts.strict && result.issues.length > 0) {
        console.error("toolkit lint 在严格模式下失败：存在待治理的 warning/error。");
        process.exitCode = 1;
      }
    });
}
