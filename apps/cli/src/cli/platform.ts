import { Command, InvalidArgumentError } from "commander";
import type { Dirent } from "node:fs";
import { readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import {
  attachPlanMetadata,
  type GenerationPlan,
  type InstallPlan,
  type InstallScope,
  type OverwriteMode,
  type ToolkitCodexAgentConfigLike as CodexAgentConfigLike
} from "@zmice/platform-core";
import { resolvePlatformInstallDoctor } from "../platform-state/doctor.js";
import { resolvePlatformInstallStatus } from "../platform-state/status.js";
import {
  createCodexAgentsReceipt,
  deleteCodexAgentsReceipt,
  getCodexAgentsReceiptOwnedPaths,
  readCodexAgentsReceipt,
  resolveCodexAgentsReceiptPath,
  writeCodexAgentsReceipt,
  type CodexAgentsReceipt,
} from "../platform-state/codex-agents-receipt.js";
import type {
  PlatformInstallDoctorResult,
  PlatformInstallStatusResult,
} from "../platform-state/types.js";
import { normalizeInstallSelector, resolveInstallTarget } from "../utils/install-target.js";
import { spawnCommand } from "../utils/cross-platform-spawn.js";
import {
  deletePlatformInstallReceipt,
  resolvePlatformInstallReceiptPath,
  writePlatformInstallReceiptForPlan,
} from "../utils/platform-install-receipt.js";
import { pathExists, removeManagedPaths } from "../utils/platform-install-cleanup.js";
import {
  backupCodexLegacyDirectPlugin,
  detachCodexLegacyDirectPlugin,
  isCodexLegacyDirectPluginPath,
  restoreCodexLegacyDirectPlugin,
} from "../utils/codex-legacy-plugin.js";
import {
  ArtifactConflictError,
  type GeneratedArtifact,
  type WriteArtifactsResult,
  importWorkspaceDistModule,
  resolveWorkspacePath,
  writeArtifacts,
} from "../utils/workspace.js";
import {
  isCodexAgentConfigContent,
  listZcAgentConfigNames,
  mergeCodexAgentConfig,
  mergeOwnedCodexAgentConfig,
} from "../utils/codex-config-merge.js";
import {
  inspectReceiptManagedCodexAgents,
  stripCodexAgentConfigFile,
} from "../utils/codex-agents-lifecycle.js";
import {
  createCodexCompanionAgentInstallPlan,
  loadCodexAgentCompanion,
} from "../utils/codex-agent-companion.js";
import {
  QwenOfficialCliUnavailableError,
  installQwenExtensionFromOfficialRepoWithCli,
  installQwenExtensionWithOfficialCli,
  qwenOfficialExtensionRepoUrl,
  relinkQwenExtensionWithOfficialCli,
  resolveQwenOfficialCliReleaseBundleDir,
  syncQwenOfficialCliReleaseBundle,
  toQwenOfficialCliReleaseArtifacts,
  uninstallQwenExtensionWithOfficialCli,
  updateQwenExtensionWithOfficialCli,
} from "../utils/qwen-extension-cli.js";

type PlatformName = "qwen" | "codex" | "claude" | "opencode";
type PlatformOutputFormat = "text" | "json";
type PlatformInstallScope = "project" | "global" | "dir";
type PlatformGenerateBundleType = "release-bundle" | "codex-plugin" | "codex-marketplace";
type PlatformAction = "generate" | "install" | "update" | "repair" | "uninstall";
type PlatformTargetSelectorOpts = {
  dir?: string;
  project?: boolean;
  global?: boolean;
};
type PlatformPluginOpts = PlatformTargetSelectorOpts & {
  force?: boolean;
  plan?: boolean;
  json?: boolean;
  git?: boolean | string;
  ref?: string;
  register?: boolean;
  install?: boolean;
  upgrade?: boolean;
  status?: boolean;
  uninstall?: boolean;
  includeAgents?: boolean;
  withAgents?: boolean;
};
type PlatformAgentsOpts = PlatformTargetSelectorOpts & {
  plan?: boolean;
  json?: boolean;
  sync?: boolean;
  update?: boolean;
  status?: boolean;
  uninstall?: boolean;
  prune?: boolean;
};
type PlatformGenerateOpts = PlatformTargetSelectorOpts & {
  force?: boolean;
  plan?: boolean;
  json?: boolean;
  bundle?: PlatformGenerateBundleType;
};
const platformNames: readonly PlatformName[] = ["qwen", "codex", "claude", "opencode"];
const codexPluginManifestPath = ".codex-plugin/plugin.json";
const codexMarketplacePluginName = "zc-toolkit";
const codexMarketplaceDefaultGitSource = "zmice/zc-codex-marketplace";

interface ToolkitAssetMetaLike {
  kind: "skill" | "command" | "agent";
  name: string;
  title: string;
  description: string;
  tier?: string;
  audience?: string;
  stability?: string;
  tools?: readonly string[];
  platforms?: readonly PlatformName[];
  requires?: readonly string[];
  workflowFamily?: string;
  workflowRole?: string;
  routingWorkflows?: readonly string[];
  taskTypes?: readonly string[];
  platformExposure?: Partial<Record<PlatformName, string>>;
  codexAgent?: CodexAgentConfigLike;
}

interface ToolkitAssetLike {
  id: string;
  body: string;
  attachments: readonly {
    relativePath: string;
    contents: string;
  }[];
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
  name?: string;
  platforms: readonly string[];
  title?: string;
  summary?: string;
  body?: string;
  attachments?: readonly {
    relativePath: string;
    contents: string;
  }[];
  tools?: readonly string[];
  requires?: readonly string[];
  tier?: string;
  audience?: string;
  stability?: string;
  workflowFamily?: string;
  workflowRole?: string;
  routingWorkflows?: readonly string[];
  taskTypes?: readonly string[];
  platformExposure?: Partial<Record<PlatformName, string>>;
  codexAgent?: CodexAgentConfigLike;
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
  installMethod?: "filesystem" | "qwen-cli";
  installSource?: "github-repo" | "local-bundle" | null;
  sourceRef?: string | null;
  bundleType?: "source-bundle" | "release-bundle" | "codex-plugin" | "codex-marketplace" | null;
  bundlePath?: string | null;
}

interface ToolkitModule {
  loadToolkitManifest(): Promise<ToolkitManifestLike>;
}

interface PlatformModule {
  createCodexGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string; extensionVersion?: string }) => GenerationPlan;
  createCodexPluginGenerationPlan?: (
    manifest: PlatformManifestLike,
    opts?: { manifestSource?: string; pluginVersion?: string; extensionVersion?: string }
  ) => GenerationPlan;
  createCodexMarketplaceGenerationPlan?: (
    manifest: PlatformManifestLike,
    opts?: { manifestSource?: string; pluginVersion?: string; extensionVersion?: string; scope?: InstallScope }
  ) => GenerationPlan;
  createCodexInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; scope?: InstallScope; overwrite?: OverwriteMode; extensionVersion?: string }
  ) => InstallPlan;
  createCodexAgentInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; scope?: InstallScope; overwrite?: OverwriteMode; extensionVersion?: string }
  ) => InstallPlan;
  createClaudeGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string; extensionVersion?: string }) => GenerationPlan;
  createClaudeInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; scope?: InstallScope; overwrite?: OverwriteMode; extensionVersion?: string }
  ) => InstallPlan;
  createOpenCodeGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string; extensionVersion?: string }) => GenerationPlan;
  createOpenCodeInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; scope?: InstallScope; overwrite?: OverwriteMode; extensionVersion?: string }
  ) => InstallPlan;
  createQwenGenerationPlan?: (manifest: PlatformManifestLike, opts?: { manifestSource?: string; extensionVersion?: string }) => GenerationPlan;
  createQwenInstallPlan?: (
    manifest: PlatformManifestLike,
    opts: { manifestSource?: string; destinationRoot: string; scope?: InstallScope; overwrite?: OverwriteMode; extensionVersion?: string }
  ) => InstallPlan;
}

function getPlanCapabilitySummary(
  plan: PlatformPlanLike,
  metadata?: Pick<PlatformResultExtra, "bundleType">,
) {
  const capability = plan.capability;

  if (!capability) {
    return null;
  }

  const exposure = (() => {
    switch (plan.platform) {
      case "codex":
        if (
          capability.surfaces.length === 1 &&
          capability.surfaces.includes("agents-dir") &&
          !capability.entryFile &&
          !capability.skills
        ) {
          return {
            style: "custom-agent",
            entryPattern: "zc_*",
            examples: [
              "zc_code_reviewer",
              "zc_context_steward",
              "zc_test_engineer",
            ],
          };
        }

        if (metadata?.bundleType === "codex-plugin" || metadata?.bundleType === "codex-marketplace") {
          return {
            style: "plugin-skill",
            entryPattern: "$zc-toolkit:<skill>",
            examples: [
              "zc:start -> $zc-toolkit:start",
              "zc:product-analysis -> $zc-toolkit:product-analysis",
              "zc:sdd-tdd -> $zc-toolkit:sdd-tdd",
            ],
          };
        }

        return {
          style: "skill-alias",
          entryPattern: "$zc-*",
          examples: [
            "zc:start -> $zc-start",
            "zc:product-analysis -> $zc-product-analysis",
            "zc:sdd-tdd -> $zc-sdd-tdd",
          ],
        };
      case "claude":
        return {
          style: "slash-command",
          entryPattern: "/zc-*",
          examples: [
            "zc:start -> /zc-start",
            "zc:product-analysis -> /zc-product-analysis",
            "zc:sdd-tdd -> /zc-sdd-tdd",
          ],
        };
      case "opencode":
        return {
          style: "slash-command",
          entryPattern: "/zc-*",
          examples: [
            "zc:start -> /zc-start",
            "zc:product-analysis -> /zc-product-analysis",
            "zc:sdd-tdd -> /zc-sdd-tdd",
          ],
        };
      case "qwen":
        return {
          style: "namespaced-command",
          entryPattern: "zc:*",
          examples: [
            "zc:start -> zc:start",
            "zc:product-analysis -> zc:product-analysis",
            "zc:sdd-tdd -> zc:sdd-tdd",
          ],
        };
    }
  })();

  return {
    namespace: capability.namespace,
    surfaces: capability.surfaces,
    entryFile: capability.entryFile?.fileName ?? null,
    commandsDir: capability.commands?.relativeDir ?? null,
    skillsDir: capability.skills?.relativeDir ?? null,
    agentsDir: capability.agents?.relativeDir ?? null,
    extensionDir: capability.extension
      ? `${capability.extension.relativeDir}/${capability.extension.name}`
      : null,
    exposure,
  };
}

function formatSurfaceLabel(surface: string): string {
  switch (surface) {
    case "entry-file":
      return "入口文件";
    case "skills-dir":
      return "skills 目录";
    case "commands-dir":
      return "commands 目录";
    case "agents-dir":
      return "agents 目录";
    case "extension-dir":
      return "extension 目录";
    case "plugin-dir":
      return "plugin 目录";
    default:
      return surface;
  }
}

function summarizeCapability(
  plan: PlatformPlanLike,
  metadata?: Pick<PlatformResultExtra, "bundleType">,
): string[] {
  const capability = getPlanCapabilitySummary(plan, metadata);

  if (!capability) {
    return [];
  }

  return [
    `命名空间：${capability.namespace}`,
    `入口形式：${capability.exposure.entryPattern}`,
    `安装面：${capability.surfaces.map((surface) => formatSurfaceLabel(surface)).join("、")}`,
    ...(capability.entryFile ? [`入口文件：${capability.entryFile}`] : []),
    ...(capability.commandsDir ? [`commands 目录：${capability.commandsDir}`] : []),
    ...(capability.skillsDir ? [`skills 目录：${capability.skillsDir}`] : []),
    ...(capability.agentsDir ? [`agents 目录：${capability.agentsDir}`] : []),
    ...(capability.extensionDir ? [`extension 目录：${capability.extensionDir}`] : []),
    `示例映射：${capability.exposure.examples.join("；")}`,
  ];
}

const defaultPlatforms: readonly PlatformName[] = ["qwen", "codex", "claude", "opencode"];

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
      name: asset.meta.name,
      platforms: asset.meta.platforms ?? defaultPlatforms,
      title: asset.meta.title,
      summary: asset.meta.description,
      body: asset.body,
      attachments: asset.attachments,
      tools: asset.meta.tools,
      requires: asset.meta.requires,
      tier: asset.meta.tier,
      audience: asset.meta.audience,
      stability: asset.meta.stability,
      workflowFamily: asset.meta.workflowFamily,
      workflowRole: asset.meta.workflowRole,
      routingWorkflows: asset.meta.routingWorkflows,
      taskTypes: asset.meta.taskTypes,
      platformExposure: asset.meta.platformExposure,
      codexAgent: asset.meta.codexAgent
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
    claude: "packages/platform-claude/dist/index.js",
    opencode: "packages/platform-opencode/dist/index.js"
  };

  return importWorkspaceDistModule<PlatformModule>(packageMap[platform]);
}

function createGenerationPlan(
  platform: PlatformName,
  platformModule: PlatformModule,
  manifest: PlatformManifestLike
): GenerationPlan {
  const extensionVersion = getCliVersion();

  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenGenerationPlan) {
        throw new Error("Qwen 平台包未导出 createQwenGenerationPlan()");
      }
      return finalizePlan(platformModule.createQwenGenerationPlan(manifest, { manifestSource: manifest.source, extensionVersion }));
    case "codex":
      if (!platformModule.createCodexGenerationPlan) {
        throw new Error("Codex 平台包未导出 createCodexGenerationPlan()");
      }
      return finalizePlan(platformModule.createCodexGenerationPlan(manifest, { manifestSource: manifest.source, extensionVersion }));
    case "claude":
      if (!platformModule.createClaudeGenerationPlan) {
        throw new Error("Claude 平台包未导出 createClaudeGenerationPlan()");
      }
      return finalizePlan(platformModule.createClaudeGenerationPlan(manifest, { manifestSource: manifest.source, extensionVersion }));
    case "opencode":
      if (!platformModule.createOpenCodeGenerationPlan) {
        throw new Error("OpenCode 平台包未导出 createOpenCodeGenerationPlan()");
      }
      return finalizePlan(platformModule.createOpenCodeGenerationPlan(manifest, { manifestSource: manifest.source, extensionVersion }));
  }
}

function createInstallPlan(
  platform: PlatformName,
  platformModule: PlatformModule,
  manifest: PlatformManifestLike,
  destinationRoot: string,
  scope: InstallScope,
  overwrite: OverwriteMode
): InstallPlan {
  const extensionVersion = getCliVersion();
  switch (platform) {
    case "qwen":
      if (!platformModule.createQwenInstallPlan) {
        throw new Error("Qwen 平台包未导出 createQwenInstallPlan()");
      }
      return finalizePlan(platformModule.createQwenInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        scope,
        overwrite,
        extensionVersion,
      }));
    case "codex":
      if (!platformModule.createCodexInstallPlan) {
        throw new Error("Codex 平台包未导出 createCodexInstallPlan()");
      }
      return finalizePlan(platformModule.createCodexInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        scope,
        overwrite,
        extensionVersion,
      }));
    case "claude":
      if (!platformModule.createClaudeInstallPlan) {
        throw new Error("Claude 平台包未导出 createClaudeInstallPlan()");
      }
      return finalizePlan(platformModule.createClaudeInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        scope,
        overwrite,
        extensionVersion,
      }));
    case "opencode":
      if (!platformModule.createOpenCodeInstallPlan) {
        throw new Error("OpenCode 平台包未导出 createOpenCodeInstallPlan()");
      }
      return finalizePlan(platformModule.createOpenCodeInstallPlan(manifest, {
        manifestSource: manifest.source,
        destinationRoot,
        scope,
        overwrite,
        extensionVersion,
      }));
  }
}

function createCodexAgentInstallPlan(
  platformModule: PlatformModule,
  manifest: PlatformManifestLike,
  destinationRoot: string,
  scope: InstallScope,
): InstallPlan {
  if (!platformModule.createCodexAgentInstallPlan) {
    throw new Error("Codex 平台包未导出 createCodexAgentInstallPlan()");
  }

  return finalizePlan(platformModule.createCodexAgentInstallPlan(manifest, {
    manifestSource: manifest.source,
    destinationRoot,
    scope,
    overwrite: "force",
    extensionVersion: getCliVersion(),
  }));
}

function resolveOverwriteMode(force: boolean | undefined): OverwriteMode {
  return force ? "force" : "error";
}

function resolveOutputFormat(json?: boolean): PlatformOutputFormat {
  return json ? "json" : "text";
}

