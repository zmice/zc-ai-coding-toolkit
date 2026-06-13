export type CodexContextArtifactAction = "create" | "update" | "unchanged" | "conflict";

export interface CodexContextExistingFile {
  readonly relativePath: string;
  readonly content: string | null;
}

export interface CodexContextInitSnapshot {
  readonly root: string;
  readonly projectName: string;
  readonly packageManager: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly directories: readonly string[];
  readonly existingFiles?: readonly CodexContextExistingFile[];
  readonly initializedAt?: string;
  readonly previousGeneratedAt?: string;
  readonly generatedAt: string;
}

export interface CodexContextInitOptions {
  readonly force?: boolean;
}

export interface CodexContextArtifact {
  readonly relativePath: string;
  readonly content: string;
  readonly managed: boolean;
}

export interface CodexContextArtifactPlan extends CodexContextArtifact {
  readonly action: CodexContextArtifactAction;
}

export interface CodexContextInitPlan {
  readonly platform: "codex";
  readonly root: string;
  readonly initializedAt: string;
  readonly generatedAt: string;
  readonly artifacts: readonly CodexContextArtifactPlan[];
  readonly summary: {
    readonly creates: number;
    readonly updates: number;
    readonly unchanged: number;
    readonly conflicts: number;
  };
}

export const codexContextManagedMarker = "<!-- zc-context:managed -->";
const agentsBlockStart = "<!-- zc-context:init:start -->";
const agentsBlockEnd = "<!-- zc-context:init:end -->";
const manifestRelativePath = ".codex/context/manifest.json";

function normalizePathForDisplay(path: string): string {
  return path.split("\\").join("/");
}

function getInitializedAt(input: CodexContextInitSnapshot): string {
  return input.initializedAt ?? input.previousGeneratedAt ?? input.generatedAt;
}

function formatPackageScriptCommand(packageManager: string, scriptName: string): string {
  if (packageManager === "pnpm") {
    return `pnpm ${scriptName}`;
  }

  if (packageManager === "yarn") {
    return `yarn ${scriptName}`;
  }

  if (packageManager === "npm") {
    return ["start", "stop", "restart", "test"].includes(scriptName)
      ? `npm ${scriptName}`
      : `npm run ${scriptName}`;
  }

  return scriptName;
}

function renderCliVerificationHint(packageManager: string): string {
  if (packageManager === "pnpm") {
    return "- CLI 改动：运行 `pnpm --dir apps/cli test` 的定向测试。";
  }

  if (packageManager === "npm") {
    return "- CLI 改动：运行 `npm --prefix apps/cli test` 的定向测试。";
  }

  if (packageManager === "yarn") {
    return "- CLI 改动：运行 `yarn --cwd apps/cli test` 的定向测试。";
  }

  return "- CLI 改动：进入 `apps/cli` 后按该包的 `test` script 运行定向测试。";
}

function renderAgentsContextBlock(): string {
  return [
    agentsBlockStart,
    "## zc 项目上下文",
    "",
    "- 项目上下文索引：`.codex/context/project.md`",
    "- 命令与验证索引：`.codex/context/commands.md`",
    "- 模块入口索引：`.codex/context/modules/README.md`",
    "- 任务开始时先读本入口，再按索引渐进式读取本次需要的源码、测试和文档。",
    "- 当模块结构、验证命令、安装方式或关键约定变化时，主动运行 `zc context init --write` 刷新上下文。",
    agentsBlockEnd,
  ].join("\n");
}

function mergeAgentsContextBlock(existing: string | null): string {
  const block = renderAgentsContextBlock();
  if (!existing || existing.trim().length === 0) {
    return `${block}\n`;
  }

  const startIndex = existing.indexOf(agentsBlockStart);
  const endIndex = existing.indexOf(agentsBlockEnd);
  if (startIndex >= 0 && endIndex > startIndex) {
    const afterEnd = endIndex + agentsBlockEnd.length;
    const before = existing.slice(0, startIndex).trimEnd();
    const after = existing.slice(afterEnd).trimStart();
    return `${[before, block, after].filter(Boolean).join("\n\n")}\n`;
  }

  return `${existing.trimEnd()}\n\n${block}\n`;
}

