import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { writeArtifacts, type GeneratedArtifact } from "./workspace.js";

const execFileAsync = promisify(execFile);

export class QwenOfficialCliUnavailableError extends Error {
  constructor(message: string = "未检测到 qwen CLI，无法通过官方扩展命令安装。") {
    super(message);
    this.name = "QwenOfficialCliUnavailableError";
  }
}

export interface QwenExtensionCapabilityLike {
  readonly relativeDir: string;
  readonly name: string;
}

export interface QwenInstallPlanLike {
  readonly destinationRoot: string;
  readonly artifacts: readonly GeneratedArtifact[];
  readonly capability?: {
    readonly extension?: QwenExtensionCapabilityLike;
  };
}

export interface QwenOfficialCliSourceBundle {
  readonly sourceDir: string;
  readonly extensionName: string;
  readonly artifactCount: number;
}

function getExtensionCapability(plan: QwenInstallPlanLike): QwenExtensionCapabilityLike {
  const extension = plan.capability?.extension;

  if (!extension) {
    throw new Error("Qwen 安装计划缺少 extension 能力描述。");
  }

  return extension;
}

function resolveInstalledExtensionRoot(plan: QwenInstallPlanLike): string {
  const extension = getExtensionCapability(plan);
  return resolve(plan.destinationRoot, extension.relativeDir, extension.name);
}

export function resolveQwenOfficialCliSourceDir(plan: QwenInstallPlanLike): string {
  const extension = getExtensionCapability(plan);
  return resolve(plan.destinationRoot, ".zc", "platform-sources", "qwen", extension.name);
}

export function toQwenOfficialCliSourceArtifacts(plan: QwenInstallPlanLike): readonly GeneratedArtifact[] {
  const installedExtensionRoot = resolveInstalledExtensionRoot(plan);
  const normalizedRoot = `${installedExtensionRoot}/`;
  const sourceDir = resolveQwenOfficialCliSourceDir(plan);

  return plan.artifacts.map((artifact) => {
    const artifactPath = resolve(artifact.path);
    const insideExtensionRoot = artifactPath === installedExtensionRoot || artifactPath.startsWith(normalizedRoot);

    if (!insideExtensionRoot) {
      throw new Error(`Qwen 安装计划产物不在 extension 根目录内：${artifact.path}`);
    }

    const relativePath = relative(installedExtensionRoot, artifactPath);
    return {
      path: join(sourceDir, relativePath),
      content: artifact.content,
    };
  });
}

export async function syncQwenOfficialCliSourceBundle(
  plan: QwenInstallPlanLike,
): Promise<QwenOfficialCliSourceBundle> {
  const extension = getExtensionCapability(plan);
  const sourceDir = resolveQwenOfficialCliSourceDir(plan);
  const sourceArtifacts = toQwenOfficialCliSourceArtifacts(plan);

  await rm(sourceDir, { recursive: true, force: true });
  await writeArtifacts(sourceArtifacts, {
    overwrite: "force",
    dryRun: false,
  });

  return {
    sourceDir,
    extensionName: extension.name,
    artifactCount: sourceArtifacts.length,
  };
}

async function runQwenExtensionsCommand(args: readonly string[]): Promise<void> {
  try {
    await execFileAsync("qwen", args, { encoding: "utf8" });
  } catch (error) {
    const command = `qwen ${args.join(" ")}`;

    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      throw new QwenOfficialCliUnavailableError();
    }

    const stderr = typeof error === "object" && error !== null && "stderr" in error
      ? String(error.stderr ?? "").trim()
      : "";
    const stdout = typeof error === "object" && error !== null && "stdout" in error
      ? String(error.stdout ?? "").trim()
      : "";
    const message = stderr || stdout || (error instanceof Error ? error.message : "未知错误");

    throw new Error(`${command} 执行失败：${message}`);
  }
}

export async function installQwenExtensionWithOfficialCli(sourceDir: string): Promise<void> {
  await runQwenExtensionsCommand(["extensions", "install", sourceDir]);
}

export async function updateQwenExtensionWithOfficialCli(extensionName: string): Promise<void> {
  await runQwenExtensionsCommand(["extensions", "update", extensionName]);
}