function mergeHints(...hints: Array<string | undefined>): string | undefined {
  const merged = hints.filter(Boolean);
  return merged.length > 0 ? merged.join("；") : undefined;
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
  action: PlatformAction | "where" | "status" | "doctor" | "agents",
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
    case "repair":
      return "修复";
    case "uninstall":
      return "卸载";
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

function formatInstallMethodLabel(method: "filesystem" | "qwen-cli"): string {
  return method === "qwen-cli" ? "官方 qwen extensions CLI" : "直接写入";
}

function formatInstallSourceLabel(source: "github-repo" | "local-bundle"): string {
  return source === "github-repo" ? "GitHub 扩展仓库" : "本地 bundle";
}

function formatBundleTypeLabel(type: "source-bundle" | "release-bundle" | "codex-plugin" | "codex-marketplace"): string {
  if (type === "codex-marketplace") {
    return "Codex marketplace";
  }

  if (type === "codex-plugin") {
    return "Codex plugin";
  }

  return type === "release-bundle" ? "发布态扩展包" : "开发态源包";
}

function formatScopeFlag(scope: PlatformInstallScope, root: string): string {
  switch (scope) {
    case "global":
      return " --global";
    case "project":
      return " --project";
    case "dir":
      return ` --dir ${JSON.stringify(root)}`;
  }
}

function buildNextStep(
  action: PlatformAction | "where" | "status" | "doctor",
  target: PlatformName,
  root: string,
  options?: {
    scope?: PlatformInstallScope;
    status?: PlatformInstallStatusResult["kind"] | string | null;
    health?: PlatformInstallDoctorResult["health"];
    noop?: boolean;
  },
): string | null {
  const scopeFlag = formatScopeFlag(options?.scope ?? "project", root);

  switch (action) {
    case "generate":
      return `下一步：如需写入平台目录，运行 \`zc platform install ${target} --project\`、\`--global\` 或 \`--dir <path>\`。`;
    case "install":
      return options?.noop
        ? `下一步：当前已是目标状态；如需确认细节，运行 \`zc platform status ${target}${scopeFlag} --json\`。`
        : `下一步：运行 \`zc platform status ${target}${scopeFlag}\` 确认安装状态。`;
    case "update":
      return options?.noop
        ? "下一步：当前已经是最新版本，无需额外操作。"
        : `下一步：运行 \`zc platform status ${target}${scopeFlag}\` 确认更新结果。`;
    case "repair":
      return options?.noop
        ? "下一步：当前安装健康，无需修复。"
        : `下一步：运行 \`zc platform doctor ${target}${scopeFlag}\` 复查健康度。`;
    case "uninstall":
      return `下一步：如需重新安装，运行 \`zc platform install ${target}${scopeFlag}\`。`;
    case "where":
      return `下一步：运行 \`zc platform install ${target}${scopeFlag}\` 执行安装，或追加 \`--plan --json\` 先看计划。`;
    case "status":
      switch (options?.status) {
        case "not-installed":
          return `下一步：运行 \`zc platform install ${target}${scopeFlag}\`。`;
        case "update-available":
          return `下一步：运行 \`zc platform update ${target}${scopeFlag}\`。`;
        case "drifted":
          return `下一步：先运行 \`zc platform doctor ${target}${scopeFlag}\`，再按结果选择 \`repair\` 或带 \`--force\` 的 \`update\`。`;
        case "up-to-date":
          return "下一步：当前已是最新状态，无需动作。";
        default:
          return null;
      }
    case "doctor":
      switch (options?.health) {
        case "healthy":
          return "下一步：未发现需要处理的问题。";
        case "warning":
          return `下一步：优先运行 \`zc platform repair ${target}${scopeFlag}\`，再复查状态。`;
        case "broken":
          return `下一步：先运行 \`zc platform repair ${target}${scopeFlag}\`；如仍异常，再查看 \`zc platform status ${target}${scopeFlag} --json\`。`;
        default:
          return null;
      }
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
  const lines = [
    `${target} ${formatActionLabel(action)}${mode}`,
    formatRootLabel(action, root, metadata),
    ...(metadata?.status ? [`状态：${metadata.status}`] : []),
    ...(metadata?.installMethod ? [`安装方式：${formatInstallMethodLabel(metadata.installMethod)}`] : []),
    ...(metadata?.installSource ? [`安装来源：${formatInstallSourceLabel(metadata.installSource)}`] : []),
    ...(metadata?.sourceRef ? [`来源：${metadata.sourceRef}`] : []),
    ...(metadata?.bundleType ? [`Bundle 类型：${formatBundleTypeLabel(metadata.bundleType)}`] : []),
    ...(metadata?.bundlePath ? [`Bundle 目录：${metadata.bundlePath}`] : []),
    ...(metadata?.receiptPath ? [`回执：${metadata.receiptPath}`] : []),
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    metadata?.noop
      ? "无需写入，当前安装已满足目标状态。"
      : `新增 ${result.created}，覆盖 ${result.overwritten}，未变更 ${result.unchanged}${result.dryRun ? `，跳过写入 ${result.skipped}` : ""}`,
  ];
  const nextStep = buildNextStep(action, target, root, {
    scope: metadata?.scope,
    status: metadata?.status,
    noop: metadata?.noop,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function summarizePlan(action: PlatformAction, target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: PlatformResolutionMetadata & {
  status?: string;
} & Pick<PlatformResultExtra, "installSource" | "sourceRef" | "bundleType" | "bundlePath">): string {
  const lines = [
    `${target} ${formatActionLabel(action)}计划`,
    formatRootLabel(action, root, metadata),
    ...(metadata?.status ? [`状态：${metadata.status}`] : []),
    ...(metadata?.installSource ? [`安装来源：${formatInstallSourceLabel(metadata.installSource)}`] : []),
    ...(metadata?.sourceRef ? [`来源：${metadata.sourceRef}`] : []),
    ...(metadata?.bundleType ? [`Bundle 类型：${formatBundleTypeLabel(metadata.bundleType)}`] : []),
    ...(metadata?.bundlePath ? [`Bundle 目录：${metadata.bundlePath}`] : []),
    ...(metadata?.hint ? [`提示：${metadata.hint}`] : []),
    ...summarizeCapability(plan, metadata),
    `产物数量：${plan.artifacts.length}`,
    ...plan.artifacts.map((artifact) => `- ${artifact.path}`),
  ];
  const nextStep = buildNextStep(action, target, root, {
    scope: metadata?.scope,
    status: metadata?.status,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function buildPlanPayload(action: PlatformAction, target: PlatformName, root: string, plan: PlatformPlanLike, metadata?: PlatformResolutionMetadata & {
  status?: string | null;
} & Pick<PlatformResultExtra, "installSource" | "sourceRef" | "bundleType" | "bundlePath">) {
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
    installSource: metadata?.installSource ?? null,
    sourceRef: metadata?.sourceRef ?? null,
    bundleType: metadata?.bundleType ?? null,
    bundlePath: metadata?.bundlePath ?? null,
    capability: getPlanCapabilitySummary(plan, metadata),
    artifactCount: plan.artifacts.length,
    contentFingerprint: plan.metadata?.fingerprint.value ?? null,
    overwrite: "overwrite" in plan ? plan.overwrite : null,
    artifacts: plan.artifacts,
  };
}

function resolveGenerateArtifact(outputRoot: string, artifact: { readonly path: string; readonly content: string }) {
  return {
    path: isAbsolute(artifact.path) ? artifact.path : join(outputRoot, artifact.path),
    content: artifact.content,
  };
}

async function cleanupCodexPluginContentForForce(
  bundleType: PlatformGenerateBundleType | undefined,
  artifacts: readonly { readonly path: string }[],
  force?: boolean,
): Promise<void> {
  if (!force || (bundleType !== "codex-plugin" && bundleType !== "codex-marketplace")) {
    return;
  }

  const pluginContentRoots = artifacts
    .filter((artifact) => artifact.path.replace(/\\/g, "/").endsWith(codexPluginManifestPath))
    .flatMap((artifact) => {
      const pluginRoot = dirname(dirname(artifact.path));
      return ["commands", "skills", "agents"].map((directory) => join(pluginRoot, directory));
    });

  if (pluginContentRoots.length > 0) {
    await removeManagedPaths(pluginContentRoots);
  }
}

function isCodexAgentConfigArtifact(target: PlatformName, artifact: GeneratedArtifact): boolean {
  const normalizedPath = artifact.path.replace(/\\/g, "/");

  return (
    target === "codex" &&
    (normalizedPath === "config.toml" || normalizedPath.endsWith("/config.toml")) &&
    isCodexAgentConfigContent(artifact.content)
  );
}

function hasNodeErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function mergeCodexAgentConfigArtifact(
  artifact: GeneratedArtifact,
  managedAgentNames?: readonly string[],
): Promise<GeneratedArtifact> {
  let existingContent: string | undefined;

  try {
    existingContent = await readFile(artifact.path, "utf8");
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      existingContent = undefined;
    } else {
      throw error;
    }
  }

  return {
    ...artifact,
    content: managedAgentNames === undefined
      ? mergeCodexAgentConfig(existingContent, artifact.content)
      : mergeOwnedCodexAgentConfig(existingContent, artifact.content, managedAgentNames),
  };
}

function mergeWriteResults(
  left: WriteArtifactsResult,
  right: WriteArtifactsResult,
): WriteArtifactsResult {
  return {
    created: left.created + right.created,
    overwritten: left.overwritten + right.overwritten,
    unchanged: left.unchanged + right.unchanged,
    skipped: left.skipped + right.skipped,
    dryRun: left.dryRun && right.dryRun,
  };
}

async function writePlatformArtifacts(
  target: PlatformName,
  artifacts: readonly GeneratedArtifact[],
  options: {
    readonly dryRun: boolean;
    readonly overwrite: OverwriteMode;
    readonly managedAgentNames?: readonly string[];
  },
): Promise<WriteArtifactsResult> {
  const artifactWriteOptions = {
    dryRun: options.dryRun,
    overwrite: options.overwrite,
  };
  const configArtifacts = artifacts.filter((artifact) => isCodexAgentConfigArtifact(target, artifact));

  if (configArtifacts.length === 0) {
    return writeArtifacts(artifacts, artifactWriteOptions);
  }

  const configPaths = new Set(configArtifacts.map((artifact) => artifact.path));
  const regularArtifacts = artifacts.filter((artifact) => !configPaths.has(artifact.path));
  const mergedConfigArtifacts = await Promise.all(
    configArtifacts.map((artifact) =>
      mergeCodexAgentConfigArtifact(artifact, options.managedAgentNames)),
  );

  if (options.dryRun) {
    const regularResult = await writeArtifacts(regularArtifacts, artifactWriteOptions);
    const configResult = await writeArtifacts(mergedConfigArtifacts, {
      ...artifactWriteOptions,
      overwrite: "force",
    });

    return mergeWriteResults(regularResult, configResult);
  }

  await writeArtifacts(regularArtifacts, {
    ...artifactWriteOptions,
    dryRun: true,
  });

  const regularResult = await writeArtifacts(regularArtifacts, artifactWriteOptions);
  const configResult = await writeArtifacts(mergedConfigArtifacts, {
    ...artifactWriteOptions,
    overwrite: "force",
  });

  return mergeWriteResults(regularResult, configResult);
}

type CodexAgentsOperation = "sync" | "status" | "uninstall";
type CodexAgentArtifactState = "up-to-date" | "missing" | "drifted";

interface CodexAgentArtifactStatus {
  readonly path: string;
  readonly kind: "config" | "agent";
  readonly state: CodexAgentArtifactState;
}

interface CodexAgentsStatus {
  readonly kind: "empty" | "not-installed" | "up-to-date" | "needs-sync" | "needs-attention";
  readonly summary: {
    readonly expectedArtifacts: number;
    readonly upToDateArtifacts: number;
    readonly missingArtifacts: number;
    readonly driftedArtifacts: number;
    readonly staleAgentFiles: number;
    readonly untrackedAgentFiles: number;
  };
  readonly artifacts: readonly CodexAgentArtifactStatus[];
  readonly staleAgentFiles: readonly string[];
  readonly untrackedAgentFiles: readonly string[];
}

function resolveCodexAgentsOperation(opts: PlatformAgentsOpts): CodexAgentsOperation {
  const requested = [
    opts.status ? "status" : null,
    opts.uninstall ? "uninstall" : null,
    opts.sync || opts.update ? "sync" : null,
  ].filter((value): value is CodexAgentsOperation => value !== null);

  if (requested.length > 1) {
    throw new Error("`platform agents` 的 --sync/--update、--status、--uninstall 不能同时使用。");
  }

  return requested[0] ?? "sync";
}

function assertCodexAgentsTarget(target: PlatformName): void {
  if (target !== "codex") {
    throw new Error("`platform agents` 当前只支持 codex。其他平台的 agents 仍随各自 platform install/update 管理。");
  }
}

function isCodexAgentTomlPath(path: string): boolean {
  const fileName = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return /^zc-.+\.toml$/u.test(fileName);
}

function getCodexAgentFileArtifacts(plan: PlatformPlanLike): readonly GeneratedArtifact[] {
  return plan.artifacts.filter((artifact) => isCodexAgentTomlPath(artifact.path));
}

function getCodexAgentConfigArtifact(plan: PlatformPlanLike): GeneratedArtifact | null {
  return plan.artifacts.find((artifact) => isCodexAgentConfigContent(artifact.content)) ?? null;
}

function resolveCodexAgentsDir(root: string, plan: PlatformPlanLike): string {
  const relativeDir = plan.capability?.agents?.relativeDir ?? "agents";
  return resolve(root, relativeDir);
}

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}

async function listExistingZcAgentFiles(agentsDir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isCodexAgentTomlPath(entry.name))
      .map((entry) => join(agentsDir, entry.name))
      .sort();
  } catch (error) {
    if (hasNodeErrorCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }
}

function uniquePaths(paths: readonly string[]): readonly string[] {
  return [...new Set(paths)].sort();
}

async function estimateRemovedPaths(paths: readonly string[]): Promise<{
  readonly removed: number;
  readonly missing: number;
}> {
  let removed = 0;
  let missing = 0;

  for (const path of uniquePaths(paths)) {
    if (await pathExists(path)) {
      removed += 1;
      continue;
    }

    missing += 1;
  }

  return { removed, missing };
}

async function inspectCodexAgentArtifact(artifact: GeneratedArtifact): Promise<CodexAgentArtifactStatus> {
  const existing = await readTextIfExists(artifact.path);

  return {
    path: artifact.path,
    kind: "agent",
    state: existing === null ? "missing" : existing === artifact.content ? "up-to-date" : "drifted",
  };
}

async function inspectCodexAgentConfigArtifact(
  artifact: GeneratedArtifact,
  managedAgentNames: readonly string[],
): Promise<CodexAgentArtifactStatus> {
  const existing = await readTextIfExists(artifact.path);

  if (existing === null || !isCodexAgentConfigContent(existing)) {
    return {
      path: artifact.path,
      kind: "config",
      state: "missing",
    };
  }

  const merged = mergeOwnedCodexAgentConfig(
    existing,
    artifact.content,
    managedAgentNames,
  );
  return {
    path: artifact.path,
    kind: "config",
    state: existing === merged ? "up-to-date" : "drifted",
  };
}

async function inspectCodexAgents(
  plan: PlatformPlanLike,
  root: string,
  receipt: CodexAgentsReceipt | null,
): Promise<CodexAgentsStatus> {
  const configArtifact = getCodexAgentConfigArtifact(plan);
  const agentArtifacts = getCodexAgentFileArtifacts(plan);
  const expectedAgentPaths = new Set(agentArtifacts.map((artifact) => artifact.path));
  const existingAgentFiles = await listExistingZcAgentFiles(resolveCodexAgentsDir(root, plan));
  const ownedAgentPaths = new Set(receipt ? getCodexAgentsReceiptOwnedPaths(receipt) : []);
  const staleAgentFiles = existingAgentFiles.filter(
    (path) => ownedAgentPaths.has(path) && !expectedAgentPaths.has(path),
  );
  const untrackedAgentFiles = existingAgentFiles.filter(
    (path) => !ownedAgentPaths.has(path) && !expectedAgentPaths.has(path),
  );
  const artifacts = [
    ...(configArtifact
      ? [await inspectCodexAgentConfigArtifact(
        configArtifact,
        receipt?.managedAgentNames ?? [],
      )]
      : []),
    ...(await Promise.all(agentArtifacts.map(inspectCodexAgentArtifact))),
  ];
  const summary = {
    expectedArtifacts: artifacts.length,
    upToDateArtifacts: artifacts.filter((artifact) => artifact.state === "up-to-date").length,
    missingArtifacts: artifacts.filter((artifact) => artifact.state === "missing").length,
    driftedArtifacts: artifacts.filter((artifact) => artifact.state === "drifted").length,
    staleAgentFiles: staleAgentFiles.length,
    untrackedAgentFiles: untrackedAgentFiles.length,
  };
  const kind = (() => {
    if (artifacts.length === 0) {
      return "empty" as const;
    }

    if (
      summary.missingArtifacts === artifacts.length &&
      summary.driftedArtifacts === 0 &&
      summary.staleAgentFiles === 0
    ) {
      return "not-installed" as const;
    }

    if (summary.missingArtifacts > 0 || summary.driftedArtifacts > 0 || summary.staleAgentFiles > 0) {
      return "needs-sync" as const;
    }

    if (summary.untrackedAgentFiles > 0) {
      return "needs-attention" as const;
    }

    return "up-to-date" as const;
  })();

  return {
    kind,
    summary,
    artifacts,
    staleAgentFiles,
    untrackedAgentFiles,
  };
}

function buildCodexAgentsPayload(args: {
  readonly mode: "plan" | "result" | "status";
  readonly operation: CodexAgentsOperation;
  readonly root: string;
  readonly metadata: PlatformResolutionMetadata;
  readonly plan: PlatformPlanLike;
  readonly result?: object;
}) {
  return {
    mode: args.mode,
    action: "agents",
    operation: args.operation,
    target: "codex",
    root: args.root,
    scope: args.metadata.scope ?? "project",
    rootSource: args.metadata.rootSource ?? (args.metadata.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: args.metadata.autoResolvedRoot ?? false,
    hint: args.metadata.hint ?? null,
    capability: getPlanCapabilitySummary(args.plan),
    artifactCount: args.plan.artifacts.length,
    contentFingerprint: args.plan.metadata?.fingerprint.value ?? null,
    ...(args.mode === "plan" ? { artifacts: args.plan.artifacts } : {}),
    ...(args.result ?? {}),
  };
}

function summarizeCodexAgents(args: {
  readonly operation: CodexAgentsOperation;
  readonly root: string;
  readonly metadata: PlatformResolutionMetadata;
  readonly plan: PlatformPlanLike;
  readonly planOnly?: boolean;
  readonly status?: CodexAgentsStatus;
  readonly result?: {
    readonly created?: number;
    readonly overwritten?: number;
    readonly unchanged?: number;
    readonly skipped?: number;
    readonly removed?: number;
    readonly missing?: number;
    readonly configChanged?: boolean;
    readonly configMissing?: boolean;
    readonly staleRemoved?: number;
    readonly staleMissing?: number;
  };
}): string {
  const header = args.operation === "status"
    ? "Codex custom agents 状态"
    : args.operation === "uninstall"
      ? `Codex custom agents 卸载${args.planOnly ? "计划" : "完成"}`
      : `Codex custom agents 同步${args.planOnly ? "计划" : "完成"}`;
  const lines = [
    header,
    `范围：${args.metadata.scope ?? "project"}`,
    `目录：${args.root}`,
    ...(args.metadata.hint ? [`提示：${args.metadata.hint}`] : []),
  ];

  if (args.status) {
    lines.push(
      `状态：${args.status.kind}`,
      `期望产物：${args.status.summary.expectedArtifacts}，已最新：${args.status.summary.upToDateArtifacts}，缺失：${args.status.summary.missingArtifacts}，漂移：${args.status.summary.driftedArtifacts}，过期 agent：${args.status.summary.staleAgentFiles}，未登记 agent：${args.status.summary.untrackedAgentFiles}`,
    );
  }

  if (args.result) {
    if (args.operation === "sync") {
      lines.push(
        `写入结果：新增 ${args.result.created ?? 0}，覆盖 ${args.result.overwritten ?? 0}，未变更 ${args.result.unchanged ?? 0}${args.planOnly ? `，跳过写入 ${args.result.skipped ?? 0}` : ""}`,
      );
      if ((args.result.staleRemoved ?? 0) > 0 || (args.result.staleMissing ?? 0) > 0) {
        lines.push(`Prune：移除过期 agent ${args.result.staleRemoved ?? 0}，原本缺失 ${args.result.staleMissing ?? 0}`);
      }
    }

    if (args.operation === "uninstall") {
      lines.push(
        `移除 agent 文件 ${args.result.removed ?? 0}，原本缺失 ${args.result.missing ?? 0}`,
        `配置清理：${args.result.configChanged ? "已移除 [agents.zc_*]" : args.result.configMissing ? "config.toml 不存在" : "无需变更"}`,
      );
    }
  }

  if (args.planOnly || args.operation === "status") {
    lines.push(...args.plan.artifacts.map((artifact) => `- ${artifact.path}`));
  }

  if (args.operation === "sync") {
    lines.push("下一步：运行 `zc platform agents codex --status` 复查 custom agents。");
  } else if (args.operation === "status" && args.status?.kind === "needs-sync") {
    lines.push("下一步：运行 `zc platform agents codex --sync --prune` 更新并清理过期 zc agents。");
  } else if (args.operation === "status" && args.status?.kind === "needs-attention") {
    lines.push("下一步：未登记的 zc agent 不会自动删除；请人工确认后再处理。");
  }

  return lines.join("\n");
}

function assertExclusiveTargetSelector(opts: PlatformTargetSelectorOpts): void {
  if (opts.dir && (opts.project || opts.global)) {
    throw new Error("显式目录 `--dir` 不能与 `--project` 或 `--global` 同时使用。");
  }
  if (opts.project && opts.global) {
    throw new Error("`--project` 与 `--global` 不能同时使用。");
  }
}

function assertGenerateTargetSelectorSupported(target: PlatformName, opts: PlatformGenerateOpts): void {
  if ((opts.project || opts.global) && !(target === "codex" && opts.bundle === "codex-marketplace")) {
    throw new Error("`platform generate --project/--global` 当前仅支持 `codex --bundle codex-marketplace`。");
  }
}

async function resolveGenerateOutputRoot(
  target: PlatformName,
  opts: PlatformGenerateOpts,
): Promise<{
  root: string;
  metadata: PlatformResolutionMetadata;
}> {
  assertExclusiveTargetSelector(opts);
  assertGenerateTargetSelectorSupported(target, opts);

  if (opts.project) {
    const targetResolution = await resolveInstallTarget(target, { project: true });
    return {
      root: targetResolution.root,
      metadata: {
        scope: "project",
        rootSource: targetResolution.source,
        autoResolvedRoot: true,
        hint: targetResolution.hint,
      },
    };
  }

  if (opts.global) {
    return {
      root: resolve(homedir()),
      metadata: {
        scope: "global",
        rootSource: "official-global",
      },
    };
  }

  return {
    root: opts.dir ? resolve(opts.dir) : resolveWorkspacePath(`.generated/${target}`),
    metadata: {
      scope: "dir",
      rootSource: "explicit",
    },
  };
}

function parseGenerateBundleType(value: string): PlatformGenerateBundleType {
  if (value === "release-bundle" || value === "release") {
    return "release-bundle";
  }

  if (value === "codex-plugin" || value === "plugin") {
    return "codex-plugin";
  }

  if (value === "codex-marketplace" || value === "marketplace") {
    return "codex-marketplace";
  }

  throw new InvalidArgumentError(`不支持的 bundle 类型：${value}。当前支持：release-bundle | codex-plugin | codex-marketplace`);
}

function resolveCodexMarketplaceGitSource(value: boolean | string | undefined): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return codexMarketplaceDefaultGitSource;
}

function buildCodexMarketplaceAddArgs(source: string, ref: string | undefined): string[] {
  return [
    "plugin",
    "marketplace",
    "add",
    source,
    ...(ref ? ["--ref", ref] : []),
    "--json",
  ];
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

function formatShellCommand(command: string, args: readonly string[]): string {
  return [command, ...args].map(quoteShellArg).join(" ");
}

function assertCodexGitMarketplaceOptions(opts: PlatformPluginOpts): void {
  const lifecycleOperations = [
    opts.register,
    opts.install,
    opts.upgrade,
    opts.status,
    opts.uninstall,
  ].filter(Boolean).length;

  if (lifecycleOperations > 1) {
    throw new Error("Codex plugin Git marketplace 模式一次只能选择一个 lifecycle 操作。");
  }

  if (opts.ref && (opts.upgrade || opts.status || opts.uninstall)) {
    throw new Error("`--ref` 只适用于 marketplace 注册或插件安装。");
  }

  if (opts.includeAgents) {
    throw new Error("Git marketplace 注册模式不处理 custom agents；请改用 `zc platform agents codex`。");
  }

  if (opts.withAgents && !(opts.install || opts.upgrade || opts.status || opts.uninstall)) {
    throw new Error("`--with-agents` 必须与 --install、--upgrade、--status 或 --uninstall 一起使用。");
  }

  if (opts.dir || opts.project || opts.global) {
    throw new Error("Git marketplace 模式不写本地 marketplace root，不能同时使用 --dir/--project/--global。");
  }

  if (opts.force) {
    throw new Error("Git marketplace 模式不写文件，不能同时使用 --force。");
  }
}

interface CodexCliCommandResult {
  readonly args: readonly string[];
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

async function runCodexCliCommand(
  args: readonly string[],
  options: {
    readonly mirrorOutput?: boolean;
    readonly allowFailure?: boolean;
  } = {},
): Promise<CodexCliCommandResult> {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawnCommand("codex", args, {
      shell: false,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (options.mirrorOutput) {
        process.stdout.write(text);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (options.mirrorOutput) {
        process.stderr.write(text);
      }
    });
    child.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        rejectPromise(new Error("未检测到 codex CLI，无法自动注册 Git marketplace。"));
        return;
      }

      rejectPromise(error);
    });
    child.once("close", (code, signal) => {
      if (code === 0 || options.allowFailure) {
        resolvePromise({ args, code, signal, stdout, stderr });
        return;
      }

      rejectPromise(createCodexCliCommandFailure({
        args,
        code,
        signal,
        stdout,
        stderr,
      }));
    });
  });
}

type CodexPluginCliMode = "official-plugin" | "legacy-marketplace";

interface CodexPluginCliCapability {
  readonly mode: CodexPluginCliMode;
  readonly version: string | null;
}

function parseCodexCliJsonOutput(result: CodexCliCommandResult): unknown {
  const stdout = result.stdout.trim();
  if (!stdout) {
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch {
    return {
      stdout,
      stderr: result.stderr.trim() || null,
    };
  }
}

async function detectCodexPluginCliCapability(): Promise<CodexPluginCliCapability> {
  const versionResult = await runCodexCliCommand(["--version"], { allowFailure: true });
  const version = versionResult.code === 0
    ? versionResult.stdout.trim() || versionResult.stderr.trim() || null
    : null;
  const officialProbe = await runCodexCliCommand(["plugin", "add", "--help"], {
    allowFailure: true,
  });

  if (officialProbe.code === 0) {
    return {
      mode: "official-plugin",
      version,
    };
  }

  const legacyProbe = await runCodexCliCommand(["marketplace", "add", "--help"], {
    allowFailure: true,
  });

  if (legacyProbe.code === 0) {
    return {
      mode: "legacy-marketplace",
      version,
    };
  }

  throw new Error(
    `当前 Codex CLI${version ? `（${version}）` : ""}既不支持官方 plugin lifecycle，也不支持旧 marketplace 注册命令；请先更新 Codex CLI。`,
  );
}

type CodexPluginGitOperation = "register" | "install" | "upgrade" | "status" | "uninstall";

interface CodexPluginLifecycleResult {
  readonly operation: CodexPluginGitOperation;
  readonly executed: boolean;
  readonly payload: Record<string, unknown>;
  readonly text: string;
  readonly installedPluginPath: string | null;
  readonly installedVersion: string | null;
  readonly availableVersion: string | null;
  readonly updatePending: boolean;
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findCodexPluginRecord(
  outputs: readonly unknown[],
  collection: "installed" | "available" | null,
): Record<string, unknown> | null {
  for (let index = outputs.length - 1; index >= 0; index -= 1) {
    const output = outputs[index];
    if (!isUnknownRecord(output)) {
      continue;
    }

    if (collection === null) {
      if (
        output.pluginId === `${codexMarketplacePluginName}@${codexMarketplacePluginName}`
        || output.name === codexMarketplacePluginName
      ) {
        return output;
      }
      continue;
    }

    const entries = output[collection];
    if (!Array.isArray(entries)) {
      continue;
    }
    const entry = entries.find(
      (candidate) =>
        isUnknownRecord(candidate)
        && (
          candidate.pluginId === `${codexMarketplacePluginName}@${codexMarketplacePluginName}`
          || candidate.name === codexMarketplacePluginName
        ),
    );
    if (isUnknownRecord(entry)) {
      return entry;
    }
  }
  return null;
}

function resolveCodexPluginPath(plugin: Record<string, unknown> | null): string | null {
  if (typeof plugin?.installedPath === "string") {
    return plugin.installedPath;
  }

  const source = plugin?.source;
  return isUnknownRecord(source) && typeof source.path === "string"
    ? source.path
    : null;
}

function isLegacyCodexDirectPlugin(plugin: Record<string, unknown> | null): boolean {
  const pluginPath = resolveCodexPluginPath(plugin);
  return pluginPath ? isCodexLegacyDirectPluginPath(pluginPath) : false;
}

function findCodexMarketplaceRecord(output: unknown): Record<string, unknown> | null {
  if (!isUnknownRecord(output) || !Array.isArray(output.marketplaces)) {
    return null;
  }

  const marketplace = output.marketplaces.find(
    (candidate) => isUnknownRecord(candidate) && candidate.name === codexMarketplacePluginName,
  );
  return isUnknownRecord(marketplace) ? marketplace : null;
}

function resolveCodexMarketplaceSourceType(marketplace: Record<string, unknown>): string | null {
  const marketplaceSource = marketplace.marketplaceSource;
  return isUnknownRecord(marketplaceSource) && typeof marketplaceSource.sourceType === "string"
    ? marketplaceSource.sourceType
    : null;
}

function resolveCodexMarketplaceRollbackSource(marketplace: Record<string, unknown>): string | null {
  const marketplaceSource = marketplace.marketplaceSource;
  if (isUnknownRecord(marketplaceSource) && typeof marketplaceSource.source === "string") {
    return marketplaceSource.source;
  }

  return typeof marketplace.root === "string" ? marketplace.root : null;
}

function isCodexMarketplaceAlreadyAbsent(result: CodexCliCommandResult): boolean {
  if (result.code === 0 || result.signal) {
    return false;
  }

  return `${result.stderr}\n${result.stdout}`
    .toLowerCase()
    .includes("is not configured or installed");
}

function isCodexPluginAlreadyAbsent(result: CodexCliCommandResult): boolean {
  if (result.code === 0 || result.signal) {
    return false;
  }

  const message = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return message.includes("plugin") && message.includes("not installed");
}

function createCodexCliCommandFailure(result: CodexCliCommandResult): Error {
  const command = formatShellCommand("codex", result.args);
  return new Error(
    result.signal
      ? `${command} 被信号 ${result.signal} 中断。`
      : `${command} 退出码为 ${result.code ?? "unknown"}：${result.stderr.trim() || result.stdout.trim() || "无错误输出"}`,
  );
}

// Official lifecycle and JSON contracts:
// https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin
// https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin-marketplace
function resolveCodexPluginGitOperation(opts: PlatformPluginOpts): CodexPluginGitOperation {
  if (opts.install) {
    return "install";
  }
  if (opts.upgrade) {
    return "upgrade";
  }
  if (opts.status) {
    return "status";
  }
  if (opts.uninstall) {
    return "uninstall";
  }
  return "register";
}

async function runCodexMarketplaceGitMode(
  opts: PlatformPluginOpts,
  options: { readonly emit?: boolean } = {},
): Promise<CodexPluginLifecycleResult> {
  const format = resolveOutputFormat(opts.json);
  const source = resolveCodexMarketplaceGitSource(opts.git);
  const addArgs = buildCodexMarketplaceAddArgs(source, opts.ref);
  const pluginId = `${codexMarketplacePluginName}@${codexMarketplacePluginName}`;
  const installArgs = ["plugin", "add", pluginId, "--json"];
  const marketplaceListArgs = ["plugin", "marketplace", "list", "--json"];
  const upgradeArgs = ["plugin", "marketplace", "upgrade", codexMarketplacePluginName, "--json"];
  const removeMarketplaceArgs = ["plugin", "marketplace", "remove", codexMarketplacePluginName, "--json"];
  const statusArgs = [
    "plugin",
    "list",
    "--marketplace",
    codexMarketplacePluginName,
    "--available",
    "--json",
  ];
  const uninstallArgs = ["plugin", "remove", pluginId, "--json"];
  const installCommand = formatShellCommand("codex", installArgs);
  const upgradeCommand = formatShellCommand("codex", upgradeArgs);
  const statusCommand = formatShellCommand("codex", statusArgs);
  const uninstallCommand = formatShellCommand("codex", uninstallArgs);
  const operation = resolveCodexPluginGitOperation(opts);
  const commandArgsByOperation: Record<CodexPluginGitOperation, readonly string[][]> = {
    register: [addArgs],
    install: [addArgs, installArgs],
    upgrade: [marketplaceListArgs, upgradeArgs, installArgs, statusArgs],
    status: [statusArgs],
    uninstall: [uninstallArgs],
  };
  const plannedArgs = commandArgsByOperation[operation];
  const plannedCommands = plannedArgs.map((args) => formatShellCommand("codex", args));
  const execute = !opts.plan && Boolean(
    opts.register || opts.install || opts.upgrade || opts.status || opts.uninstall,
  );
  let cliCapability: CodexPluginCliCapability | null = null;
  let executedArgs: readonly string[][] = [];
  let commandResults: readonly CodexCliCommandResult[] = [];
  let marketplaceMigration = operation === "upgrade" && !execute ? "conditional" : "none";
  let legacyPluginBackupPath: string | null = null;

  if (execute) {
    cliCapability = await detectCodexPluginCliCapability();

    if (cliCapability.mode === "legacy-marketplace") {
      if (operation !== "register") {
        throw new Error(
          `当前 ${cliCapability.version ?? "Codex CLI"} 只有旧 marketplace 注册能力，不支持 ${operation}；请先运行官方 Codex 更新后重试。`,
        );
      }

      const legacyArgs = [
        "marketplace",
        "add",
        source,
        ...(opts.ref ? ["--ref", opts.ref] : []),
      ];
      const legacyCommand = formatShellCommand("codex", legacyArgs);
      if (format === "text" && options.emit !== false) {
        console.log(`检测到旧版 Codex CLI，使用兼容命令：${legacyCommand}`);
      }
      const result = await runCodexCliCommand(legacyArgs, {
        mirrorOutput: format === "text" && options.emit !== false,
      });
      executedArgs = [legacyArgs];
      commandResults = [result];
    } else {
      const results: CodexCliCommandResult[] = [];
      const executed: string[][] = [];
      const runOfficialCommand = async (
        args: readonly string[],
        commandOptions: { readonly allowFailure?: boolean } = {},
      ): Promise<CodexCliCommandResult> => {
        const command = formatShellCommand("codex", args);
        if (format === "text" && options.emit !== false) {
          console.log(`正在调用官方命令：${command}`);
        }

        const result = await runCodexCliCommand(args, {
          mirrorOutput: format === "text" && options.emit !== false,
          allowFailure: commandOptions.allowFailure,
        });
        executed.push([...args]);
        results.push(result);
        return result;
      };

      if (operation === "upgrade") {
        const marketplaceListResult = await runOfficialCommand(marketplaceListArgs);
        const marketplace = findCodexMarketplaceRecord(parseCodexCliJsonOutput(marketplaceListResult));

        if (!marketplace) {
          marketplaceMigration = "registered-git";
          await runOfficialCommand(addArgs);
          await runOfficialCommand(installArgs);
        } else if (resolveCodexMarketplaceSourceType(marketplace) === "git") {
          await runOfficialCommand(upgradeArgs);
          await runOfficialCommand(installArgs);
        } else {
          const previousSourceType = resolveCodexMarketplaceSourceType(marketplace) ?? "unknown";
          const rollbackSource = resolveCodexMarketplaceRollbackSource(marketplace);
          if (!rollbackSource) {
            throw new Error(
              `marketplace ${codexMarketplacePluginName} 不是 Git 来源，且无法识别可回滚的旧来源；请先备份并手动迁移。`,
            );
          }

          marketplaceMigration = `${previousSourceType}-to-git`;
          const removeMarketplaceResult = await runOfficialCommand(removeMarketplaceArgs, {
            allowFailure: true,
          });
          if (
            removeMarketplaceResult.code !== 0
            && !isCodexMarketplaceAlreadyAbsent(removeMarketplaceResult)
          ) {
            throw createCodexCliCommandFailure(removeMarketplaceResult);
          }
          try {
            await runOfficialCommand(addArgs);
            await runOfficialCommand(installArgs);
          } catch (migrationError) {
            await runOfficialCommand(removeMarketplaceArgs, { allowFailure: true });
            const rollbackAddArgs = buildCodexMarketplaceAddArgs(rollbackSource, undefined);
            const restoreMarketplaceResult = await runOfficialCommand(rollbackAddArgs, { allowFailure: true });
            const restorePluginResult = restoreMarketplaceResult.code === 0
              ? await runOfficialCommand(installArgs, { allowFailure: true })
              : null;
            const rollbackSucceeded = restoreMarketplaceResult.code === 0
              && restorePluginResult?.code === 0;
            const migrationMessage = migrationError instanceof Error
              ? migrationError.message
              : "未知迁移错误";

            throw new Error(
              rollbackSucceeded
                ? `${migrationMessage}；已恢复原 ${previousSourceType} marketplace 和旧版插件。`
                : `${migrationMessage}；自动回滚未完整成功，请使用旧来源 ${rollbackSource} 手动恢复。`,
            );
          }
        }

        const statusResult = await runOfficialCommand(statusArgs);
        const installedAfterUpgrade = findCodexPluginRecord(
          [parseCodexCliJsonOutput(statusResult)],
          "installed",
        );
        if (isLegacyCodexDirectPlugin(installedAfterUpgrade)) {
          marketplaceMigration = marketplaceMigration === "none"
            ? "legacy-plugin-to-git"
            : `${marketplaceMigration}+legacy-plugin-to-git`;
          const legacyPluginPath = resolveCodexPluginPath(installedAfterUpgrade)!;
          const legacyPluginVersion = typeof installedAfterUpgrade?.version === "string"
            ? installedAfterUpgrade.version
            : null;
          const backup = await backupCodexLegacyDirectPlugin(
            legacyPluginPath,
            legacyPluginVersion,
          );
          if (!backup.copied || !backup.backupPath) {
            throw new Error(
              `Codex 返回了旧直装记录，但目录不存在，无法创建可恢复备份：${legacyPluginPath}`,
            );
          }
          legacyPluginBackupPath = backup.backupPath;
          try {
            const uninstallResult = await runOfficialCommand(uninstallArgs, { allowFailure: true });
            if (uninstallResult.code !== 0 && !isCodexPluginAlreadyAbsent(uninstallResult)) {
              throw createCodexCliCommandFailure(uninstallResult);
            }
            await detachCodexLegacyDirectPlugin(backup);
            await runOfficialCommand(installArgs);
            const repairedStatusResult = await runOfficialCommand(statusArgs);
            const repairedPlugin = findCodexPluginRecord(
              [parseCodexCliJsonOutput(repairedStatusResult)],
              "installed",
            );
            if (isLegacyCodexDirectPlugin(repairedPlugin)) {
              throw new Error(
                `Codex 仍从旧直装目录加载 zc-toolkit：${resolveCodexPluginPath(repairedPlugin)}`,
              );
            }
          } catch (repairError) {
            const repairMessage = repairError instanceof Error
              ? repairError.message
              : "未知修复错误";
            let restoreFailure: unknown = null;
            try {
              await restoreCodexLegacyDirectPlugin(backup);
            } catch (restoreError) {
              restoreFailure = restoreError;
            }
            if (!restoreFailure) {
              throw new Error(`${repairMessage}；已从 ${backup.backupPath} 恢复旧插件目录。`);
            }
            const restoreMessage = restoreFailure instanceof Error
              ? restoreFailure.message
              : "未知恢复错误";
            throw new Error(
              `${repairMessage}；旧插件备份位于 ${backup.backupPath}，自动恢复失败：${restoreMessage}`,
            );
          }
        }
      } else {
        for (const args of plannedArgs) {
          await runOfficialCommand(args);
        }
      }

      executedArgs = executed;
      commandResults = results;
    }
  }

  const executed = execute;
  const operationLabel: Record<CodexPluginGitOperation, string> = {
    register: "注册 marketplace",
    install: "注册 marketplace 并安装插件",
    upgrade: "迁移或刷新 marketplace 并升级插件",
    status: "检查插件状态",
    uninstall: "卸载插件",
  };
  const nextSteps = (() => {
    switch (operation) {
      case "register":
        return [
          `继续运行 ${installCommand}，或在 Codex 的 Plugins 页面安装 zc-toolkit`,
          "安装后启动新线程，再使用 $zc-toolkit:start 或直接 @zc-toolkit",
        ];
      case "install":
        return [
          `运行 ${statusCommand} 核对 installed、enabled 和 version`,
          "启动新线程后使用 $zc-toolkit:start 或直接 @zc-toolkit",
        ];
      case "upgrade":
        return [
          "marketplace 已迁移或刷新，插件已从当前快照重新安装；请核对 installed version",
          "更新后启动新线程，避免旧线程继续使用已加载的旧插件能力",
        ];
      case "status":
        return [
          `需要刷新目录时运行 ${upgradeCommand}`,
          `需要安装时运行 ${installCommand}`,
        ];
      case "uninstall":
        return [
          "插件 bundle 已移除；其 connector 授权需要在 ChatGPT Plugins/Apps 中单独管理",
          "如不再使用该目录，可另行运行 codex plugin marketplace remove zc-toolkit --json",
        ];
    }
  })();

  const parsedResults = commandResults.map((result) => parseCodexCliJsonOutput(result));
  const directPlugin = findCodexPluginRecord(parsedResults, null);
  const installedPlugin = findCodexPluginRecord(parsedResults, "installed") ?? directPlugin;
  const availablePlugin = findCodexPluginRecord(parsedResults, "available");
  const installedPluginPath = resolveCodexPluginPath(installedPlugin);
  const installedVersion = typeof installedPlugin?.version === "string"
    ? installedPlugin.version
    : null;
  const availableVersion = typeof availablePlugin?.version === "string"
    ? availablePlugin.version
    : null;
  const updatePending = Boolean(
    installedVersion
    && availableVersion
    && installedVersion !== availableVersion,
  );
  const payload = {
    mode: executed ? "result" : "plan",
    action: "plugin",
    target: "codex",
    distribution: "git-marketplace",
    operation,
    source,
    ref: opts.ref ?? null,
    register: executed && operation === "register",
    command: plannedCommands[0],
    args: ["codex", ...plannedArgs[0]!],
    commands: plannedCommands,
    commandArgs: plannedArgs.map((args) => ["codex", ...args]),
    migrationCommands: operation === "upgrade"
      ? [marketplaceListArgs, removeMarketplaceArgs, addArgs, installArgs, statusArgs]
        .map((args) => formatShellCommand("codex", args))
      : [],
    legacyPluginRepairCommands: operation === "upgrade"
      ? [uninstallArgs, installArgs, statusArgs]
        .map((args) => formatShellCommand("codex", args))
      : [],
    executedCommands: executedArgs.map((args) => formatShellCommand("codex", args)),
    cliResults: commandResults.map((result, index) => ({
      command: formatShellCommand("codex", result.args),
      output: parsedResults[index],
    })),
    cliMode: cliCapability?.mode ?? null,
    cliVersion: cliCapability?.version ?? null,
    installedPluginPath,
    installedVersion,
    availableVersion,
    updatePending,
    marketplaceMigration,
    legacyPluginBackupPath,
    installCommand,
    updateCommand: upgradeCommand,
    statusCommand,
    uninstallCommand,
    marketplaceName: codexMarketplacePluginName,
    pluginName: codexMarketplacePluginName,
    pluginId,
    nextSteps,
  };
  const text = [
    `Codex Git marketplace：${operationLabel[operation]}${executed ? "完成" : "计划"}`,
    `来源：${source}`,
    ...(opts.ref ? [`Ref：${opts.ref}`] : []),
    ...plannedCommands.map((command) => `- ${command}`),
    ...(cliCapability
      ? [`CLI：${cliCapability.version ?? "unknown"}（${cliCapability.mode}）`]
      : []),
    ...nextSteps.map((step) => `下一步：${step}`),
  ].join("\n");

  if (options.emit !== false) {
    emitOutput(format, payload, text);
  }

  return {
    operation,
    executed,
    payload,
    text,
    installedPluginPath,
    installedVersion,
    availableVersion,
    updatePending,
  };
}

function buildCodexPluginCompanionPayload(args: {
  readonly mode: "plan" | "result";
  readonly overallStatus: "planned" | "complete" | "partial" | "update-pending";
  readonly pluginResult: CodexPluginLifecycleResult;
  readonly agents: Record<string, unknown>;
  readonly phases: readonly Record<string, unknown>[];
}) {
  return {
    mode: args.mode,
    action: "codex-plugin-companion",
    target: "codex",
    operation: args.pluginResult.operation,
    overallStatus: args.overallStatus,
    plugin: {
      status: args.mode === "plan" ? "planned" : "complete",
      version: args.pluginResult.installedVersion,
      availableVersion: args.pluginResult.availableVersion,
      installedPath: args.pluginResult.installedPluginPath,
      updatePending: args.pluginResult.updatePending,
      lifecycle: args.pluginResult.payload,
    },
    agents: args.agents,
    phases: args.phases,
  };
}

async function runCodexPluginWithAgents(opts: PlatformPluginOpts): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  const pluginResult = await runCodexMarketplaceGitMode(opts, { emit: false });

  if (!pluginResult.executed) {
    const payload = buildCodexPluginCompanionPayload({
      mode: "plan",
      overallStatus: "planned",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "planned",
      },
      phases: [
        { name: "plugin-lifecycle", status: "planned" },
        { name: "agents-lifecycle", status: "planned" },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        `Codex 插件与 companion agents ${pluginResult.operation}计划`,
        pluginResult.text,
        "Companion agents：计划写入 Codex 全局目录",
      ].join("\n"),
    );
    return;
  }

  const targetResolution = await resolveInstallTarget("codex", {
    cwd: process.cwd(),
    global: true,
  });
  const root = resolve(targetResolution.root);
  const receiptPath = resolveCodexAgentsReceiptPath(root, "global");
  let existingReceipt: CodexAgentsReceipt | null;
  try {
    existingReceipt = await readCodexAgentsReceipt(receiptPath, {
      root,
      scope: "global",
    });
  } catch (error) {
    process.exitCode = 1;
    const reason = error instanceof Error ? error.message : "unknown companion receipt error";
    const payload = buildCodexPluginCompanionPayload({
      mode: "result",
      overallStatus: "partial",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "failed",
        reason,
        receiptPath,
      },
      phases: [
        { name: "plugin-lifecycle", status: "complete" },
        { name: "agents-lifecycle", status: "failed", reason },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        "Codex 插件处理完成，但 companion agents 回执校验失败",
        `原因：${reason}`,
        "请检查或备份损坏回执后，再重试同一命令",
      ].join("\n"),
    );
    return;
  }

  if (pluginResult.operation === "uninstall") {
    try {
      const ownedPaths = existingReceipt
        ? getCodexAgentsReceiptOwnedPaths(existingReceipt)
        : [];
      const removal = await removeManagedPaths(ownedPaths);
      const configResult = await stripCodexAgentConfigFile(
        join(root, "config.toml"),
        false,
        existingReceipt?.managedAgentNames ?? [],
      );
      await deleteCodexAgentsReceipt(receiptPath);
      const payload = buildCodexPluginCompanionPayload({
        mode: "result",
        overallStatus: "complete",
        pluginResult,
        agents: {
          requested: true,
          scope: "global",
          status: "complete",
          receiptInstalled: existingReceipt !== null,
          receiptPath,
          receiptRemoved: true,
          removed: removal.removed,
          missing: removal.missing,
          configChanged: configResult.changed,
          configMissing: configResult.missing,
        },
        phases: [
          { name: "plugin-lifecycle", status: "complete" },
          { name: "agents-lifecycle", status: "complete" },
          { name: "postflight", status: "complete" },
        ],
      });
      emitOutput(
        format,
        payload,
        [
          "Codex 插件与 receipt-owned companion agents 卸载完成",
          `Agents：移除 ${removal.removed}，原本缺失 ${removal.missing}`,
          "未受回执管理的本地 zc-*.toml 保持不变",
        ].join("\n"),
      );
    } catch (error) {
      process.exitCode = 1;
      const reason = error instanceof Error ? error.message : "unknown companion uninstall error";
      const payload = buildCodexPluginCompanionPayload({
        mode: "result",
        overallStatus: "partial",
        pluginResult,
        agents: {
          requested: true,
          scope: "global",
          status: "failed",
          reason,
          receiptPath,
        },
        phases: [
          { name: "plugin-lifecycle", status: "complete" },
          { name: "agents-lifecycle", status: "failed", reason },
        ],
      });
      emitOutput(
        format,
        payload,
        [
          "Codex 插件已卸载，但 companion agents 清理失败",
          `原因：${reason}`,
          "可修复文件权限或配置后单独运行 `zc platform agents codex --uninstall --global`",
        ].join("\n"),
      );
    }
    return;
  }

  if (pluginResult.operation === "upgrade" && pluginResult.updatePending) {
    const payload = buildCodexPluginCompanionPayload({
      mode: "result",
      overallStatus: "update-pending",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "unchanged",
        reason: "plugin-update-pending",
        pluginVersion: existingReceipt?.pluginVersion ?? null,
        receiptInstalled: existingReceipt !== null,
        receiptPath,
      },
      phases: [
        { name: "plugin-lifecycle", status: "update-pending" },
        {
          name: "agents-lifecycle",
          status: "unchanged",
          reason: "plugin-update-pending",
        },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        "Codex marketplace 已刷新，但插件仍有待应用的新版本",
        "Companion agents 保持不变，避免先于已安装插件版本更新",
        "请在 Plugins 页面完成插件更新后重试同一命令",
      ].join("\n"),
    );
    return;
  }

  const installedPluginPath = pluginResult.installedPluginPath
    ?? (pluginResult.operation === "status" || pluginResult.operation === "upgrade"
      ? existingReceipt?.installedPluginPath ?? null
      : null);

  if (!installedPluginPath) {
    process.exitCode = 1;
    const payload = buildCodexPluginCompanionPayload({
      mode: "result",
      overallStatus: "partial",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "skipped",
        reason: "installed-plugin-path-unavailable",
        receiptPath,
      },
      phases: [
        { name: "plugin-lifecycle", status: "complete" },
        {
          name: "agents-lifecycle",
          status: "skipped",
          reason: "installed-plugin-path-unavailable",
        },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        "Codex 插件安装完成，但 companion agents 未同步",
        "原因：官方 CLI 结果未返回 installedPath，无法证明 agent 资产与已安装插件版本一致",
        "下一步：运行 `zc platform plugin codex --status --with-agents --json` 复查",
      ].join("\n"),
    );
    return;
  }

  try {
    const companion = await loadCodexAgentCompanion(installedPluginPath);
    if (
      pluginResult.installedVersion
      && companion.pluginVersion !== pluginResult.installedVersion
    ) {
      throw new Error(
        `companion 版本 ${companion.pluginVersion} 与已安装插件版本 ${pluginResult.installedVersion} 不一致`,
      );
    }
    const plan = createCodexCompanionAgentInstallPlan(companion, {
      root,
      scope: "global",
    });

    if (pluginResult.operation === "status") {
      const status = await inspectCodexAgents(plan, root, existingReceipt);
      const payload = buildCodexPluginCompanionPayload({
        mode: "result",
        overallStatus: status.kind === "up-to-date" ? "complete" : "partial",
        pluginResult,
        agents: {
          requested: true,
          scope: "global",
          status: status.kind,
          pluginVersion: companion.pluginVersion,
          installedPluginPath: companion.installedPluginPath,
          contentFingerprint: companion.contentFingerprint,
          receiptPath,
          receiptInstalled: existingReceipt !== null,
          summary: status.summary,
          staleAgentFiles: status.staleAgentFiles,
          untrackedAgentFiles: status.untrackedAgentFiles,
          artifactStatus: status.artifacts,
        },
        phases: [
          { name: "plugin-lifecycle", status: "complete" },
          {
            name: "agents-lifecycle",
            status: status.kind === "up-to-date" ? "complete" : "needs-attention",
          },
          { name: "postflight", status: "complete" },
        ],
      });
      emitOutput(
        format,
        payload,
        [
          "Codex 插件与 companion agents 状态检查完成",
          `插件版本：${pluginResult.installedVersion ?? companion.pluginVersion}`,
          `Agents 状态：${status.kind}`,
          `Agents 回执：${receiptPath}`,
        ].join("\n"),
      );
      return;
    }

    const writeResult = await writePlatformArtifacts(
      "codex",
      plan.artifacts,
      {
        dryRun: false,
        overwrite: "force",
        managedAgentNames: existingReceipt?.managedAgentNames ?? [],
      },
    );
    const receipt = createCodexAgentsReceipt({
      root,
      scope: "global",
      pluginId: companion.pluginId,
      pluginVersion: companion.pluginVersion,
      installedPluginPath: companion.installedPluginPath,
      contentFingerprint: companion.contentFingerprint,
      artifacts: plan.artifacts,
    });
    await writeCodexAgentsReceipt(receiptPath, receipt);
    const payload = buildCodexPluginCompanionPayload({
      mode: "result",
      overallStatus: pluginResult.updatePending ? "update-pending" : "complete",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "complete",
        pluginVersion: companion.pluginVersion,
        installedPluginPath: companion.installedPluginPath,
        contentFingerprint: companion.contentFingerprint,
        receiptPath,
        ...writeResult,
      },
      phases: [
        { name: "plugin-lifecycle", status: "complete" },
        { name: "agents-lifecycle", status: "complete" },
        { name: "postflight", status: "complete" },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        "Codex 插件与 companion agents 处理完成",
        `插件版本：${companion.pluginVersion}`,
        `Agents 回执：${receiptPath}`,
        `写入结果：新增 ${writeResult.created}，覆盖 ${writeResult.overwritten}，未变更 ${writeResult.unchanged}`,
      ].join("\n"),
    );
  } catch (error) {
    process.exitCode = 1;
    const reason = error instanceof Error ? error.message : "unknown companion error";
    const payload = buildCodexPluginCompanionPayload({
      mode: "result",
      overallStatus: "partial",
      pluginResult,
      agents: {
        requested: true,
        scope: "global",
        status: "failed",
        reason,
        receiptPath,
      },
      phases: [
        { name: "plugin-lifecycle", status: "complete" },
        { name: "agents-lifecycle", status: "failed", reason },
      ],
    });
    emitOutput(
      format,
      payload,
      [
        "Codex 插件处理完成，但 companion agents 同步失败",
        `原因：${reason}`,
        "可以修复 agent 资产后幂等重试同一命令；不会自动回滚已安装插件",
      ].join("\n"),
    );
  }
}

/*
 * Keep plugin lifecycle execution above separate from local bundle generation:
 * the official CLI owns installed plugin/cache state, while zc owns only the
 * generated local marketplace artifacts.
 */

type CodexPluginUninstallTargetKind = "plugin-dir" | "marketplace-file" | "entry-file" | "agent-file";

interface CodexPluginUninstallTarget {
  readonly path: string;
  readonly kind: CodexPluginUninstallTargetKind;
  readonly expectedContent?: string;
}

interface CodexPluginSkippedPath {
  readonly path: string;
  readonly kind: CodexPluginUninstallTargetKind;
  readonly reason: "drifted" | "unknown-file";
}

const templateFilesMarketplacePath = ".agents/plugins/marketplace.json";

function isCodexPluginManifestArtifactPath(path: string): boolean {
  return path.replace(/\\/g, "/").endsWith(codexPluginManifestPath);
}

function isCodexMarketplaceManifestArtifactPath(path: string): boolean {
  return path.replace(/\\/g, "/").endsWith(templateFilesMarketplacePath);
}

function isCodexPluginEntryArtifactPath(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  return normalizedPath === "AGENTS.md" || normalizedPath.endsWith("/AGENTS.md");
}

function resolveCodexPluginRootFromManifestPath(path: string): string {
  return dirname(dirname(path));
}

function isPathWithin(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function getExpectedArtifactsInDirectory(
  directory: string,
  artifacts: readonly GeneratedArtifact[],
): readonly GeneratedArtifact[] {
  return artifacts.filter((artifact) => isPathWithin(directory, artifact.path));
}

async function listUnexpectedPluginDirectoryPaths(
  directory: string,
  expectedPaths: ReadonlySet<string>,
): Promise<readonly string[]> {
  const unexpectedPaths: string[] = [];

  async function visit(currentDirectory: string): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      if (hasNodeErrorCode(error, "ENOENT")) {
        return;
      }

      if (hasNodeErrorCode(error, "ENOTDIR")) {
        unexpectedPaths.push(currentDirectory);
        return;
      }

      throw error;
    }

    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        const hasExpectedDescendant = [...expectedPaths].some((expectedPath) => (
          expectedPath === entryPath || isPathWithin(entryPath, expectedPath)
        ));

        if (!hasExpectedDescendant) {
          unexpectedPaths.push(entryPath);
          continue;
        }

        await visit(entryPath);
        continue;
      }

      if (!expectedPaths.has(entryPath)) {
        unexpectedPaths.push(entryPath);
      }
    }
  }

  await visit(directory);
  return unexpectedPaths;
}