function renderProjectContext(input: CodexContextInitSnapshot): string {
  const directoryLines = input.directories.length > 0
    ? input.directories.map((dir) => `- \`${dir}\``)
    : ["- 未检测到常见源码目录；按当前任务从根入口继续读取。"];
  const initializedAt = getInitializedAt(input);

  return `${codexContextManagedMarker}
# ${input.projectName} Project Context

Initialized by \`zc context init\` at ${initializedAt}.
Last refreshed at ${input.generatedAt}.

## 读取顺序

1. 先读项目根 \`AGENTS.md\` 的长期规则和路由。
2. 再读本目录下的上下文索引，选择与任务相关的模块入口。
3. 最后只读本次会修改或验证的源码、测试、配置和错误输出。

## 项目事实

- root: \`${normalizePathForDisplay(input.root)}\`
- package manager: \`${input.packageManager}\`

## 检测到的入口目录

${directoryLines.join("\n")}

## 主动维护规则

- 如果新增/移动模块，刷新 \`.codex/context/modules/README.md\`。
- 如果新增/修改验证脚本，刷新 \`.codex/context/commands.md\`。
- 如果根入口规则变化，保留用户内容，只更新 \`zc-context:init\` managed block。
- 任务阶段切换或上下文失焦时，优先使用 \`$ctx-health\` / \`$context-engineering\` 重新压缩上下文。
`;
}

function renderCommandsContext(input: CodexContextInitSnapshot): string {
  const scriptLines = Object.entries(input.scripts).length > 0
    ? Object.entries(input.scripts).map(([name, command]) => `- \`${formatPackageScriptCommand(input.packageManager, name)}\`: \`${command}\``)
    : ["- 未检测到 `package.json` scripts；按项目文档或任务要求选择验证命令。"];
  const initializedAt = getInitializedAt(input);

  return `${codexContextManagedMarker}
# Commands And Verification

Initialized by \`zc context init\` at ${initializedAt}.
Last refreshed at ${input.generatedAt}.

## package scripts

${scriptLines.join("\n")}

## 验证选择

- 内容或文档改动：至少运行 \`git diff --check\`。
- toolkit 内容改动：运行 \`node apps/cli/dist/cli/index.js toolkit lint --json\` 或对应包测试。
${renderCliVerificationHint(input.packageManager)}
- 平台生成器改动：运行对应 \`packages/platform-*/\` 测试。
`;
}

function renderModulesContext(input: CodexContextInitSnapshot): string {
  const moduleLines = input.directories.length > 0
    ? input.directories.map((dir) => `- \`${dir}\`：按任务进入后只读取相关子目录、README 和测试。`)
    : ["- 当前未检测到常见模块目录；从根 README / AGENTS.md 继续。"];
  const initializedAt = getInitializedAt(input);

  return `${codexContextManagedMarker}
# Module Context Index

Initialized by \`zc context init\` at ${initializedAt}.
Last refreshed at ${input.generatedAt}.

## 模块入口

${moduleLines.join("\n")}

## 反模式

- 不要一次性读取整个仓库。
- 不要把 generated/dist 当作源码真相，除非任务明确要求核对发布产物。
- 不要把临时探索结论写入长期上下文；先沉淀为验证过的事实。
`;
}

function renderManifest(input: CodexContextInitSnapshot, artifacts: readonly string[]): string {
  return `${JSON.stringify({
    version: 1,
    generator: "zc context init",
    initializedAt: getInitializedAt(input),
    generatedAt: input.generatedAt,
    root: normalizePathForDisplay(input.root),
    disclosure: "progressive",
    artifacts,
    maintenanceTriggers: [
      "module layout changed",
      "verification command changed",
      "root AGENTS.md routing changed",
      "agent reported missing or stale context",
    ],
  }, null, 2)}\n`;
}

function getExistingFileMap(snapshot: CodexContextInitSnapshot): ReadonlyMap<string, string | null> {
  return new Map(
    (snapshot.existingFiles ?? []).map((file) => [file.relativePath, file.content])
  );
}

function isManagedExistingContent(relativePath: string, content: string): boolean {
  if (content.includes(codexContextManagedMarker)) {
    return true;
  }

  if (relativePath !== manifestRelativePath) {
    return false;
  }

  try {
    const manifest = JSON.parse(content) as { generator?: unknown };
    return manifest.generator === "zc context init";
  } catch {
    return false;
  }
}

