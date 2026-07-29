import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export const codexAgentsReceiptSchemaVersion = 1 as const;
export const codexAgentsReceiptFileName = "zc-toolkit-agents.install-receipt.json";

export type CodexAgentsReceiptScope = "project" | "global" | "dir";

export interface CodexAgentsReceiptArtifact {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface CodexAgentsReceipt {
  readonly schemaVersion: typeof codexAgentsReceiptSchemaVersion;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly installedPluginPath?: string;
  readonly contentFingerprint: string;
  readonly scope: CodexAgentsReceiptScope;
  readonly root: string;
  readonly installedAt: string;
  readonly managedAgentNames: readonly string[];
  readonly artifacts: readonly CodexAgentsReceiptArtifact[];
}

export interface CreateCodexAgentsReceiptInput {
  readonly root: string;
  readonly scope: CodexAgentsReceiptScope;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly installedPluginPath?: string;
  readonly contentFingerprint: string;
  readonly installedAt?: string | Date;
  readonly artifacts: readonly {
    readonly path: string;
    readonly content: string;
  }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function isManagedCodexAgentPath(path: string): boolean {
  return /(?:^|\/)agents\/zc-[^/]+\.toml$/u.test(path.replace(/\\/g, "/"));
}

function resolveOwnedAgentsRoot(
  root: string,
  scope: CodexAgentsReceiptScope,
): string {
  return scope === "project"
    ? resolve(root, ".codex", "agents")
    : resolve(root, "agents");
}

function isOwnedCodexAgentPath(
  path: string,
  root: string,
  scope: CodexAgentsReceiptScope,
): boolean {
  if (!isManagedCodexAgentPath(path)) {
    return false;
  }

  const relation = relative(resolveOwnedAgentsRoot(root, scope), resolve(path));
  return relation !== ""
    && !relation.startsWith("..")
    && !isAbsolute(relation)
    && !relation.includes("/")
    && !relation.includes("\\");
}

function parseAgentName(content: string): string | null {
  const match = content.match(/^\s*name\s*=\s*"([^"]+)"\s*$/mu);
  return match?.[1] ?? null;
}

function isCodexAgentsReceiptArtifact(value: unknown): value is CodexAgentsReceiptArtifact {
  return (
    isRecord(value)
    && typeof value.path === "string"
    && typeof value.sha256 === "string"
    && typeof value.bytes === "number"
  );
}

function isCodexAgentsReceipt(value: unknown): value is CodexAgentsReceipt {
  if (!(
    isRecord(value)
    && value.schemaVersion === codexAgentsReceiptSchemaVersion
    && typeof value.pluginId === "string"
    && typeof value.pluginVersion === "string"
    && (value.installedPluginPath === undefined || typeof value.installedPluginPath === "string")
    && typeof value.contentFingerprint === "string"
    && (value.scope === "project" || value.scope === "global" || value.scope === "dir")
    && typeof value.root === "string"
    && typeof value.installedAt === "string"
    && Array.isArray(value.managedAgentNames)
    && value.managedAgentNames.every((name) => typeof name === "string")
    && Array.isArray(value.artifacts)
    && value.artifacts.every(isCodexAgentsReceiptArtifact)
  )) {
    return false;
  }

  const root = value.root as string;
  const scope = value.scope as CodexAgentsReceiptScope;
  return value.artifacts.every((artifact) =>
    isOwnedCodexAgentPath(artifact.path, root, scope));
}

export function resolveCodexAgentsReceiptPath(
  root: string,
  scope: CodexAgentsReceiptScope,
): string {
  return scope === "project"
    ? join(root, ".codex", "platform-state", codexAgentsReceiptFileName)
    : join(root, "platform-state", codexAgentsReceiptFileName);
}

export function createCodexAgentsReceipt(
  input: CreateCodexAgentsReceiptInput,
): CodexAgentsReceipt {
  const agentArtifacts = input.artifacts.filter((artifact) =>
    isOwnedCodexAgentPath(artifact.path, input.root, input.scope));
  const managedAgentNames = agentArtifacts
    .map((artifact) => parseAgentName(artifact.content))
    .filter((name): name is string => name !== null)
    .sort();
  const installedAt = input.installedAt ?? new Date().toISOString();

  return {
    schemaVersion: codexAgentsReceiptSchemaVersion,
    pluginId: input.pluginId,
    pluginVersion: input.pluginVersion,
    ...(input.installedPluginPath
      ? { installedPluginPath: input.installedPluginPath }
      : {}),
    contentFingerprint: input.contentFingerprint,
    scope: input.scope,
    root: input.root,
    installedAt: typeof installedAt === "string" ? installedAt : installedAt.toISOString(),
    managedAgentNames,
    artifacts: agentArtifacts.map((artifact) => ({
      path: artifact.path,
      sha256: hashContent(artifact.content),
      bytes: Buffer.byteLength(artifact.content, "utf8"),
    })),
  };
}

export function getCodexAgentsReceiptOwnedPaths(
  receipt: CodexAgentsReceipt,
): readonly string[] {
  return receipt.artifacts.map((artifact) => artifact.path).sort();
}

export async function readCodexAgentsReceipt(
  receiptPath: string,
  expected?: {
    readonly root: string;
    readonly scope: CodexAgentsReceiptScope;
  },
): Promise<CodexAgentsReceipt | null> {
  try {
    const value = JSON.parse(await readFile(receiptPath, "utf8")) as unknown;
    if (!isCodexAgentsReceipt(value)) {
      throw new Error(`Invalid Codex agents receipt at ${receiptPath}.`);
    }
    if (
      expected
      && (
        resolve(value.root) !== resolve(expected.root)
        || value.scope !== expected.scope
      )
    ) {
      throw new Error(`Codex agents receipt root or scope mismatch at ${receiptPath}.`);
    }
    return value;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function writeCodexAgentsReceipt(
  receiptPath: string,
  receipt: CodexAgentsReceipt,
): Promise<void> {
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

export async function deleteCodexAgentsReceipt(receiptPath: string): Promise<void> {
  await rm(receiptPath, { force: true });
}