async function inspectCodexPluginDirectoryForRemoval(
  target: CodexPluginUninstallTarget,
  expectedArtifacts: readonly GeneratedArtifact[],
): Promise<readonly CodexPluginSkippedPath[]> {
  const directoryArtifacts = getExpectedArtifactsInDirectory(target.path, expectedArtifacts);
  const expectedPaths = new Set(directoryArtifacts.map((artifact) => artifact.path));
  const skipped: CodexPluginSkippedPath[] = [];

  const unexpectedPaths = await listUnexpectedPluginDirectoryPaths(target.path, expectedPaths);
  skipped.push(...unexpectedPaths.map((path) => ({
    path,
    kind: target.kind,
    reason: "unknown-file" as const,
  })));

  for (const artifact of directoryArtifacts) {
    const existing = await readTextIfExists(artifact.path);

    if (existing !== null && existing !== artifact.content) {
      skipped.push({
        path: artifact.path,
        kind: target.kind,
        reason: "drifted",
      });
    }
  }

  return skipped;
}

function buildCodexPluginUninstallTargets(
  plan: PlatformPlanLike,
  options: {
    readonly includeAgents: boolean;
  },
): readonly CodexPluginUninstallTarget[] {
  const targets: CodexPluginUninstallTarget[] = [];

  for (const artifact of plan.artifacts) {
    if (isCodexPluginManifestArtifactPath(artifact.path)) {
      targets.push({
        path: resolveCodexPluginRootFromManifestPath(artifact.path),
        kind: "plugin-dir",
      });
      continue;
    }

    if (isCodexMarketplaceManifestArtifactPath(artifact.path)) {
      targets.push({
        path: artifact.path,
        kind: "marketplace-file",
        expectedContent: artifact.content,
      });
      continue;
    }

    if (isCodexPluginEntryArtifactPath(artifact.path)) {
      targets.push({
        path: artifact.path,
        kind: "entry-file",
        expectedContent: artifact.content,
      });
      continue;
    }

    if (options.includeAgents && isCodexAgentTomlPath(artifact.path)) {
      targets.push({
        path: artifact.path,
        kind: "agent-file",
        expectedContent: artifact.content,
      });
    }
  }

  return [...new Map(targets.map((target) => [target.path, target])).values()];
}

