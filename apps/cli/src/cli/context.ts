import type { Command } from "commander";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { resolveInstallTarget } from "../utils/install-target.js";
import { importWorkspaceDistModule } from "../utils/workspace.js";

type ContextArtifactAction = "create" | "update" | "unchanged" | "conflict";

interface ContextArtifactPlan {
  relativePath: string;
  content: string;
  managed: boolean;
  action: ContextArtifactAction;
}

interface ContextInitPlan {
  platform: "codex";
  root: string;
  initializedAt?: string;
  generatedAt: string;
  artifacts: readonly ContextArtifactPlan[];
  summary: {
    creates: number;
    updates: number;
    unchanged: number;
    conflicts: number;
  };
}

interface ContextExistingFile {
  relativePath: string;
  content: string | null;
}

interface ContextInitSnapshot {
  root: string;
  projectName: string;
  packageManager: string;
  scripts: Readonly<Record<string, string>>;
  directories: readonly string[];
  existingFiles: readonly ContextExistingFile[];
  initializedAt: string;
  previousGeneratedAt?: string;
  generatedAt: string;
}

interface PlatformCodexModule {
  createCodexContextInitPlan(
    snapshot: ContextInitSnapshot,
    options?: { force?: boolean },
  ): ContextInitPlan;
}

interface ContextInitOptions {
  dir?: string;
  project?: boolean;
  plan?: boolean;
  write?: boolean;
  force?: boolean;
  json?: boolean;
}

const contextRelativePaths = [
  "AGENTS.md",
  ".codex/context/project.md",
  ".codex/context/commands.md",
  ".codex/context/modules/README.md",
  ".codex/context/manifest.json",
] as const;

function normalizePathForDisplay(path: string): string {
  return path.split("\\").join("/");
}

async function loadPlatformCodexModule(): Promise<PlatformCodexModule> {
  return importWorkspaceDistModule<PlatformCodexModule>(
    "packages/platform-codex/dist/index.js"
  );
}

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function readPackageJson(root: string): Promise<Record<string, unknown> | null> {
  const raw = await readTextIfExists(join(root, "package.json"));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectPackageManager(root: string): string {
  if (existsSync(join(root, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(root, "yarn.lock"))) {
    return "yarn";
  }
  if (existsSync(join(root, "package-lock.json"))) {
    return "npm";
  }
  return "unknown";
}

function collectExistingDirs(root: string, candidates: readonly string[]): string[] {
  return candidates.filter((candidate) => existsSync(join(root, candidate)));
}

function getPackageScripts(packageJson: Record<string, unknown> | null): Record<string, string> {
  const scripts = packageJson?.scripts;
  if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(scripts as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, value as string])
  );
}

function getExistingContextTimestamps(existingManifest: string | null): {
  initializedAt?: string;
  generatedAt?: string;
} {
  if (!existingManifest) {
    return {};
  }

  try {
    const manifest = JSON.parse(existingManifest) as {
      initializedAt?: unknown;
      generatedAt?: unknown;
    };

    return {
      initializedAt: typeof manifest.initializedAt === "string" ? manifest.initializedAt : undefined,
      generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : undefined,
    };
  } catch {
    return {};
  }
}

async function resolveContextRoot(opts: ContextInitOptions): Promise<string> {
  const target = await resolveInstallTarget("codex", {
    dir: opts.dir,
    cwd: process.cwd(),
    project: opts.dir ? undefined : opts.project ?? true,
  });
  return target.root;
}

async function createContextSnapshot(root: string): Promise<ContextInitSnapshot> {
  const packageJson = await readPackageJson(root);
  const existingFiles = await Promise.all(
    contextRelativePaths.map(async (relativePath) => ({
      relativePath,
      content: await readTextIfExists(join(root, relativePath)),
    }))
  );
  const existingManifest = existingFiles.find((file) => file.relativePath === ".codex/context/manifest.json")?.content ?? null;
  const timestamps = getExistingContextTimestamps(existingManifest);
  const generatedAt = new Date().toISOString();
  const initializedAt = timestamps.initializedAt ?? timestamps.generatedAt ?? generatedAt;

  return {
    root,
    projectName: typeof packageJson?.name === "string" ? packageJson.name : root.split(/[\\/]/u).at(-1) ?? "project",
    packageManager: detectPackageManager(root),
    scripts: getPackageScripts(packageJson),
    directories: collectExistingDirs(root, [
      "apps",
      "packages",
      "src",
      "docs",
      "references",
    ]),
    existingFiles,
    initializedAt,
    previousGeneratedAt: timestamps.generatedAt,
    generatedAt,
  };
}

async function createContextInitPlan(opts: ContextInitOptions): Promise<ContextInitPlan> {
  const root = await resolveContextRoot(opts);
  const snapshot = await createContextSnapshot(root);
  const platformCodex = await loadPlatformCodexModule();
  return platformCodex.createCodexContextInitPlan(snapshot, { force: opts.force });
}

async function writeContextInitPlan(plan: ContextInitPlan): Promise<void> {
  for (const artifact of plan.artifacts) {
    if (artifact.action === "unchanged" || artifact.action === "conflict") {
      continue;
    }

    const path = join(plan.root, artifact.relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, artifact.content, "utf8");
  }
}

function printContextInitPlan(plan: ContextInitPlan, dryRun: boolean): void {
  console.log(`项目上下文初始化${dryRun ? "计划" : "结果"}：${normalizePathForDisplay(plan.root)}`);
  console.log(`- create: ${plan.summary.creates}`);
  console.log(`- update: ${plan.summary.updates}`);
  console.log(`- unchanged: ${plan.summary.unchanged}`);
  console.log(`- conflict: ${plan.summary.conflicts}`);
  console.log("");
  console.log("产物：");
  for (const artifact of plan.artifacts) {
    console.log(`- [${artifact.action}] ${artifact.relativePath}`);
  }
  if (dryRun) {
    console.log("");
    console.log("默认只做 dry-run；确认后使用 `zc context init --write` 写入。");
  }
}

export function registerContextCommand(program: Command): void {
  const context = program
    .command("context")
    .description("项目上下文管理命令");

  context
    .command("init")
    .description("初始化 Codex 项目上下文索引，默认只输出计划")
    .option("-d, --dir <path>", "项目根目录；不传时向上解析最近项目根")
    .option("-p, --project", "从当前目录向上解析最近项目根（默认）")
    .option("--plan", "只输出计划（默认）")
    .option("--write", "写入 AGENTS.md managed block 和 .codex/context 文件")
    .option("--force", "允许覆盖 .codex/context 下未带 managed marker 的已有文件")
    .option("-j, --json", "输出 JSON")
    .action(async (opts: ContextInitOptions) => {
      if (opts.plan && opts.write) {
        console.error("`--plan` 与 `--write` 不能同时使用。");
        process.exitCode = 1;
        return;
      }
      if (opts.dir && opts.project) {
        console.error("显式目录 `--dir` 不能与 `--project` 同时使用。");
        process.exitCode = 1;
        return;
      }

      const dryRun = !opts.write;
      const plan = await createContextInitPlan(opts);

      if (!dryRun && plan.summary.conflicts === 0) {
        await writeContextInitPlan(plan);
      }

      if (opts.json) {
        console.log(JSON.stringify({ ...plan, dryRun }, null, 2));
      } else {
        printContextInitPlan(plan, dryRun);
      }

      if (plan.summary.conflicts > 0) {
        console.error("存在未受管的上下文文件冲突；使用 --force 覆盖，或先手动处理。");
        process.exitCode = 1;
      }
    });
}
