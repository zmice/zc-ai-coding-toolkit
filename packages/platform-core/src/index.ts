import { createHash } from "node:crypto";
import { join } from "node:path";

export type PlatformName = "qwen" | "codex" | "claude" | "opencode" | "qoder-cn";
export type ToolkitAssetKind = "skill" | "command" | "agent";
export type OverwriteMode = "error" | "force";
export type InstallScope = "project" | "global" | "dir";
export type PlatformCapabilitySurface =
  | "entry-file"
  | "plugin-dir"
  | "skills-dir"
  | "commands-dir"
  | "agents-dir"
  | "extension-dir";

export interface ToolkitAssetAttachmentLike {
  readonly relativePath: string;
  readonly contents: string;
}

export interface ToolkitCodexAgentConfigLike {
  readonly model?: string;
  readonly modelReasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
  readonly sandboxMode?: "read-only" | "workspace-write" | "danger-full-access";
}

export interface ToolkitAssetLike {
  readonly id: string;
  readonly kind: ToolkitAssetKind;
  readonly platforms: readonly string[];
  readonly name?: string;
  readonly title?: string;
  readonly summary?: string;
  readonly body?: string;
  readonly attachments?: readonly ToolkitAssetAttachmentLike[];
  readonly tools?: readonly string[];
  readonly requires?: readonly string[];
  readonly tier?: string;
  readonly audience?: string;
  readonly stability?: string;
  readonly workflowFamily?: string;
  readonly workflowRole?: string;
  readonly routingWorkflows?: readonly string[];
  readonly taskTypes?: readonly string[];
  readonly platformExposure?: Readonly<Partial<Record<string, string>>>;
  readonly codexAgent?: ToolkitCodexAgentConfigLike;
}

export interface ToolkitManifestLike {
  readonly source?: string;
  readonly assets: readonly ToolkitAssetLike[];
}

export interface PlatformArtifact {
  readonly path: string;
  readonly content: string;
  readonly metadata?: PlatformArtifactMetadata;
}

export interface PlatformFingerprint {
  readonly algorithm: "sha256";
  readonly value: string;
}

export interface PlatformArtifactMetadata {
  readonly bytes: number;
  readonly fingerprint: PlatformFingerprint;
}

export interface PlatformPlanMetadata {
  readonly artifactCount: number;
  readonly fingerprint: PlatformFingerprint;
}

export interface PlatformCapability {
  readonly platform: PlatformName;
  readonly namespace: string;
  readonly surfaces: readonly PlatformCapabilitySurface[];
  readonly entryFile?: {
    readonly fileName: string;
  };
  readonly commands?: {
    readonly relativeDir: string;
    readonly fileExtension: ".md";
  };
  readonly skills?: {
    readonly relativeDir: string;
    readonly fileName: "SKILL.md";
  };
  readonly agents?: {
    readonly relativeDir: string;
    readonly fileExtension: ".md" | ".toml";
  };
  readonly extension?: {
    readonly relativeDir: string;
    readonly name: string;
    readonly manifestFile: string;
    readonly contextFileName?: string;
  };
}

export interface GenerationPlan {
  readonly platform: PlatformName;
  readonly packageName: string;
  readonly manifestSource: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly capability?: PlatformCapability;
  readonly artifacts: readonly PlatformArtifact[];
  readonly metadata?: PlatformPlanMetadata;
}

export interface InstallPlan extends GenerationPlan {
  readonly destinationRoot: string;
  readonly scope: InstallScope;
  readonly overwrite: OverwriteMode;
}

export interface InstallPlanOptions {
  readonly destinationRoot: string;
  readonly scope?: InstallScope;
  readonly overwrite?: OverwriteMode;
}

export interface GeneratedHeaderOptions {
  readonly linePrefix: string;
  readonly lines: readonly string[];
}

export function describeAsset(asset: ToolkitAssetLike): string {
  return asset.title ?? asset.summary ?? asset.id;
}

export function stripAssetKindPrefix(
  value: string,
  options: {
    readonly separators?: readonly string[];
  } = {},
): string {
  const separators = options.separators ?? [":"];

  for (const separator of separators) {
    for (const kind of ["command", "skill", "agent"] as const) {
      const prefix = `${kind}${separator}`;
      if (value.startsWith(prefix)) {
        return value.slice(prefix.length);
      }
    }
  }

  return value;
}

