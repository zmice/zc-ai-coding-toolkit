import { createHash } from "node:crypto";
import { join } from "node:path";

export type PlatformName = "qwen" | "codex" | "qoder";
export type ToolkitAssetKind = "skill" | "command" | "agent";
export type OverwriteMode = "error" | "force";

export interface ToolkitAssetLike {
  readonly id: string;
  readonly kind: ToolkitAssetKind;
  readonly platforms: readonly string[];
  readonly title?: string;
  readonly summary?: string;
  readonly body?: string;
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

export interface GenerationPlan {
  readonly platform: PlatformName;
  readonly packageName: string;
  readonly manifestSource: string;
  readonly matchedAssets: readonly ToolkitAssetLike[];
  readonly artifacts: readonly PlatformArtifact[];
  readonly metadata?: PlatformPlanMetadata;
}

export interface InstallPlan extends GenerationPlan {
  readonly destinationRoot: string;
  readonly overwrite: OverwriteMode;
}

export interface InstallPlanOptions {
  readonly destinationRoot: string;
  readonly overwrite?: OverwriteMode;
}

export interface GeneratedHeaderOptions {
  readonly linePrefix: string;
  readonly lines: readonly string[];
}

export function describeAsset(asset: ToolkitAssetLike): string {
  return asset.title ?? asset.summary ?? asset.id;
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
      platforms: [...asset.platforms].sort(),
      summary: asset.summary,
      title: asset.title,
    })),
    artifacts: artifacts.map((artifact) => ({
      path: artifact.path,
      metadata: artifact.metadata ?? createArtifactMetadata(artifact),
    })),
    ...(isInstallPlan(plan)
      ? {
          destinationRoot: plan.destinationRoot,
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
    overwrite: options.overwrite ?? "error",
    artifacts: prefixArtifacts(options.destinationRoot, generationPlan.artifacts),
  });
}
