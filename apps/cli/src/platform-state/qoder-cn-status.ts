import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { hashPlatformArtifactContent } from "./receipt.js";
import type {
  PlatformInstallArtifactStatus,
  PlatformInstallPlanLike,
  PlatformInstallStatusResult,
} from "./types.js";

const QODER_CN_PLUGIN_MANIFEST_RELATIVE = ".qoder-plugin/plugin.json";

interface QoderCnPluginManifest {
  name?: string;
  version?: string;
}

function isEnoentError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function readQoderCnPluginManifest(destinationRoot: string): Promise<QoderCnPluginManifest | null> {
  const manifestPath = resolve(destinationRoot, QODER_CN_PLUGIN_MANIFEST_RELATIVE);

  try {
    const content = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (typeof parsed === "object" && parsed !== null) {
      return parsed as QoderCnPluginManifest;
    }

    return null;
  } catch (error) {
    if (isEnoentError(error)) {
      return null;
    }

    throw error;
  }
}

function resolveQoderCnGlobalRoot(): string {
  return process.env.QODERCN_CONFIG_DIR
    ? resolve(process.env.QODERCN_CONFIG_DIR)
    : resolve(homedir(), ".qoder-cn");
}

function buildQoderCnDirectoryStatus(
  plan: PlatformInstallPlanLike,
  destinationRoot: string,
  manifest: QoderCnPluginManifest,
  installedVersion: string | undefined,
): PlatformInstallStatusResult {
  const pluginManifestPath = resolve(destinationRoot, QODER_CN_PLUGIN_MANIFEST_RELATIVE);
  const plannedFingerprint = plan.metadata?.fingerprint.value ?? null;

  const artifacts: PlatformInstallArtifactStatus[] = plan.artifacts.map((artifact) => {
    const plannedSha256 = hashPlatformArtifactContent(artifact.content);

    return {
      path: artifact.path,
      receiptSha256: null,
      actualSha256: null,
      plannedSha256,
      matchesReceiptOnDisk: null,
      differsFromPlan: false,
    };
  });

  const kind = installedVersion ? "up-to-date" : "not-installed";

  return {
    kind,
    platform: plan.platform,
    receiptPath: pluginManifestPath,
    receipt: null,
    installedZcVersion: installedVersion,
    contentFingerprint: plannedFingerprint ?? undefined,
    summary: {
      trackedArtifacts: 0,
      driftedArtifacts: 0,
      missingArtifacts: 0,
      plannedChanges: 0,
    },
    artifacts,
  };
}

export async function resolveQoderCnDirectoryStatus(
  plan: PlatformInstallPlanLike,
): Promise<PlatformInstallStatusResult | null> {
  const destinationRoot = plan.destinationRoot;
  const manifest = await readQoderCnPluginManifest(destinationRoot);

  if (!manifest) {
    return null;
  }

  return buildQoderCnDirectoryStatus(plan, destinationRoot, manifest, manifest.version);
}

export function resolveQoderCnGlobalPluginRoot(): string {
  return resolveQoderCnGlobalRoot();
}

export const QODER_CN_PLUGIN_MANIFEST_PATH = QODER_CN_PLUGIN_MANIFEST_RELATIVE;