export function slugifyAssetName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function createNamespacedAssetSlug(
  asset: ToolkitAssetLike,
  options: {
    readonly namespace?: string;
    readonly separators?: readonly string[];
  } = {},
): string {
  const namespace = options.namespace ?? "zc";
  const name = asset.name ?? stripAssetKindPrefix(asset.id, {
    separators: options.separators,
  });
  const slug = slugifyAssetName(name);

  return `${namespace}-${slug || stripAssetKindPrefix(asset.id, { separators: options.separators })}`;
}

export function renderPlatformAssetList(
  assets: readonly ToolkitAssetLike[],
  options: {
    readonly emptyText?: string;
  } = {},
): string {
  if (assets.length === 0) {
    return options.emptyText ?? "- 尚未匹配到任何工具包资产。";
  }

  return assets
    .map((asset) => `- \`${asset.kind}\` \`${asset.id}\`: ${describeAsset(asset)}`)
    .join("\n");
}

function toYamlScalar(value: string): string {
  return JSON.stringify(value);
}

export function renderYamlFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ["---"];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }

      lines.push(`${key}:`);
      for (const entry of value) {
        lines.push(`  - ${toYamlScalar(String(entry))}`);
      }
      continue;
    }

    lines.push(`${key}: ${toYamlScalar(String(value))}`);
  }

  lines.push("---");

  return `${lines.join("\n")}\n`;
}

export function renderMarkdownCommandFile(options: {
  readonly name?: string;
  readonly description: string;
  readonly body: string;
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
  })}\n${options.body.trim()}\n`;
}

export function createMarkdownCommandArtifact(options: {
  readonly path: string;
  readonly asset: ToolkitAssetLike;
  readonly name?: string;
  readonly description?: string;
  readonly body?: string;
}): PlatformArtifact {
  return {
    path: options.path,
    content: renderMarkdownCommandFile({
      name: options.name,
      description: options.description ?? options.asset.summary ?? describeAsset(options.asset),
      body: options.body ?? options.asset.body ?? `# ${describeAsset(options.asset)}\n`,
    }),
  };
}

export function renderSkillFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
  })}\n${options.body.trim()}\n`;
}

export function createSkillArtifact(options: {
  readonly path: string;
  readonly asset: ToolkitAssetLike;
  readonly name: string;
  readonly description?: string;
  readonly body?: string;
}): PlatformArtifact {
  return {
    path: options.path,
    content: renderSkillFile({
      name: options.name,
      description: options.description ?? options.asset.summary ?? describeAsset(options.asset),
      body: options.body ?? options.asset.body ?? `# ${describeAsset(options.asset)}\n`,
    }),
  };
}

function normalizeAttachmentRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/");
  const outputRelativePath = normalized.startsWith("assets/")
    ? normalized.slice("assets/".length)
    : normalized;
  const segments = outputRelativePath.split("/");

  if (
    outputRelativePath.length === 0
    || outputRelativePath.startsWith("/")
    || segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error(`不安全的附件路径：${relativePath}`);
  }

  return outputRelativePath;
}

export function createAttachmentArtifacts(options: {
  readonly directory: string;
  readonly asset: ToolkitAssetLike;
}): readonly PlatformArtifact[] {
  const directory = options.directory.replace(/\/+$/u, "");

  return (options.asset.attachments ?? []).map((attachment) => ({
    path: `${directory}/${normalizeAttachmentRelativePath(attachment.relativePath)}`,
    content: attachment.contents,
  }));
}

export function renderMarkdownAgentFile(options: {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  readonly tools?: readonly string[];
  readonly skills?: readonly string[];
}): string {
  return `${renderYamlFrontmatter({
    name: options.name,
    description: options.description,
    tools: options.tools,
    skills: options.skills,
  })}\n${options.body.trim()}\n`;
}

export function createMarkdownAgentArtifact(options: {
  readonly path: string;
  readonly asset: ToolkitAssetLike;
  readonly name: string;
  readonly description?: string;
  readonly body?: string;
  readonly tools?: readonly string[];
  readonly skills?: readonly string[];
}): PlatformArtifact {
  return {
    path: options.path,
    content: renderMarkdownAgentFile({
      name: options.name,
      description: options.description ?? options.asset.summary ?? describeAsset(options.asset),
      body: options.body ?? options.asset.body ?? `# ${describeAsset(options.asset)}\n`,
      tools: options.tools,
      skills: options.skills,
    }),
  };
}

function normalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFingerprintValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeFingerprintValue(entry)]),
    );
  }

  return value;
}

function isInstallPlan(plan: GenerationPlan): plan is InstallPlan {
  return "destinationRoot" in plan && "overwrite" in plan;
}

