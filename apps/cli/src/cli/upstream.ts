import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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
}

function getUpstreamsFile(): string {
  return resolveWorkspacePath("references/upstreams.yaml");
}

function parseUpstreamBlocks(source: string): UpstreamRecord[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const upstreams: UpstreamRecord[] = [];
  let current: UpstreamRecord | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("  - id:")) {
      if (current) {
        upstreams.push(current);
      }
      current = { id: line.slice("  - id:".length).trim() };
      continue;
    }

    if (!current || !line.startsWith("    ")) {
      continue;
    }

    const trimmed = line.trim();
    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    switch (key) {
      case "title":
        current.title = value;
        break;
      case "kind":
        current.kind = value;
        break;
      case "status":
        current.status = value;
        break;
      case "owner":
        current.owner = value;
        break;
      case "notes_path":
        current.notesPath = value;
        break;
      case "snapshots_path":
        current.snapshotsPath = value;
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
      const item = upstreams.find((entry) => entry.id === id);

      if (!item) {
        console.error(`未找到上游记录：${id}`);
        process.exitCode = 1;
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
}