async function resolveCodexPluginRemovableTargets(
  targets: readonly CodexPluginUninstallTarget[],
  expectedArtifacts: readonly GeneratedArtifact[],
  force: boolean,
): Promise<{
  readonly removable: readonly CodexPluginUninstallTarget[];
  readonly skipped: readonly CodexPluginSkippedPath[];
}> {
  const removable: CodexPluginUninstallTarget[] = [];
  const skipped: CodexPluginSkippedPath[] = [];

  for (const target of targets) {
    if (target.kind === "plugin-dir" && !force) {
      const skippedPaths = await inspectCodexPluginDirectoryForRemoval(target, expectedArtifacts);

      if (skippedPaths.length === 0) {
        removable.push(target);
      } else {
        skipped.push(...skippedPaths);
      }

      continue;
    }

    if (!target.expectedContent || force) {
      removable.push(target);
      continue;
    }

    const existing = await readTextIfExists(target.path);
    if (existing === null || existing === target.expectedContent) {
      removable.push(target);
      continue;
    }

    skipped.push({
      path: target.path,
      kind: target.kind,
      reason: "drifted",
    });
  }

  return {
    removable,
    skipped,
  };
}

function buildCodexPluginUninstallPayload(args: {
  readonly mode: "plan" | "result";
  readonly root: string;
  readonly metadata: PlatformResolutionMetadata;
  readonly includeAgents: boolean;
  readonly force: boolean;
  readonly targets: readonly CodexPluginUninstallTarget[];
  readonly skipped: readonly CodexPluginSkippedPath[];
  readonly removed: number;
  readonly missing: number;
  readonly configChanged?: boolean;
  readonly configMissing?: boolean;
  readonly agentConfigPath?: string;
  readonly agentsReceiptPath?: string;
  readonly agentsReceiptInstalled?: boolean;
}) {
  return {
    mode: args.mode,
    action: "plugin",
    operation: "uninstall",
    target: "codex",
    root: args.root,
    scope: args.metadata.scope ?? "project",
    rootSource: args.metadata.rootSource ?? (args.metadata.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: args.metadata.autoResolvedRoot ?? false,
    hint: args.metadata.hint ?? null,
    includeAgents: args.includeAgents,
    force: args.force,
    removed: args.removed,
    missing: args.missing,
    configChanged: args.configChanged ?? false,
    configMissing: args.configMissing ?? false,
    agentConfigPath: args.agentConfigPath ?? null,
    agentsReceiptPath: args.agentsReceiptPath ?? null,
    agentsReceiptInstalled: args.agentsReceiptInstalled ?? false,
    targets: args.targets,
    skipped: args.skipped,
  };
}

function summarizeCodexPluginUninstall(args: {
  readonly mode: "plan" | "result";
  readonly root: string;
  readonly metadata: PlatformResolutionMetadata;
  readonly includeAgents: boolean;
  readonly targets: readonly CodexPluginUninstallTarget[];
  readonly skipped: readonly CodexPluginSkippedPath[];
  readonly removed: number;
  readonly missing: number;
  readonly configChanged?: boolean;
  readonly configMissing?: boolean;
}): string {
  const lines = [
    `Codex local plugin bundle 卸载${args.mode === "plan" ? "计划" : "完成"}`,
    `范围：${args.metadata.scope ?? "project"}`,
    `目录：${args.root}`,
    ...(args.metadata.hint ? [`提示：${args.metadata.hint}`] : []),
    `包含 custom agents：${args.includeAgents ? "yes" : "no"}`,
    args.mode === "plan"
      ? `计划删除目标：${args.targets.length}`
      : `删除目标：已删除 ${args.removed}，原本缺失 ${args.missing}，跳过 ${args.skipped.length}`,
  ];

  if (args.includeAgents) {
    lines.push(
      `配置清理：${args.configChanged ? "已移除 [agents.zc_*]" : args.configMissing ? "config.toml 不存在" : "无需变更"}`,
    );
  }

  if (args.skipped.length > 0) {
    lines.push("跳过目标：");
    lines.push(...args.skipped.map((item) => `- ${item.path} (${item.reason})`));
    lines.push("如确认要删除漂移或未知文件，请追加 --force。");
  }

  if (args.mode === "plan") {
    lines.push(...args.targets.map((target) => `- ${target.kind}: ${target.path}`));
  }

  lines.push(
    args.includeAgents
      ? "下一步：运行 `zc platform agents codex --status` 复查 agents 状态。"
      : "下一步：custom agents 已保留；如需清理，运行 `zc platform agents codex --uninstall --plan` 或本命令追加 `--include-agents`。",
  );

  return lines.join("\n");
}

async function createCodexMarketplacePlanForPluginOperation(
  root: string,
  scope: PlatformInstallScope,
): Promise<PlatformPlanLike> {
  const manifest = await loadToolkitManifest();
  const platformModule = await loadPlatformModule("codex");

  if (!platformModule.createCodexMarketplaceGenerationPlan) {
    throw new Error("Codex 平台包未导出 createCodexMarketplaceGenerationPlan()");
  }

  const plan = finalizePlan(platformModule.createCodexMarketplaceGenerationPlan(manifest, {
    manifestSource: manifest.source,
    pluginVersion: getCliVersion(),
    extensionVersion: getCliVersion(),
    scope: scope === "global" ? "global" : "project",
  }));

  return {
    ...plan,
    artifacts: plan.artifacts.map((artifact) => resolveGenerateArtifact(root, artifact)),
  };
}

async function runCodexPluginLocalUninstall(opts: PlatformPluginOpts): Promise<void> {
  const format = resolveOutputFormat(opts.json);
  const useProject = opts.project || (!opts.dir && !opts.global);
  const outputTarget = await resolveGenerateOutputRoot("codex", {
    dir: opts.dir,
    project: useProject,
    global: opts.global,
    bundle: "codex-marketplace",
  });
  const root = outputTarget.root;
  const metadata = outputTarget.metadata;
  const plan = await createCodexMarketplacePlanForPluginOperation(root, metadata.scope ?? "project");
  const includeAgents = Boolean(opts.includeAgents);
  const agents = includeAgents
    ? await inspectReceiptManagedCodexAgents(root, metadata.scope ?? "project")
    : null;
  let targets = [
    ...buildCodexPluginUninstallTargets(plan, { includeAgents: false }),
    ...(agents?.ownedPaths.map((path) => ({
      path,
      kind: "agent-file" as const,
    })) ?? []),
  ];

  targets = [...new Map(targets.map((target) => [target.path, target])).values()];
  const resolvedTargets = await resolveCodexPluginRemovableTargets(targets, plan.artifacts, Boolean(opts.force));

  if (opts.plan) {
    const configResult = agents
      ? await stripCodexAgentConfigFile(
        agents.configPath,
        true,
        agents.receipt?.managedAgentNames ?? [],
      )
      : { changed: false, missing: false };
    emitOutput(
      format,
      buildCodexPluginUninstallPayload({
        mode: "plan",
        root,
        metadata,
        includeAgents,
        force: Boolean(opts.force),
        targets: resolvedTargets.removable,
        skipped: resolvedTargets.skipped,
        removed: 0,
        missing: 0,
        configChanged: configResult.changed,
        configMissing: configResult.missing,
        agentConfigPath: agents?.configPath,
        agentsReceiptPath: agents?.receiptPath,
        agentsReceiptInstalled: Boolean(agents?.receipt),
      }),
      summarizeCodexPluginUninstall({
        mode: "plan",
        root,
        metadata,
        includeAgents,
        targets: resolvedTargets.removable,
        skipped: resolvedTargets.skipped,
        removed: 0,
        missing: 0,
        configChanged: configResult.changed,
        configMissing: configResult.missing,
      }),
    );
    return;
  }

  const removal = await removeManagedPaths(resolvedTargets.removable.map((target) => target.path));
  const configResult = agents
    ? await stripCodexAgentConfigFile(
      agents.configPath,
      false,
      agents.receipt?.managedAgentNames ?? [],
    )
    : { changed: false, missing: false };

  if (agents) {
    await deleteCodexAgentsReceipt(agents.receiptPath);
  }

  emitOutput(
    format,
    buildCodexPluginUninstallPayload({
      mode: "result",
      root,
      metadata,
      includeAgents,
      force: Boolean(opts.force),
      targets: resolvedTargets.removable,
      skipped: resolvedTargets.skipped,
      removed: removal.removed,
      missing: removal.missing,
      configChanged: includeAgents ? configResult.changed : false,
      configMissing: includeAgents ? configResult.missing : false,
      agentConfigPath: agents?.configPath,
      agentsReceiptPath: agents?.receiptPath,
      agentsReceiptInstalled: Boolean(agents?.receipt),
    }),
    summarizeCodexPluginUninstall({
      mode: "result",
      root,
      metadata,
      includeAgents,
      targets: resolvedTargets.removable,
      skipped: resolvedTargets.skipped,
      removed: removal.removed,
      missing: removal.missing,
      configChanged: includeAgents ? configResult.changed : false,
      configMissing: includeAgents ? configResult.missing : false,
    }),
  );
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
    installMethod: metadata?.installMethod ?? "filesystem",
    installSource: metadata?.installSource ?? null,
    sourceRef: metadata?.sourceRef ?? null,
    bundleType: metadata?.bundleType ?? null,
    bundlePath: metadata?.bundlePath ?? null,
    receiptPath: metadata?.receiptPath ?? null,
    zcVersion: metadata?.zcVersion ?? null,
    status: metadata?.status ?? null,
    noop: metadata?.noop ?? false,
    contentFingerprint: metadata?.contentFingerprint ?? null,
    ...result,
  };
}