function planArtifact(
  artifact: CodexContextArtifact,
  existingFileMap: ReadonlyMap<string, string | null>,
  force: boolean | undefined,
): CodexContextArtifactPlan {
  const existing = existingFileMap.get(artifact.relativePath) ?? null;

  if (existing === artifact.content) {
    return { ...artifact, action: "unchanged" };
  }

  if (existing === null) {
    return { ...artifact, action: "create" };
  }

  if (artifact.managed && !force && !isManagedExistingContent(artifact.relativePath, existing)) {
    return { ...artifact, action: "conflict" };
  }

  return { ...artifact, action: "update" };
}

function summarizeArtifacts(artifacts: readonly CodexContextArtifactPlan[]): CodexContextInitPlan["summary"] {
  return {
    creates: artifacts.filter((artifact) => artifact.action === "create").length,
    updates: artifacts.filter((artifact) => artifact.action === "update").length,
    unchanged: artifacts.filter((artifact) => artifact.action === "unchanged").length,
    conflicts: artifacts.filter((artifact) => artifact.action === "conflict").length,
  };
}

function createContextArtifacts(
  snapshot: CodexContextInitSnapshot,
  existingFileMap: ReadonlyMap<string, string | null>,
): readonly CodexContextArtifact[] {
  const agentsContent = mergeAgentsContextBlock(existingFileMap.get("AGENTS.md") ?? null);
  const contextArtifacts: CodexContextArtifact[] = [
    {
      relativePath: "AGENTS.md",
      content: agentsContent,
      managed: false,
    },
    {
      relativePath: ".codex/context/project.md",
      content: renderProjectContext(snapshot),
      managed: true,
    },
    {
      relativePath: ".codex/context/commands.md",
      content: renderCommandsContext(snapshot),
      managed: true,
    },
    {
      relativePath: ".codex/context/modules/README.md",
      content: renderModulesContext(snapshot),
      managed: true,
    },
  ];

  return [
    ...contextArtifacts,
    {
      relativePath: manifestRelativePath,
      content: renderManifest(snapshot, [
        ...contextArtifacts.map((artifact) => artifact.relativePath),
        manifestRelativePath,
      ]),
      managed: true,
    },
  ];
}

function planContextArtifacts(
  snapshot: CodexContextInitSnapshot,
  existingFileMap: ReadonlyMap<string, string | null>,
  force: boolean | undefined,
): readonly CodexContextArtifactPlan[] {
  return createContextArtifacts(snapshot, existingFileMap)
    .map((artifact) => planArtifact(artifact, existingFileMap, force));
}

function isFullyUnchanged(summary: CodexContextInitPlan["summary"]): boolean {
  return summary.creates === 0
    && summary.updates === 0
    && summary.conflicts === 0;
}

export function createCodexContextInitPlan(
  snapshot: CodexContextInitSnapshot,
  options: CodexContextInitOptions = {},
): CodexContextInitPlan {
  const existingFileMap = getExistingFileMap(snapshot);
  const initializedAt = getInitializedAt(snapshot);
  const currentSnapshot = { ...snapshot, initializedAt };

  if (snapshot.previousGeneratedAt && snapshot.previousGeneratedAt !== snapshot.generatedAt) {
    const previousSnapshot = { ...currentSnapshot, generatedAt: snapshot.previousGeneratedAt };
    const previousArtifacts = planContextArtifacts(previousSnapshot, existingFileMap, options.force);
    const previousSummary = summarizeArtifacts(previousArtifacts);

    if (isFullyUnchanged(previousSummary)) {
      return {
        platform: "codex",
        root: snapshot.root,
        initializedAt,
        generatedAt: previousSnapshot.generatedAt,
        artifacts: previousArtifacts,
        summary: previousSummary,
      };
    }
  }

  const artifacts = planContextArtifacts(currentSnapshot, existingFileMap, options.force);
  const summary = summarizeArtifacts(artifacts);

  return {
    platform: "codex",
    root: snapshot.root,
    initializedAt,
    generatedAt: currentSnapshot.generatedAt,
    artifacts,
    summary,
  };
}