function buildPlanFingerprintInput(
  plan: GenerationPlan,
  artifacts: readonly PlatformArtifact[],
): Record<string, unknown> {
  return {
    platform: plan.platform,
    packageName: plan.packageName,
    manifestSource: plan.manifestSource,
    matchedAssets: plan.matchedAssets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      name: asset.name,
      platforms: [...asset.platforms].sort(),
      summary: asset.summary,
      title: asset.title,
      tools: asset.tools,
      requires: asset.requires,
    })),
    capability: plan.capability,
    artifacts: artifacts.map((artifact) => ({
      path: artifact.path,
      metadata: artifact.metadata ?? createArtifactMetadata(artifact),
    })),
    ...(isInstallPlan(plan)
      ? {
          destinationRoot: plan.destinationRoot,
          scope: plan.scope,
          overwrite: plan.overwrite,
        }
      : {}),
  };
}

export function createStableFingerprint(value: unknown): PlatformFingerprint {
  const normalized = JSON.stringify(normalizeFingerprintValue(value));
  const hash = createHash("sha256");

  hash.update(normalized);

  return {
    algorithm: "sha256",
    value: hash.digest("hex"),
  };
}

export function createArtifactMetadata(
  artifact: { readonly content: string },
): PlatformArtifactMetadata {
  return {
    bytes: Buffer.byteLength(artifact.content),
    fingerprint: createStableFingerprint(artifact.content),
  };
}

export function attachArtifactMetadata(
  artifact: PlatformArtifact,
): PlatformArtifact & { readonly metadata: PlatformArtifactMetadata } {
  return {
    ...artifact,
    metadata: createArtifactMetadata(artifact),
  };
}

export function createPlanMetadata(plan: GenerationPlan): PlatformPlanMetadata {
  const artifacts = plan.artifacts.map((artifact) => attachArtifactMetadata(artifact));

  return {
    artifactCount: artifacts.length,
    fingerprint: createStableFingerprint(buildPlanFingerprintInput(plan, artifacts)),
  };
}

export function attachPlanMetadata<T extends GenerationPlan>(
  plan: T,
): T & {
  readonly artifacts: readonly (PlatformArtifact & { readonly metadata: PlatformArtifactMetadata })[];
  readonly metadata: PlatformPlanMetadata;
} {
  const artifacts = plan.artifacts.map((artifact) => attachArtifactMetadata(artifact));

  return {
    ...plan,
    artifacts,
    metadata: createPlanMetadata({
      ...plan,
      artifacts,
    }),
  };
}

export function prependGeneratedHeader(content: string, options: GeneratedHeaderOptions): string {
  const header = options.lines.map((line) => `${options.linePrefix} ${line}`).join("\n");

  return `${header}\n\n${content}`;
}

export function selectMatchedAssets(
  manifest: ToolkitManifestLike,
  platform: PlatformName,
): readonly ToolkitAssetLike[] {
  return manifest.assets.filter((asset) => asset.platforms.includes(platform));
}

export function selectMatchedAssetsByKind(
  manifest: ToolkitManifestLike,
  platform: PlatformName,
  kind: ToolkitAssetKind,
): readonly ToolkitAssetLike[] {
  return selectMatchedAssets(manifest, platform).filter((asset) => asset.kind === kind);
}

export function prefixArtifacts(
  destinationRoot: string,
  artifacts: readonly PlatformArtifact[],
): readonly PlatformArtifact[] {
  return artifacts.map((artifact) => ({
    ...attachArtifactMetadata(artifact),
    path: join(destinationRoot, artifact.path),
  }));
}

export function createInstallPlan(
  generationPlan: GenerationPlan,
  options: InstallPlanOptions,
): InstallPlan {
  return attachPlanMetadata({
    ...generationPlan,
    destinationRoot: options.destinationRoot,
    scope: options.scope ?? "project",
    overwrite: options.overwrite ?? "error",
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  });
}

// ─── Quest CN (qoder-cn) plugin generation ────────────────────────────

export const qoderCnPlatformName = "qoder-cn" as const;
export const qoderCnPackageName = "@zmice/platform-core" as const;

export const qoderCnCapability: PlatformCapability = {
  platform: qoderCnPlatformName,
  namespace: "zc",
  surfaces: ["plugin-dir", "commands-dir", "skills-dir", "agents-dir"],
  commands: {
    relativeDir: "commands/zc",
    fileExtension: ".md",
  },
  skills: {
    relativeDir: "skills",
    fileName: "SKILL.md",
  },
  agents: {
    relativeDir: "agents",
    fileExtension: ".md",
  },
};