function shouldPreferQwenOfficialCli(target: PlatformName, scope: PlatformInstallScope): boolean {
  return target === "qwen" && scope === "global";
}

function shouldPreferQwenOfficialRepoInstall(target: PlatformName, scope: PlatformInstallScope): boolean {
  return shouldPreferQwenOfficialCli(target, scope);
}

function estimateManagedInstallResult(
  plan: InstallPlan,
  status: PlatformInstallStatusResult,
): {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
} {
  if (status.kind === "not-installed") {
    return {
      created: plan.artifacts.length,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    };
  }

  let created = 0;
  let overwritten = 0;
  let unchanged = 0;

  for (const artifact of status.artifacts) {
    if (artifact.plannedSha256 === null) {
      continue;
    }

    if (artifact.actualSha256 === artifact.plannedSha256) {
      unchanged += 1;
      continue;
    }

    if (artifact.actualSha256 === null) {
      created += 1;
      continue;
    }

    overwritten += 1;
  }

  return {
    created,
    overwritten,
    unchanged,
    skipped: 0,
    dryRun: false,
  };
}

function summarizeWhere(target: PlatformName, root: string, metadata: {
  rootSource: string;
  hint?: string;
  scope: PlatformInstallScope;
  marker?: string;
  capability?: ReturnType<typeof getPlanCapabilitySummary>;
}): string {
  const lines = [
    `${target} 安装目标`,
    `范围：${metadata.scope}`,
    `解析来源：${metadata.rootSource}`,
    ...(metadata.marker ? [`命中标记：${metadata.marker}`] : []),
    `目录：${root}`,
    ...(metadata.capability
      ? [
          `命名空间：${metadata.capability.namespace}`,
          `入口形式：${metadata.capability.exposure.entryPattern}`,
          `安装面：${metadata.capability.surfaces.map((surface) => formatSurfaceLabel(surface)).join("、")}`,
          `示例映射：${metadata.capability.exposure.examples.join("；")}`,
        ]
      : []),
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
  ];
  const nextStep = buildNextStep("where", target, root, {
    scope: metadata.scope,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function buildWherePayload(target: PlatformName, root: string, metadata: {
  rootSource: string;
  hint?: string;
  scope: PlatformInstallScope;
  marker?: string;
  capability?: ReturnType<typeof getPlanCapabilitySummary>;
}): object {
  return {
    mode: "where",
    target,
    scope: metadata.scope,
    root,
    rootSource: metadata.rootSource,
    marker: metadata.marker ?? null,
    hint: metadata.hint ?? null,
    capability: metadata.capability ?? null,
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
  plan: PlatformPlanLike;
  installMethod?: "filesystem" | "qwen-cli";
  installSource?: "github-repo" | "local-bundle";
  sourceRef?: string;
  bundleType?: "source-bundle" | "release-bundle";
  bundlePath?: string;
  recommendedInstallMethod?: "filesystem" | "qwen-cli";
  recommendedInstallSource?: "github-repo" | "local-bundle";
  recommendedSourceRef?: string;
  recommendedBundleType?: "source-bundle" | "release-bundle";
  recommendedBundlePath?: string;
}): string {
  const lines = [
    `${target} 安装状态`,
    `范围：${metadata.scope}`,
    `目录：${root}`,
    `状态：${status.kind}（${formatStatusLabel(status.kind)}）`,
    `回执：${status.receiptPath}`,
    ...(metadata.installMethod ? [`安装方式：${formatInstallMethodLabel(metadata.installMethod)}`] : []),
    ...(metadata.installSource ? [`安装来源：${formatInstallSourceLabel(metadata.installSource)}`] : []),
    ...(metadata.sourceRef ? [`来源：${metadata.sourceRef}`] : []),
    ...(metadata.bundleType ? [`Bundle 类型：${formatBundleTypeLabel(metadata.bundleType)}`] : []),
    ...(metadata.bundlePath ? [`Bundle 目录：${metadata.bundlePath}`] : []),
    ...(metadata.recommendedInstallMethod ? [`推荐安装方式：${formatInstallMethodLabel(metadata.recommendedInstallMethod)}`] : []),
    ...(metadata.recommendedInstallSource ? [`推荐来源：${formatInstallSourceLabel(metadata.recommendedInstallSource)}`] : []),
    ...(metadata.recommendedSourceRef ? [`推荐来源地址：${metadata.recommendedSourceRef}`] : []),
    ...(metadata.recommendedBundleType ? [`推荐 Bundle：${formatBundleTypeLabel(metadata.recommendedBundleType)}`] : []),
    ...(metadata.recommendedBundlePath ? [`推荐 Bundle 目录：${metadata.recommendedBundlePath}`] : []),
    `跟踪产物：${status.summary.trackedArtifacts}，漂移：${status.summary.driftedArtifacts}，缺失：${status.summary.missingArtifacts}，待更新：${status.summary.plannedChanges}`,
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
  ];
  const nextStep = buildNextStep("status", target, root, {
    scope: metadata.scope,
    status: status.kind,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function buildStatusPayload(target: PlatformName, root: string, status: PlatformInstallStatusResult, metadata: {
  scope: PlatformInstallScope;
  rootSource: string;
  hint?: string;
  zcVersion?: string;
  plan: PlatformPlanLike;
  installMethod?: "filesystem" | "qwen-cli";
  installSource?: "github-repo" | "local-bundle";
  sourceRef?: string;
  bundleType?: "source-bundle" | "release-bundle";
  bundlePath?: string;
  recommendedInstallMethod?: "filesystem" | "qwen-cli";
  recommendedInstallSource?: "github-repo" | "local-bundle";
  recommendedSourceRef?: string;
  recommendedBundleType?: "source-bundle" | "release-bundle";
  recommendedBundlePath?: string;
}) {
  return {
    mode: "status",
    target,
    scope: metadata.scope,
    root,
    rootSource: metadata.rootSource,
    hint: metadata.hint ?? null,
    capability: getPlanCapabilitySummary(metadata.plan),
    installMethod: metadata.installMethod ?? null,
    installSource: metadata.installSource ?? null,
    sourceRef: metadata.sourceRef ?? null,
    bundleType: metadata.bundleType ?? null,
    bundlePath: metadata.bundlePath ?? null,
    recommendedInstallMethod: metadata.recommendedInstallMethod ?? null,
    recommendedInstallSource: metadata.recommendedInstallSource ?? null,
    recommendedSourceRef: metadata.recommendedSourceRef ?? null,
    recommendedBundleType: metadata.recommendedBundleType ?? null,
    recommendedBundlePath: metadata.recommendedBundlePath ?? null,
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

function summarizeDoctor(
  target: PlatformName,
  root: string,
  status: PlatformInstallStatusResult,
  doctor: PlatformInstallDoctorResult,
  metadata: {
    scope: PlatformInstallScope;
    rootSource: string;
    hint?: string;
    plan: PlatformPlanLike;
  },
): string {
  const lines = [
    `${target} 安装诊断`,
    `范围：${metadata.scope}`,
    `目录：${root}`,
    `状态：${status.kind}（${formatStatusLabel(status.kind)}）`,
    `健康度：${doctor.health}`,
    ...(doctor.issues.length > 0
      ? doctor.issues.flatMap((issue) => [
          `- [${issue.severity}] ${issue.code}: ${issue.message}`,
          ...(issue.paths && issue.paths.length > 0 ? issue.paths.map((path) => `  - ${path}`) : []),
        ])
      : ["- 未发现需要处理的问题。"]),
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
  ];
  const nextStep = buildNextStep("doctor", target, root, {
    scope: metadata.scope,
    status: status.kind,
    health: doctor.health,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function buildDoctorPayload(
  target: PlatformName,
  root: string,
  status: PlatformInstallStatusResult,
  doctor: PlatformInstallDoctorResult,
  metadata: {
    scope: PlatformInstallScope;
    rootSource: string;
    hint?: string;
    plan: PlatformPlanLike;
  },
) {
  return {
    mode: "doctor",
    target,
    scope: metadata.scope,
    root,
    rootSource: metadata.rootSource,
    hint: metadata.hint ?? null,
    capability: getPlanCapabilitySummary(metadata.plan),
    status: status.kind,
    health: doctor.health,
    receiptPath: status.receiptPath,
    issues: doctor.issues,
    summary: status.summary,
  };
}

function summarizeUninstall(
  target: PlatformName,
  root: string,
  result: {
    removedArtifacts: number;
    missingArtifacts: number;
    bundleRemoved: boolean;
    bundleMissing: boolean;
    receiptRemoved: boolean;
    receiptMissing: boolean;
  },
  metadata: PlatformResolutionMetadata & {
    receiptPath: string;
    installMethod?: "filesystem" | "qwen-cli";
    installSource?: "github-repo" | "local-bundle" | null;
    sourceRef?: string | null;
    bundlePath?: string | null;
  },
): string {
  const lines = [
    `${target} 卸载完成`,
    formatRootLabel("uninstall", root, metadata),
    ...(metadata.installMethod ? [`安装方式：${formatInstallMethodLabel(metadata.installMethod)}`] : []),
    ...(metadata.installSource ? [`安装来源：${formatInstallSourceLabel(metadata.installSource)}`] : []),
    ...(metadata.sourceRef ? [`来源：${metadata.sourceRef}`] : []),
    ...(metadata.bundlePath ? [`Bundle 目录：${metadata.bundlePath}`] : []),
    `回执：${metadata.receiptPath}`,
    ...(metadata.hint ? [`提示：${metadata.hint}`] : []),
    `移除受管产物 ${result.removedArtifacts}，原本缺失 ${result.missingArtifacts}`,
    `Bundle：${result.bundleRemoved ? "已删除" : result.bundleMissing ? "本就不存在" : "未涉及"}`,
    `回执：${result.receiptRemoved ? "已删除" : result.receiptMissing ? "本就不存在" : "未涉及"}`,
  ];
  const nextStep = buildNextStep("uninstall", target, root, {
    scope: metadata.scope,
  });
  if (nextStep) {
    lines.push(nextStep);
  }
  return lines.join("\n");
}

function buildUninstallPayload(
  target: PlatformName,
  root: string,
  result: {
    removedArtifacts: number;
    missingArtifacts: number;
    bundleRemoved: boolean;
    bundleMissing: boolean;
    receiptRemoved: boolean;
    receiptMissing: boolean;
  },
  metadata: PlatformResolutionMetadata & {
    receiptPath: string;
    installMethod?: "filesystem" | "qwen-cli";
    installSource?: "github-repo" | "local-bundle" | null;
    sourceRef?: string | null;
    bundlePath?: string | null;
  },
) {
  return {
    mode: "result",
    action: "uninstall",
    target,
    root,
    scope: metadata.scope ?? "project",
    rootSource: metadata.rootSource ?? (metadata.autoResolvedRoot ? "project-root" : "explicit"),
    autoResolvedRoot: metadata.autoResolvedRoot ?? false,
    hint: metadata.hint ?? null,
    installMethod: metadata.installMethod ?? null,
    installSource: metadata.installSource ?? null,
    sourceRef: metadata.sourceRef ?? null,
    bundlePath: metadata.bundlePath ?? null,
    receiptPath: metadata.receiptPath,
    ...result,
  };
}

export async function runPlatformAgents(
  target: PlatformName,
  opts: PlatformAgentsOpts,
): Promise<void> {
  const format = resolveOutputFormat(opts.json);

  try {
    assertCodexAgentsTarget(target);
    const operation = resolveCodexAgentsOperation(opts);
    const scope = resolveScopeFromSelector(opts);
    const targetResolution = await resolveInstallTarget(target, {
      dir: opts.dir,
      cwd: process.cwd(),
      project: opts.project,
      global: opts.global,
    });
    const root = resolve(targetResolution.root);
    const metadata: PlatformResolutionMetadata = {
      scope,
      rootSource: targetResolution.source,
      autoResolvedRoot: !opts.dir,
      hint: targetResolution.hint,
    };
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createCodexAgentInstallPlan(platformModule, manifest, root, scope);
    const receiptPath = resolveCodexAgentsReceiptPath(root, scope);
    const receipt = await readCodexAgentsReceipt(receiptPath, {
      root,
      scope,
    });

    if (operation === "status") {
      const status = await inspectCodexAgents(plan, root, receipt);
      emitOutput(
        format,
        buildCodexAgentsPayload({
          mode: "status",
          operation,
          root,
          metadata,
          plan,
          result: {
            status: status.kind,
            summary: status.summary,
            staleAgentFiles: status.staleAgentFiles,
            untrackedAgentFiles: status.untrackedAgentFiles,
            artifactStatus: status.artifacts,
            receiptPath,
            receiptInstalled: receipt !== null,
          },
        }),
        summarizeCodexAgents({
          operation,
          root,
          metadata,
          plan,
          status,
        }),
      );
      return;
    }

    if (operation === "uninstall") {
      const configArtifact = getCodexAgentConfigArtifact(plan);
      const expectedAgentPaths = getCodexAgentFileArtifacts(plan).map((artifact) => artifact.path);
      const pathsToRemove = uniquePaths(
        receipt ? getCodexAgentsReceiptOwnedPaths(receipt) : expectedAgentPaths,
      );
      const removal = opts.plan
        ? await estimateRemovedPaths(pathsToRemove)
        : await removeManagedPaths(pathsToRemove);
      const configResult = configArtifact
        ? await stripCodexAgentConfigFile(
          configArtifact.path,
          Boolean(opts.plan),
          receipt?.managedAgentNames ?? listZcAgentConfigNames(configArtifact.content),
        )
        : { changed: false, missing: true };
      const result = {
        removed: removal.removed,
        missing: removal.missing,
        configChanged: configResult.changed,
        configMissing: configResult.missing,
        receiptPath,
        receiptRemoved: !opts.plan,
      };

      if (!opts.plan) {
        await deleteCodexAgentsReceipt(receiptPath);
      }

      emitOutput(
        format,
        buildCodexAgentsPayload({
          mode: opts.plan ? "plan" : "result",
          operation,
          root,
          metadata,
          plan: {
            ...plan,
            artifacts: [
              ...(configArtifact ? [configArtifact] : []),
              ...pathsToRemove.map((path) => ({ path, content: "" })),
            ],
          },
          result,
        }),
        summarizeCodexAgents({
          operation,
          root,
          metadata,
          plan: {
            ...plan,
            artifacts: [
              ...(configArtifact ? [configArtifact] : []),
              ...pathsToRemove.map((path) => ({ path, content: "" })),
            ],
          },
          planOnly: opts.plan,
          result,
        }),
      );
      return;
    }

    const staleAgentFiles = await listExistingZcAgentFiles(resolveCodexAgentsDir(root, plan)).then((paths) => {
      const expected = new Set(getCodexAgentFileArtifacts(plan).map((artifact) => artifact.path));
      const owned = new Set(receipt ? getCodexAgentsReceiptOwnedPaths(receipt) : []);
      return paths.filter((path) => owned.has(path) && !expected.has(path));
    });
    const writeResult = await writePlatformArtifacts(
      target,
      plan.artifacts,
      {
        dryRun: Boolean(opts.plan),
        overwrite: "force",
        managedAgentNames: receipt?.managedAgentNames ?? [],
      },
    );
    const pruneResult = opts.prune
      ? opts.plan
        ? await estimateRemovedPaths(staleAgentFiles)
        : await removeManagedPaths(staleAgentFiles)
      : { removed: 0, missing: 0 };
    const result = {
      ...writeResult,
      staleRemoved: pruneResult.removed,
      staleMissing: pruneResult.missing,
      receiptPath,
    };

    if (!opts.plan) {
      const nextReceipt = createCodexAgentsReceipt({
        root,
        scope,
        pluginId: `${codexMarketplacePluginName}@${codexMarketplacePluginName}`,
        pluginVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? getCliVersion(),
        artifacts: plan.artifacts,
      });
      await writeCodexAgentsReceipt(receiptPath, nextReceipt);
    }

    emitOutput(
      format,
      buildCodexAgentsPayload({
        mode: opts.plan ? "plan" : "result",
        operation,
        root,
        metadata,
        plan,
        result,
      }),
      summarizeCodexAgents({
        operation,
        root,
        metadata,
        plan,
        planOnly: opts.plan,
        result,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "agents",
      error instanceof Error ? `Codex custom agents 处理失败：${error.message}` : "Codex custom agents 处理失败。",
    );
    process.exitCode = 1;
  }
}

export async function runPlatformGenerate(
  target: PlatformName,
  opts: PlatformGenerateOpts
): Promise<void> {
  const format = resolveOutputFormat(opts.json);

  try {
    const outputTarget = await resolveGenerateOutputRoot(target, opts);
    const outputRoot = outputTarget.root;
    const outputMetadata = outputTarget.metadata;

    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    let plan: PlatformPlanLike = createGenerationPlan(target, platformModule, manifest);
    let bundleType: PlatformGenerateBundleType | undefined;
    let bundlePath: string | undefined;

    if (opts.bundle) {
      if (opts.bundle === "release-bundle") {
        if (target !== "qwen") {
          throw new Error(`${target} 暂不支持 release-bundle 导出。当前仅 qwen 支持 --bundle release-bundle。`);
        }

        const installPlan = createInstallPlan(target, platformModule, manifest, outputRoot, "dir", resolveOverwriteMode(opts.force));
        bundleType = opts.bundle;
        bundlePath = outputRoot;
        plan = {
          ...installPlan,
          artifacts: toQwenOfficialCliReleaseArtifacts(installPlan, outputRoot),
        };
      }

      if (opts.bundle === "codex-plugin") {
        if (target !== "codex") {
          throw new Error(`${target} 暂不支持 codex-plugin 导出。当前仅 codex 支持 --bundle codex-plugin。`);
        }
        if (!platformModule.createCodexPluginGenerationPlan) {
          throw new Error("Codex 平台包未导出 createCodexPluginGenerationPlan()");
        }

        bundleType = opts.bundle;
        bundlePath = outputRoot;
        plan = finalizePlan(platformModule.createCodexPluginGenerationPlan(manifest, {
          manifestSource: manifest.source,
          pluginVersion: getCliVersion(),
          extensionVersion: getCliVersion(),
        }));
      }

      if (opts.bundle === "codex-marketplace") {
        if (target !== "codex") {
          throw new Error(`${target} 暂不支持 codex-marketplace 导出。当前仅 codex 支持 --bundle codex-marketplace。`);
        }
        if (!platformModule.createCodexMarketplaceGenerationPlan) {
          throw new Error("Codex 平台包未导出 createCodexMarketplaceGenerationPlan()");
        }

        bundleType = opts.bundle;
        bundlePath = outputRoot;
        plan = finalizePlan(platformModule.createCodexMarketplaceGenerationPlan(manifest, {
          manifestSource: manifest.source,
          pluginVersion: getCliVersion(),
          extensionVersion: getCliVersion(),
          scope: outputMetadata.scope === "global" ? "global" : "project",
        }));
      }
    }

    if (opts.plan) {
      const outputPlan = {
        ...plan,
        artifacts: plan.artifacts.map((artifact) => resolveGenerateArtifact(outputRoot, artifact)),
      };
      emitOutput(
        format,
        buildPlanPayload("generate", target, outputRoot, outputPlan, {
          ...outputMetadata,
          bundleType,
          bundlePath,
        }),
        summarizePlan("generate", target, outputRoot, outputPlan, {
          ...outputMetadata,
          bundleType,
          bundlePath,
        }),
      );
      return;
    }

    const resolvedArtifacts = plan.artifacts.map((artifact) => resolveGenerateArtifact(outputRoot, artifact));
    await cleanupCodexPluginContentForForce(bundleType, resolvedArtifacts, opts.force);

    const result = await writePlatformArtifacts(
      target,
      resolvedArtifacts,
      {
        dryRun: false,
        overwrite: resolveOverwriteMode(opts.force)
      }
    );

    emitOutput(
      format,
      buildResultPayload("generate", target, outputRoot, result, {
        ...outputMetadata,
        bundleType,
        bundlePath,
      }),
      summarizeResult("generate", target, outputRoot, result, {
        ...outputMetadata,
        bundleType,
        bundlePath,
      }),
    );
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

export async function runPlatformPlugin(
  target: PlatformName,
  opts: PlatformPluginOpts
): Promise<void> {
  const format = resolveOutputFormat(opts.json);

  try {
    if (target !== "codex") {
      throw new Error("当前仅 Codex 支持插件 marketplace 快捷安装。");
    }

    if (
      opts.withAgents ||
      opts.git !== undefined ||
      opts.register ||
      opts.install ||
      opts.upgrade ||
      opts.status ||
      (opts.uninstall && opts.withAgents)
    ) {
      assertCodexGitMarketplaceOptions(opts);
      if (opts.withAgents) {
        await runCodexPluginWithAgents(opts);
      } else {
        await runCodexMarketplaceGitMode(opts);
      }
      return;
    }

    if (opts.uninstall) {
      assertExclusiveTargetSelector(opts);
      await runCodexPluginLocalUninstall(opts);
      return;
    }

    if (opts.includeAgents) {
      throw new Error("`--include-agents` 只能与 `--uninstall` 一起使用。");
    }

    assertExclusiveTargetSelector(opts);

    const useProject = opts.project || (!opts.dir && !opts.global);

    await runPlatformGenerate(target, {
      dir: opts.dir,
      project: useProject,
      global: opts.global,
      bundle: "codex-marketplace",
      force: opts.force,
      plan: opts.plan,
      json: opts.json,
    });
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "generate",
      error instanceof Error ? `${target} 插件处理失败：${error.message}` : `${target} 插件处理失败。`,
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

async function removeOptionalManagedPath(path: string | null | undefined): Promise<{
  removed: boolean;
  missing: boolean;
}> {
  if (!path) {
    return {
      removed: false,
      missing: false,
    };
  }

  if (!(await pathExists(path))) {
    return {
      removed: false,
      missing: true,
    };
  }

  await removeManagedPaths([path]);

  return {
    removed: true,
    missing: false,
  };
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
  let fallbackHint: string | undefined;
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
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, overwrite);
    const qwenReleaseBundlePath = shouldPreferQwenOfficialCli(target, scope)
      ? resolveQwenOfficialCliReleaseBundleDir(plan)
      : null;
    const qwenInstallSource = shouldPreferQwenOfficialRepoInstall(target, scope) ? "github-repo" : "local-bundle";

    if (opts.plan) {
      emitOutput(
        format,
        buildPlanPayload("install", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath : null,
        }),
        summarizePlan("install", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath : null,
        })
      );
      return;
    }

    if (shouldPreferQwenOfficialCli(target, scope)) {
      const status = await resolvePlatformInstallStatus(plan);

      if (status.kind === "drifted" && !opts.force) {
        emitPlatformError(
          format,
          target,
          "install",
          `${target} 安装目录已漂移。请先运行 \`zc platform status ${target}\` 检查差异，确认后追加 \`--force\` 再安装。`,
          {
            root: destinationRoot,
            receiptPath: status.receiptPath,
            status: status.kind,
          },
        );
        process.exitCode = 1;
        return;
      }

      try {
        let releaseBundleDir: string | null = null;

        if (format === "text") {
          console.log(`正在调用官方命令：qwen extensions ${status.kind === "not-installed" ? "install" : "update"} …`);
        }

        if (status.kind === "not-installed") {
          if (qwenInstallSource === "github-repo") {
            await installQwenExtensionFromOfficialRepoWithCli(qwenOfficialExtensionRepoUrl);
          } else {
            const releaseBundle = await syncQwenOfficialCliReleaseBundle(plan);
            releaseBundleDir = releaseBundle.bundleDir;
            await installQwenExtensionWithOfficialCli(releaseBundle.bundleDir);
          }
        } else if (status.kind !== "up-to-date") {
          if (qwenInstallSource === "github-repo") {
            await updateQwenExtensionWithOfficialCli(plan.capability?.extension?.name ?? "zc-toolkit");
          } else {
            const releaseBundle = await syncQwenOfficialCliReleaseBundle(plan);
            releaseBundleDir = releaseBundle.bundleDir;
            await uninstallQwenExtensionWithOfficialCli(releaseBundle.extensionName);
            await relinkQwenExtensionWithOfficialCli(releaseBundle.bundleDir);
          }
        }

        await writePlatformInstallReceiptForPlan(plan, {
          installedAt: new Date().toISOString(),
          zcVersion: getCliVersion(),
          installMethod: "qwen-cli",
          installSource: qwenInstallSource,
          sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : undefined,
          bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : undefined,
          bundlePath: qwenInstallSource === "local-bundle" ? releaseBundleDir ?? qwenReleaseBundlePath ?? undefined : undefined,
        });

        const result = status.kind === "up-to-date"
          ? {
              created: 0,
              overwritten: 0,
              unchanged: plan.artifacts.length,
              skipped: 0,
              dryRun: false,
            }
          : estimateManagedInstallResult(plan, status);

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
            status: status.kind === "up-to-date" ? status.kind : "installed",
            noop: status.kind === "up-to-date",
            installMethod: "qwen-cli",
            installSource: qwenInstallSource,
            sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
            bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : null,
            bundlePath: qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath : null,
          }),
          summarizeResult("install", target, destinationRoot, result, {
            autoResolvedRoot,
            rootSource: targetResolution.source,
            hint: targetResolution.hint,
            scope,
            receiptPath: resolvePlatformInstallReceiptPath(plan),
            zcVersion: getCliVersion(),
            contentFingerprint: plan.metadata?.fingerprint.value ?? null,
            status: status.kind === "up-to-date" ? `${status.kind}（${formatStatusLabel(status.kind)}）` : "installed",
            noop: status.kind === "up-to-date",
            installMethod: "qwen-cli",
            installSource: qwenInstallSource,
            sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
            bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : null,
            bundlePath: qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath : null,
          }),
        );
        return;
      } catch (error) {
        if (!(error instanceof QwenOfficialCliUnavailableError)) {
          throw error;
        }

        fallbackHint = "未检测到 qwen CLI，已回退为直接写入官方扩展目录。";
      }
    }

    const result = await writePlatformArtifacts(
      target,
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
        hint: mergeHints(targetResolution.hint, fallbackHint),
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: "installed",
        installMethod: "filesystem",
        installSource: null,
        sourceRef: null,
        bundleType: null,
        bundlePath: qwenReleaseBundlePath,
      }),
      summarizeResult("install", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: mergeHints(targetResolution.hint, fallbackHint),
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: "installed",
        installMethod: "filesystem",
        installSource: null,
        sourceRef: null,
        bundleType: undefined,
        bundlePath: qwenReleaseBundlePath ?? undefined,
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
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, "error");
    const status = await resolvePlatformInstallStatus(plan);
    const zcVersion = getCliVersion();
    const installMethod = status.receipt ? (status.receipt.installMethod ?? "filesystem") : undefined;
    const installSource = status.receipt?.installSource ?? undefined;
    const sourceRef = status.receipt?.sourceRef ?? undefined;
    const bundleType = status.receipt?.bundleType ?? undefined;
    const bundlePath = status.receipt?.bundlePath ?? undefined;
    const recommendedInstallMethod = shouldPreferQwenOfficialCli(target, scope) ? "qwen-cli" : undefined;
    const recommendedInstallSource = shouldPreferQwenOfficialRepoInstall(target, scope) ? "github-repo" : undefined;
    const recommendedSourceRef = recommendedInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : undefined;
    const recommendedBundleType = shouldPreferQwenOfficialCli(target, scope) ? "release-bundle" : undefined;
    const recommendedBundlePath = shouldPreferQwenOfficialCli(target, scope)
      ? resolveQwenOfficialCliReleaseBundleDir(plan)
      : undefined;

    emitOutput(
      format,
      buildStatusPayload(target, destinationRoot, status, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        zcVersion,
        plan,
        installMethod,
        installSource,
        sourceRef,
        bundleType,
        bundlePath,
        recommendedInstallMethod,
        recommendedInstallSource,
        recommendedSourceRef,
        recommendedBundleType,
        recommendedBundlePath,
      }),
      summarizeStatus(target, destinationRoot, status, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        zcVersion,
        plan,
        installMethod,
        installSource,
        sourceRef,
        bundleType,
        bundlePath,
        recommendedInstallMethod,
        recommendedInstallSource,
        recommendedSourceRef,
        recommendedBundleType,
        recommendedBundlePath,
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
  let fallbackHint: string | undefined;

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
    const statusPlan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, "error");
    const status = await resolvePlatformInstallStatus(statusPlan);
    const zcVersion = getCliVersion();
    const qwenReleaseBundlePath = shouldPreferQwenOfficialCli(target, scope)
      ? resolveQwenOfficialCliReleaseBundleDir(statusPlan)
      : undefined;
    const qwenInstallSource = shouldPreferQwenOfficialRepoInstall(target, scope) ? "github-repo" : "local-bundle";

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
          installMethod: target === "qwen" && scope === "global" ? "qwen-cli" : undefined,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? null : null,
        }),
        summarizeResult("update", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: status.receiptPath,
          zcVersion,
          contentFingerprint: status.contentFingerprint ?? null,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          noop: true,
          installMethod: target === "qwen" && scope === "global" ? "qwen-cli" : undefined,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : undefined,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath : undefined,
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
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, overwrite);

    if (opts.plan) {
      emitOutput(
        format,
        buildPlanPayload("update", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          status: status.kind,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? null : null,
        }),
        summarizePlan("update", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          installSource: target === "qwen" && scope === "global" ? qwenInstallSource : null,
          sourceRef: target === "qwen" && scope === "global" && qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
          bundleType: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: target === "qwen" && scope === "global" && qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? null : null,
        }),
      );
      return;
    }

    if (shouldPreferQwenOfficialCli(target, scope)) {
      try {
        if (format === "text") {
          console.log("正在调用官方命令：qwen extensions update …");
        }

        if (qwenInstallSource === "github-repo") {
          await updateQwenExtensionWithOfficialCli(plan.capability?.extension?.name ?? "zc-toolkit");
        } else {
          const releaseBundle = await syncQwenOfficialCliReleaseBundle(plan);
          await uninstallQwenExtensionWithOfficialCli(releaseBundle.extensionName);
          await relinkQwenExtensionWithOfficialCli(releaseBundle.bundleDir);
        }
        await writePlatformInstallReceiptForPlan(plan, {
          installedAt: new Date().toISOString(),
          zcVersion,
          installMethod: "qwen-cli",
          installSource: qwenInstallSource,
          sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : undefined,
          bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : undefined,
          bundlePath: qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? undefined : undefined,
        });

        const result = estimateManagedInstallResult(plan, status);

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
            installMethod: "qwen-cli",
            installSource: qwenInstallSource,
            sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
            bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : null,
            bundlePath: qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? null : null,
          }),
          summarizeResult("update", target, destinationRoot, result, {
            autoResolvedRoot,
            rootSource: targetResolution.source,
            hint: targetResolution.hint,
            scope,
            receiptPath: resolvePlatformInstallReceiptPath(plan),
            zcVersion,
            contentFingerprint: plan.metadata?.fingerprint.value ?? null,
            status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
            installMethod: "qwen-cli",
            installSource: qwenInstallSource,
            sourceRef: qwenInstallSource === "github-repo" ? qwenOfficialExtensionRepoUrl : null,
            bundleType: qwenInstallSource === "local-bundle" ? "release-bundle" : null,
            bundlePath: qwenInstallSource === "local-bundle" ? qwenReleaseBundlePath ?? null : null,
          }),
        );
        return;
      } catch (error) {
        if (!(error instanceof QwenOfficialCliUnavailableError)) {
          throw error;
        }

        fallbackHint = "未检测到 qwen CLI，已回退为直接写入官方扩展目录。";
      }
    }

    const result = await writePlatformArtifacts(
      target,
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
        hint: mergeHints(targetResolution.hint, fallbackHint),
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion,
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: status.kind,
        installMethod: "filesystem",
        installSource: null,
        sourceRef: null,
        bundleType: null,
        bundlePath: null,
      }),
      summarizeResult("update", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: mergeHints(targetResolution.hint, fallbackHint),
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion,
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
        installMethod: "filesystem",
        installSource: null,
        sourceRef: null,
        bundleType: undefined,
        bundlePath: undefined,
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

export async function runPlatformUninstall(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & {
    force?: boolean;
    plan?: boolean;
    json?: boolean;
  },
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
    const autoResolvedRoot = targetResolution.source !== "explicit";
    const destinationRoot = resolve(targetResolution.root);
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, "error");
    const status = await resolvePlatformInstallStatus(plan);

    if (!status.receipt) {
      emitPlatformError(
        format,
        target,
        "uninstall",
        `${target} 当前目录没有受管安装回执，拒绝自动卸载。请先运行 \`zc platform status ${target}\` 检查。`,
        {
          root: destinationRoot,
          receiptPath: status.receiptPath,
          status: status.kind,
        },
      );
      process.exitCode = 1;
      return;
    }

    if (status.kind === "drifted" && !opts.force) {
      emitPlatformError(
        format,
        target,
        "uninstall",
        `${target} 安装目录已漂移。请先运行 \`zc platform doctor ${target}\` 或 \`zc platform status ${target}\` 检查，确认后追加 \`--force\` 再卸载。`,
        {
          root: destinationRoot,
          receiptPath: status.receiptPath,
          status: status.kind,
        },
      );
      process.exitCode = 1;
      return;
    }

    const installMethod = status.receipt.installMethod ?? "filesystem";
    const installSource = status.receipt.installSource ?? null;
    const sourceRef = status.receipt.sourceRef ?? null;
    const bundlePath = status.receipt.bundlePath ?? null;

    if (opts.plan) {
      emitOutput(
        format,
        {
          mode: "plan",
          action: "uninstall",
          target,
          root: destinationRoot,
          scope,
          rootSource: targetResolution.source,
          autoResolvedRoot,
          hint: targetResolution.hint ?? null,
          status: status.kind,
          receiptPath: status.receiptPath,
          installMethod,
          installSource,
          sourceRef,
          bundlePath,
          artifactCount: status.receipt.artifacts.length,
          artifacts: status.receipt.artifacts.map((artifact) => artifact.path),
        },
        [
          `${target} 卸载计划`,
          formatRootLabel("uninstall", destinationRoot, {
            autoResolvedRoot,
            rootSource: targetResolution.source,
            hint: targetResolution.hint,
          }),
          `状态：${status.kind}（${formatStatusLabel(status.kind)}）`,
          `安装方式：${installMethod === "qwen-cli" ? "官方 qwen extensions CLI" : "直接写入"}`,
          ...(installSource ? [`安装来源：${installSource === "github-repo" ? "GitHub 扩展仓库" : "本地 bundle"}`] : []),
          ...(sourceRef ? [`来源：${sourceRef}`] : []),
          `回执：${status.receiptPath}`,
          ...(bundlePath ? [`Bundle 目录：${bundlePath}`] : []),
          `受管产物：${status.receipt.artifacts.length}`,
          ...status.receipt.artifacts.map((artifact) => `- ${artifact.path}`),
        ].join("\n"),
      );
      return;
    }

    let artifactCleanup = { removed: 0, missing: 0 };

    if (target === "qwen" && installMethod === "qwen-cli") {
      const extensionName = plan.capability?.extension?.name ?? "zc-toolkit";

      if (format === "text") {
        console.log(`正在调用官方命令：qwen extensions uninstall ${extensionName} …`);
      }

      await uninstallQwenExtensionWithOfficialCli(extensionName);
    } else {
      artifactCleanup = await removeManagedPaths(status.receipt.artifacts.map((artifact) => artifact.path));
    }

    const bundleCleanup = await removeOptionalManagedPath(bundlePath);
    const receiptExisted = await pathExists(status.receiptPath);
    if (receiptExisted) {
      await deletePlatformInstallReceipt(status.receiptPath);
    }

    const result = {
      removedArtifacts: artifactCleanup.removed,
      missingArtifacts: artifactCleanup.missing,
      bundleRemoved: bundleCleanup.removed,
      bundleMissing: bundleCleanup.missing,
      receiptRemoved: receiptExisted,
      receiptMissing: !receiptExisted,
    };

    emitOutput(
      format,
      buildUninstallPayload(target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: status.receiptPath,
        installMethod,
        installSource,
        sourceRef,
        bundlePath,
      }),
      summarizeUninstall(target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: status.receiptPath,
        installMethod,
        installSource,
        sourceRef,
        bundlePath,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "uninstall",
      error instanceof Error ? `${target} 卸载失败：${error.message}` : `${target} 卸载失败。`,
    );
    process.exitCode = 1;
  }
}

export async function runPlatformRepair(
  target: PlatformName,
  opts: PlatformTargetSelectorOpts & {
    plan?: boolean;
    json?: boolean;
  },
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
    const autoResolvedRoot = targetResolution.source !== "explicit";
    const destinationRoot = resolve(targetResolution.root);
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const statusPlan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, "error");
    const status = await resolvePlatformInstallStatus(statusPlan);

    if (!status.receipt) {
      emitPlatformError(
        format,
        target,
        "repair",
        `${target} 当前目录尚未建立受管安装状态。请先运行 \`zc platform install ${target}\`。`,
        {
          root: destinationRoot,
          receiptPath: status.receiptPath,
        },
      );
      process.exitCode = 1;
      return;
    }

    const installMethod = status.receipt.installMethod ?? "filesystem";
    const installSource = status.receipt.installSource
      ?? (target === "qwen" && scope === "global" ? "github-repo" : undefined);
    const sourceRef = status.receipt.sourceRef
      ?? (installSource === "github-repo" ? qwenOfficialExtensionRepoUrl : undefined);
    const bundlePath = status.receipt.bundlePath
      ?? (shouldPreferQwenOfficialCli(target, scope) ? resolveQwenOfficialCliReleaseBundleDir(statusPlan) : null);
    const bundleMissing = installSource === "local-bundle" && bundlePath ? !(await pathExists(bundlePath)) : false;

    if (status.kind === "up-to-date" && !(target === "qwen" && installMethod === "qwen-cli" && bundleMissing)) {
      const result = {
        created: 0,
        overwritten: 0,
        unchanged: status.summary.trackedArtifacts,
        skipped: 0,
        dryRun: false,
      };

      emitOutput(
        format,
        buildResultPayload("repair", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: status.receiptPath,
          zcVersion: getCliVersion(),
          contentFingerprint: status.contentFingerprint ?? null,
          status: status.kind,
          noop: true,
          installMethod,
          installSource,
          sourceRef,
          bundleType: status.receipt.bundleType ?? null,
          bundlePath,
        }),
        summarizeResult("repair", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: status.receiptPath,
          zcVersion: getCliVersion(),
          contentFingerprint: status.contentFingerprint ?? null,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          noop: true,
          installMethod,
          installSource,
          sourceRef,
          bundleType: status.receipt.bundleType ?? undefined,
          bundlePath: bundlePath ?? undefined,
        }),
      );
      return;
    }

    const overwrite: OverwriteMode = "force";
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, overwrite);

    if (opts.plan) {
      emitOutput(
        format,
        buildPlanPayload("repair", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          status: status.kind,
          installSource: installSource ?? null,
          sourceRef: sourceRef ?? null,
          bundleType: status.receipt.bundleType ?? null,
          bundlePath: bundlePath ?? null,
        }),
        summarizePlan("repair", target, destinationRoot, plan, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          installSource: installSource ?? null,
          sourceRef: sourceRef ?? null,
          bundleType: status.receipt.bundleType ?? null,
          bundlePath: bundlePath ?? null,
        }),
      );
      return;
    }

    if (target === "qwen" && installMethod === "qwen-cli") {
      if (format === "text") {
        console.log(`正在调用官方命令：qwen extensions ${installSource === "github-repo" ? "update" : bundleMissing ? "link" : "relink"} …`);
      }

      let repairedBundlePath: string | undefined;
        if (installSource === "github-repo") {
          await updateQwenExtensionWithOfficialCli(plan.capability?.extension?.name ?? "zc-toolkit");
        } else {
          const releaseBundle = await syncQwenOfficialCliReleaseBundle(plan);
          repairedBundlePath = releaseBundle.bundleDir;
          if (bundleMissing) {
            await relinkQwenExtensionWithOfficialCli(releaseBundle.bundleDir);
          } else {
            await uninstallQwenExtensionWithOfficialCli(releaseBundle.extensionName);
            await relinkQwenExtensionWithOfficialCli(releaseBundle.bundleDir);
          }
        }

      await writePlatformInstallReceiptForPlan(plan, {
        installedAt: new Date().toISOString(),
        zcVersion: getCliVersion(),
        installMethod: "qwen-cli",
        installSource,
        sourceRef,
        bundleType: installSource === "local-bundle" ? "release-bundle" : undefined,
        bundlePath: installSource === "local-bundle" ? repairedBundlePath ?? bundlePath ?? undefined : undefined,
      });

      const result = status.kind === "up-to-date"
        ? {
            created: 0,
            overwritten: 0,
            unchanged: plan.artifacts.length,
            skipped: 0,
            dryRun: false,
          }
        : estimateManagedInstallResult(plan, status);

      emitOutput(
        format,
        buildResultPayload("repair", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: resolvePlatformInstallReceiptPath(plan),
          zcVersion: getCliVersion(),
          contentFingerprint: plan.metadata?.fingerprint.value ?? null,
          status: status.kind,
          installMethod: "qwen-cli",
          installSource,
          sourceRef,
          bundleType: installSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: installSource === "local-bundle" ? repairedBundlePath ?? bundlePath ?? null : null,
        }),
        summarizeResult("repair", target, destinationRoot, result, {
          autoResolvedRoot,
          rootSource: targetResolution.source,
          hint: targetResolution.hint,
          scope,
          receiptPath: resolvePlatformInstallReceiptPath(plan),
          zcVersion: getCliVersion(),
          contentFingerprint: plan.metadata?.fingerprint.value ?? null,
          status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
          installMethod: "qwen-cli",
          installSource,
          sourceRef,
          bundleType: installSource === "local-bundle" ? "release-bundle" : null,
          bundlePath: installSource === "local-bundle" ? repairedBundlePath ?? bundlePath ?? null : null,
        }),
      );
      return;
    }

    const result = await writePlatformArtifacts(
      target,
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
      zcVersion: getCliVersion(),
      installMethod,
      installSource,
      sourceRef,
      bundleType: status.receipt.bundleType,
      bundlePath: status.receipt.bundlePath,
    });

    emitOutput(
      format,
      buildResultPayload("repair", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: status.kind,
        installMethod,
        installSource,
        sourceRef,
        bundleType: status.receipt.bundleType ?? null,
        bundlePath: status.receipt.bundlePath ?? null,
      }),
      summarizeResult("repair", target, destinationRoot, result, {
        autoResolvedRoot,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        scope,
        receiptPath: resolvePlatformInstallReceiptPath(plan),
        zcVersion: getCliVersion(),
        contentFingerprint: plan.metadata?.fingerprint.value ?? null,
        status: `${status.kind}（${formatStatusLabel(status.kind)}）`,
        installMethod,
        installSource,
        sourceRef,
        bundleType: status.receipt.bundleType ?? undefined,
        bundlePath: status.receipt.bundlePath ?? undefined,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "repair",
      error instanceof Error ? `${target} 修复失败：${error.message}` : `${target} 修复失败。`,
    );
    process.exitCode = 1;
  }
}

