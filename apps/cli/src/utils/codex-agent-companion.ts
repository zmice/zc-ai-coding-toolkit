import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

export type CodexCompanionScope = "project" | "global" | "dir";

interface CodexAgentCompanionManifestEntry {
  readonly name: string;
  readonly path: string;
  readonly sha256: string;
}

interface CodexAgentCompanionManifest {
  readonly schemaVersion: 1;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly contentFingerprint: string;
  readonly config: {
    readonly path: string;
    readonly sha256: string;
  };
  readonly agents: readonly CodexAgentCompanionManifestEntry[];
}

export interface CodexAgentCompanion {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly installedPluginPath: string;
  readonly contentFingerprint: string;
  readonly configContent: string;
  readonly agents: readonly {
    readonly name: string;
    readonly relativePath: string;
    readonly content: string;
  }[];
}

export interface CodexCompanionAgentInstallPlan {
  readonly platform: "codex";
  readonly packageName: "@zmice/platform-codex";
  readonly manifestSource: string;
  readonly destinationRoot: string;
  readonly scope: CodexCompanionScope;
  readonly overwrite: "force";
  readonly matchedAssets: readonly [];
  readonly capability: {
    readonly platform: "codex";
    readonly namespace: "zc";
    readonly surfaces: readonly ["agents-dir"];
    readonly agents: {
      readonly relativeDir: string;
      readonly fileExtension: ".toml";
    };
  };
  readonly metadata: {
    readonly artifactCount: number;
    readonly fingerprint: {
      readonly algorithm: "sha256";
      readonly value: string;
    };
  };
  readonly artifacts: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function isManifestEntry(value: unknown): value is CodexAgentCompanionManifestEntry {
  return (
    isRecord(value)
    && typeof value.name === "string"
    && typeof value.path === "string"
    && typeof value.sha256 === "string"
  );
}

function parseManifest(value: unknown, manifestPath: string): CodexAgentCompanionManifest {
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.pluginId !== "string"
    || typeof value.pluginVersion !== "string"
    || typeof value.contentFingerprint !== "string"
    || !isRecord(value.config)
    || typeof value.config.path !== "string"
    || typeof value.config.sha256 !== "string"
    || !Array.isArray(value.agents)
    || !value.agents.every(isManifestEntry)
  ) {
    throw new Error(`Codex companion manifest 格式无效：${manifestPath}`);
  }

  return value as unknown as CodexAgentCompanionManifest;
}

function resolveCompanionFile(companionRoot: string, relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error(`Codex companion 路径必须是相对路径：${relativePath}`);
  }

  const resolved = resolve(companionRoot, relativePath);
  const relation = relative(companionRoot, resolved);
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error(`Codex companion 路径越界：${relativePath}`);
  }
  return resolved;
}

async function readVerifiedCompanionFile(
  companionRoot: string,
  entry: { readonly path: string; readonly sha256: string },
  label: string,
): Promise<string> {
  const content = await readFile(resolveCompanionFile(companionRoot, entry.path), "utf8");
  if (sha256(content) !== entry.sha256) {
    throw new Error(`${label}哈希不匹配：${entry.path}`);
  }
  return content;
}

export async function loadCodexAgentCompanion(
  installedPluginPath: string,
): Promise<CodexAgentCompanion> {
  const companionRoot = join(installedPluginPath, "assets", "zc-agents");
  const manifestPath = join(companionRoot, "manifest.json");
  const manifest = parseManifest(JSON.parse(await readFile(manifestPath, "utf8")) as unknown, manifestPath);
  const expectedFingerprint = sha256(JSON.stringify(manifest.agents));
  if (expectedFingerprint !== manifest.contentFingerprint) {
    throw new Error(`Codex companion manifest 内容指纹不匹配：${manifestPath}`);
  }
  const configContent = await readVerifiedCompanionFile(
    companionRoot,
    manifest.config,
    "companion config 文件",
  );
  const agents = await Promise.all(
    manifest.agents.map(async (entry) => ({
      name: entry.name,
      relativePath: entry.path,
      content: await readVerifiedCompanionFile(
        companionRoot,
        entry,
        "companion agent 文件",
      ),
    })),
  );

  return {
    pluginId: manifest.pluginId,
    pluginVersion: manifest.pluginVersion,
    installedPluginPath,
    contentFingerprint: manifest.contentFingerprint,
    configContent,
    agents,
  };
}

export function createCodexCompanionAgentInstallPlan(
  companion: CodexAgentCompanion,
  options: {
    readonly root: string;
    readonly scope: CodexCompanionScope;
  },
): CodexCompanionAgentInstallPlan {
  const codexRoot = options.scope === "project"
    ? join(options.root, ".codex")
    : options.root;
  const agentsDir = join(codexRoot, "agents");

  return {
    platform: "codex",
    packageName: "@zmice/platform-codex",
    manifestSource: `${companion.installedPluginPath}/assets/zc-agents/manifest.json`,
    destinationRoot: options.root,
    scope: options.scope,
    overwrite: "force",
    matchedAssets: [],
    capability: {
      platform: "codex",
      namespace: "zc",
      surfaces: ["agents-dir"],
      agents: {
        relativeDir: options.scope === "project" ? ".codex/agents" : "agents",
        fileExtension: ".toml",
      },
    },
    metadata: {
      artifactCount: companion.agents.length + 1,
      fingerprint: {
        algorithm: "sha256",
        value: companion.contentFingerprint,
      },
    },
    artifacts: [
      {
        path: join(codexRoot, "config.toml"),
        content: companion.configContent,
      },
      ...companion.agents.map((agent) => ({
        path: join(agentsDir, basename(agent.relativePath)),
        content: agent.content,
      })),
    ],
  };
}