export interface QoderCnGenerationOptions {
  readonly packageName?: string;
  readonly manifestSource?: string;
  readonly pluginVersion?: string;
}

export interface QoderCnInstallOptions extends QoderCnGenerationOptions {
  readonly destinationRoot: string;
  readonly scope?: InstallScope;
  readonly overwrite?: OverwriteMode;
}

function renderQoderCnPluginManifest(options: {
  readonly name: string;
  readonly version?: string;
}): string {
  return `${JSON.stringify(
    {
      name: options.name,
      version: options.version ?? "0.1.0",
      description: "zc AI 编码工具包 — Quest CN 插件",
      author: { name: "zc" },
      license: "MIT",
      keywords: ["workflow", "skills", "coding-toolkit"],
    },
    null,
    2,
  )}\n`;
}

function renderQoderCnCommandArtifact(
  asset: ToolkitAssetLike,
): PlatformArtifact {
  const slug = stripAssetKindPrefix(asset.id);

  return createMarkdownCommandArtifact({
    path: `commands/zc/${slug}.md`,
    asset,
    name: `zc:${slug}`,
    description: describeAsset(asset),
    body:
      asset.body
      ?? `这是由工具包资产 \`${asset.id}\` 生成的 Quest CN 命令入口，用于触发 \`zc:${slug}\`。`,
  });
}

function renderQoderCnSkillArtifacts(
  asset: ToolkitAssetLike,
): readonly PlatformArtifact[] {
  const slug = stripAssetKindPrefix(asset.id);
  const directory = `skills/zc-${slug}`;

  return [
    createSkillArtifact({
      path: `${directory}/SKILL.md`,
      asset,
      name: `zc-${slug}`,
      description: describeAsset(asset),
      body:
        asset.body
        ?? `这是由工具包资产 \`${asset.id}\` 生成的 Quest CN skill。`,
    }),
    ...createAttachmentArtifacts({ directory, asset }),
  ];
}

function renderQoderCnAgentArtifact(
  asset: ToolkitAssetLike,
): PlatformArtifact {
  const slug = stripAssetKindPrefix(asset.id);
  const skillRefs = asset.requires
    ?.filter((entry) => entry.startsWith("skill:"))
    .map((entry) => `zc-${entry.slice("skill:".length)}`);

  return createMarkdownAgentArtifact({
    path: `agents/zc-${slug}.md`,
    asset,
    name: `zc-${slug}`,
    description: describeAsset(asset),
    body:
      asset.body
      ?? `这是由工具包资产 \`${asset.id}\` 生成的 Quest CN agent，用于承接 \`zc-${slug}\` 角色能力。`,
    tools: asset.tools,
    skills: skillRefs,
  });
}

export function createQoderCnGenerationPlan(
  manifest: ToolkitManifestLike,
  options: QoderCnGenerationOptions = {},
): GenerationPlan {
  const matchedAssets = selectMatchedAssets(manifest, qoderCnPlatformName);
  const commands = selectMatchedAssetsByKind(manifest, qoderCnPlatformName, "command");
  const skills = selectMatchedAssetsByKind(manifest, qoderCnPlatformName, "skill");
  const agents = selectMatchedAssetsByKind(manifest, qoderCnPlatformName, "agent");
  const manifestSource = options.manifestSource ?? manifest.source ?? "toolkit-manifest";
  const resolvedPackageName = options.packageName ?? qoderCnPackageName;

  return {
    platform: qoderCnPlatformName,
    packageName: resolvedPackageName,
    manifestSource,
    matchedAssets,
    capability: qoderCnCapability,
    artifacts: [
      {
        path: ".qoder-plugin/plugin.json",
        content: renderQoderCnPluginManifest({
          name: "zc-toolkit",
          version: options.pluginVersion,
        }),
      },
      ...commands.map((asset) => renderQoderCnCommandArtifact(asset)),
      ...skills.flatMap((asset) => renderQoderCnSkillArtifacts(asset)),
      ...agents.map((asset) => renderQoderCnAgentArtifact(asset)),
    ],
  };
}

export function createQoderCnInstallPlan(
  manifest: ToolkitManifestLike,
  options: QoderCnInstallOptions,
): InstallPlan {
  const generationPlan = createQoderCnGenerationPlan(manifest, options);

  return createInstallPlan(generationPlan, {
    destinationRoot: options.destinationRoot,
    scope: options.scope,
    overwrite: options.overwrite,
  });
}