export async function runPlatformDoctor(
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
    const plan = createInstallPlan(target, platformModule, manifest, destinationRoot, scope, "error");
    const status = await resolvePlatformInstallStatus(plan);
    const doctor = await resolvePlatformInstallDoctor(plan, status);

    emitOutput(
      format,
      buildDoctorPayload(target, destinationRoot, status, doctor, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        plan,
      }),
      summarizeDoctor(target, destinationRoot, status, doctor, {
        scope,
        rootSource: targetResolution.source,
        hint: targetResolution.hint,
        plan,
      }),
    );
  } catch (error) {
    emitPlatformError(
      format,
      target,
      "doctor",
      error instanceof Error ? `${target} 诊断失败：${error.message}` : `${target} 诊断失败。`,
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
    const manifest = await loadToolkitManifest();
    const platformModule = await loadPlatformModule(target);
    const plan = createInstallPlan(target, platformModule, manifest, root, scope, "error");

    emitOutput(
      format,
      buildWherePayload(target, root, {
        scope,
        rootSource: targetResolution.source,
        marker: targetResolution.marker,
        hint: targetResolution.hint,
        capability: getPlanCapabilitySummary(plan),
      }),
      summarizeWhere(target, root, {
        scope,
        rootSource: targetResolution.source,
        marker: targetResolution.marker,
        hint: targetResolution.hint,
        capability: getPlanCapabilitySummary(plan),
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
  const platform = program.command("platform").description("查看、安装、更新和诊断平台内容");

  platform
    .command("generate")
    .alias("g")
    .description("导出平台内容或 Qwen 发布 bundle")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "输出目录")
    .option("-p, --project", "输出到当前目录向上解析出的最近项目根（当前仅 codex marketplace）")
    .option("-g, --global", "输出到用户级默认位置（当前仅 codex marketplace）")
    .option("-b, --bundle <type>", "导出指定 bundle 布局（qwen: release-bundle；codex: codex-plugin/codex-marketplace）", parseGenerateBundleType)
    .option("--plan", "只查看生成计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformGenerate);

  platform
    .command("plugin")
    .alias("p")
    .description("管理 Codex 官方插件 lifecycle，或生成本地 marketplace")
    .argument("<target>", "目标平台（当前支持 codex）", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定 marketplace bundle root，不是 Codex home")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用用户级 personal marketplace")
    .option("--git [source]", "使用 Git marketplace；未给 source 时使用 zc 官方 Codex marketplace 仓库")
    .option("--ref <ref>", "Git marketplace ref（仅注册/安装）")
    .option("--register", "直接调用 codex plugin marketplace add 注册 Git marketplace")
    .option("--install", "注册 marketplace 并调用 codex plugin add 安装 zc-toolkit")
    .option("--upgrade", "调用 codex plugin marketplace upgrade 刷新目录并检查插件状态")
    .option("--status", "调用 codex plugin list --available 检查插件状态")
    .option("--uninstall", "与 --git 合用时调用 codex plugin remove；否则卸载本地 marketplace bundle")
    .option("--with-agents", "组合管理官方插件与全局 companion custom agents")
    .option("--include-agents", "卸载本地 plugin bundle 时同时清理 zc-managed custom agents")
    .option("--plan", "只查看 lifecycle、生成或卸载计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .option("-f, --force", "生成时覆盖漂移产物；卸载时忽略漂移/未知文件保护")
    .action(runPlatformPlugin);

  platform
    .command("agents")
    .alias("a")
    .description("同步、检查或卸载 Codex custom agents（独立于官方 marketplace）")
    .argument("<target>", "目标平台（当前支持 codex）", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定 Codex home 或项目根，仅管理 custom agents")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用 Codex 用户级默认位置")
    .option("--sync", "同步或更新 zc-managed custom agents（默认动作）")
    .option("--update", "同 --sync")
    .option("--status", "检查 custom agents 是否缺失、漂移或存在过期 zc agent")
    .option("--uninstall", "卸载 zc-managed custom agents，并移除 config.toml 中的 [agents.zc_*]")
    .option("--prune", "同步时删除当前清单外的 zc-*.toml 过期 agent 文件")
    .option("--plan", "只查看计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .action(runPlatformAgents);

  platform
    .command("install")
    .alias("i")
    .description("把平台内容安装到项目、用户级或指定目录")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("--plan", "只查看安装计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .option("-f, --force", "覆盖目标目录中已有但内容不同的产物")
    .action(runPlatformInstall);

  platform
    .command("where")
    .alias("w")
    .description("查看平台内容会安装到哪里")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("-j, --json", "输出 JSON")
    .action(runPlatformWhere);

  platform
    .command("status")
    .alias("s")
    .description("查看是否已安装、是否可更新、是否漂移")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("-j, --json", "输出 JSON")
    .action(runPlatformStatus);

  platform
    .command("update")
    .alias("u")
    .description("更新已安装的平台内容")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("--plan", "只查看更新计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .option("-f, --force", "覆盖已漂移的已安装产物")
    .action(runPlatformUpdate);

  platform
    .command("uninstall")
    .alias("remove")
    .description("卸载受管平台内容并删除安装记录")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("--plan", "只查看卸载计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .option("-f, --force", "允许卸载已漂移的受管内容")
    .action(runPlatformUninstall);

  platform
    .command("repair")
    .alias("fix")
    .description("修复漂移、缺失或官方 CLI 失配的安装")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("--plan", "只查看修复计划，不写文件")
    .option("-j, --json", "输出 JSON")
    .action(runPlatformRepair);

  platform
    .command("doctor")
    .alias("check")
    .description("诊断当前平台安装的健康度和下一步建议")
    .argument("<target>", "目标平台 (qwen|codex|claude|opencode)", parsePlatformName)
    .option("-d, --dir <dir>", "使用指定目录")
    .option("-p, --project", "使用当前目录向上解析出的最近项目根")
    .option("-g, --global", "使用平台定义的用户级默认位置")
    .option("-j, --json", "输出 JSON")
    .action(runPlatformDoctor);
}
