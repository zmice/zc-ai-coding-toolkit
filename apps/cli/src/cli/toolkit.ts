import type { Command } from "commander";
import { importWorkspaceDistModule } from "../utils/workspace.js";

interface ToolkitAssetMetaLike {
  kind: string;
  name: string;
  title: string;
  description: string;
  platforms?: readonly string[];
  tier?: string;
  audience?: string;
  stability?: string;
  aliases?: readonly string[];
  requires?: readonly string[];
  suggests?: readonly string[];
  conflictsWith?: readonly string[];
  supersedes?: readonly string[];
  source?: {
    upstream: string;
    strategy: string;
    notes?: string;
  };
}

interface ToolkitAssetLike {
  id: string;
  meta: ToolkitAssetMetaLike;
  body: string;
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
  byId: Record<string, ToolkitAssetLike>;
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
  resolveToolkitAssetQuery(manifest: ToolkitManifestLike, query: string): ToolkitAssetLike | undefined;
  searchToolkitAssets(manifest: ToolkitManifestLike, keyword: string): readonly ToolkitAssetLike[];
  recommendToolkitAssets(
    manifest: ToolkitManifestLike,
    query: string
  ): {
    target: ToolkitAssetLike;
    required: readonly ToolkitAssetLike[];
    suggested: readonly ToolkitAssetLike[];
  } | undefined;
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

async function loadToolkitModule(): Promise<ToolkitModule> {
  return importWorkspaceDistModule<ToolkitModule>(
    "packages/toolkit/dist/index.js"
  );
}

async function loadManifest(): Promise<ToolkitManifestLike> {
  const toolkit = await loadToolkitModule();
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

function printAssetDetails(asset: ToolkitAssetLike): void {
  console.log(`ID：${asset.id}`);
  console.log(`名称：${asset.meta.name}`);
  console.log(`类型：${asset.meta.kind}`);
  console.log(`标题：${asset.meta.title}`);
  console.log(`描述：${asset.meta.description}`);
  console.log(`平台：${asset.meta.platforms?.join(", ") ?? "全部"}`);
  console.log(`层级：${asset.meta.tier ?? "-"}`);
  console.log(`受众：${asset.meta.audience ?? "-"}`);
  console.log(`稳定性：${asset.meta.stability ?? "-"}`);
  console.log(`别名：${asset.meta.aliases?.join(", ") ?? "-"}`);
  console.log(`依赖：${asset.meta.requires?.join(", ") ?? "-"}`);
  console.log(`建议：${asset.meta.suggests?.join(", ") ?? "-"}`);
  console.log(`冲突：${asset.meta.conflictsWith?.join(", ") ?? "-"}`);
  console.log(`替代：${asset.meta.supersedes?.join(", ") ?? "-"}`);
  console.log(
    `来源：${asset.meta.source ? `${asset.meta.source.upstream} (${asset.meta.source.strategy})` : "-"}`
  );
}

function printAssetList(title: string, assets: readonly ToolkitAssetLike[]): void {
  console.log(title);
  if (assets.length === 0) {
    console.log("- 无");
    return;
  }

  for (const asset of assets) {
    console.log(`- ${asset.id} [${asset.meta.kind}] ${asset.meta.title}`);
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
      const toolkitModule = await loadToolkitModule();
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

  toolkit
    .command("show")
    .description("显示单个 toolkit 资产的详细信息")
    .argument("<id>", "资产 ID 或唯一名称")
    .option("--json", "输出完整 JSON")
    .action(async (query: string, opts: { json?: boolean }) => {
      const toolkitModule = await loadToolkitModule();
      const manifest = await toolkitModule.loadToolkitManifest();
      const asset = toolkitModule.resolveToolkitAssetQuery(manifest, query);

      if (!asset) {
        console.error(`未找到 toolkit 资产：${query}`);
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(asset, null, 2));
        return;
      }

      printAssetDetails(asset);
    });

  toolkit
    .command("search")
    .description("按关键字搜索 toolkit 资产")
    .argument("<keyword>", "搜索关键字")
    .option("--json", "输出完整 JSON")
    .action(async (keyword: string, opts: { json?: boolean }) => {
      const toolkitModule = await loadToolkitModule();
      const manifest = await toolkitModule.loadToolkitManifest();
      const matches = toolkitModule.searchToolkitAssets(manifest, keyword);

      if (opts.json) {
        console.log(JSON.stringify(matches, null, 2));
        return;
      }

      printAssetList(`搜索结果：${keyword}`, matches);
    });

  toolkit
    .command("recommend")
    .description("根据已建关系图推荐关联资产")
    .argument("<id>", "资产 ID 或唯一名称")
    .option("--json", "输出完整 JSON")
    .action(async (query: string, opts: { json?: boolean }) => {
      const toolkitModule = await loadToolkitModule();
      const manifest = await toolkitModule.loadToolkitManifest();
      const recommendation = toolkitModule.recommendToolkitAssets(manifest, query);

      if (!recommendation) {
        console.error(`未找到 toolkit 资产：${query}`);
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(recommendation, null, 2));
        return;
      }

      console.log(`推荐目标：${recommendation.target.id}`);
      console.log(`- 标题：${recommendation.target.meta.title}`);
      printAssetList("必需资产：", recommendation.required);
      printAssetList("建议资产：", recommendation.suggested);
    });
}
