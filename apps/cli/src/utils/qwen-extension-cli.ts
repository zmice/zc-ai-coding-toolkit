import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

import { writeArtifacts, type GeneratedArtifact } from "./workspace.js";

export class QwenOfficialCliUnavailableError extends Error {
  constructor(message: string = "未检测到 qwen CLI，无法通过官方扩展命令安装。") {
    super(message);
    this.name = "QwenOfficialCliUnavailableError";
  }
}

export class QwenExtensionsCommandError extends Error {
  readonly command: string;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(options: {
    command: string;
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }) {
    super(
      options.signal
        ? `${options.command} 被信号 ${options.signal} 中断。`
        : `${options.command} 退出码为 ${options.exitCode ?? "unknown"}。`,
    );
    this.name = "QwenExtensionsCommandError";
    this.command = options.command;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
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

export interface QwenOfficialCliReleaseBundle {
  readonly bundleDir: string;
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

export function resolveQwenOfficialCliReleaseBundleDir(plan: QwenInstallPlanLike): string {
  const extension = getExtensionCapability(plan);
  return resolve(plan.destinationRoot, ".zc", "platform-bundles", "qwen", extension.name);
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

export async function syncQwenOfficialCliReleaseBundle(
  plan: QwenInstallPlanLike,
  bundleDirOverride?: string,
): Promise<QwenOfficialCliReleaseBundle> {
  const extension = getExtensionCapability(plan);
  const bundleDir = bundleDirOverride ? resolve(bundleDirOverride) : resolveQwenOfficialCliReleaseBundleDir(plan);
  const releaseArtifacts = toQwenOfficialCliReleaseArtifacts(plan, bundleDir);

  await rm(bundleDir, { recursive: true, force: true });
  await writeArtifacts(releaseArtifacts, {
    overwrite: "force",
    dryRun: false,
  });

  return {
    bundleDir,
    extensionName: extension.name,
    artifactCount: releaseArtifacts.length,
  };
}

export function toQwenOfficialCliReleaseArtifacts(
  plan: QwenInstallPlanLike,
  bundleDirOverride?: string,
): readonly GeneratedArtifact[] {
  const bundleDir = bundleDirOverride ? resolve(bundleDirOverride) : resolveQwenOfficialCliReleaseBundleDir(plan);
  const sourceArtifacts = toQwenOfficialCliSourceArtifacts(plan);
  const sourceDir = resolveQwenOfficialCliSourceDir(plan);

  return sourceArtifacts.map((artifact) => ({
    path: artifact.path.replace(sourceDir, bundleDir),
    content: artifact.content,
  }));
}

async function runQwenExtensionsCommand(args: readonly string[]): Promise<void> {
  const command = `qwen ${args.join(" ")}`;

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn("qwen", args, {
      stdio: "pipe",
    }) as ChildProcessWithoutNullStreams;
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      stderr += text;
      process.stderr.write(text);
    });

    child.once("error", (error) => {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        rejectPromise(new QwenOfficialCliUnavailableError());
        return;
      }

      rejectPromise(new Error(`${command} 执行失败：${error instanceof Error ? error.message : "未知错误"}`));
    });

    child.once("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(new QwenExtensionsCommandError({
        command,
        exitCode: code,
        signal,
        stdout,
        stderr,
      }));
    });
  });
}

export async function installQwenExtensionWithOfficialCli(sourceDir: string): Promise<void> {
  await runQwenExtensionsCommand(["extensions", "link", sourceDir]);
}

export async function updateQwenExtensionWithOfficialCli(extensionName: string): Promise<void> {
  try {
    await runQwenExtensionsCommand(["extensions", "uninstall", extensionName]);
  } catch (error) {
    if (
      error instanceof QwenExtensionsCommandError &&
      /extension not found/i.test(`${error.stdout}\n${error.stderr}`)
    ) {
      return;
    }

    throw error;
  }
}

export async function uninstallQwenExtensionWithOfficialCli(extensionName: string): Promise<void> {
  await updateQwenExtensionWithOfficialCli(extensionName);
}

export async function relinkQwenExtensionWithOfficialCli(sourceDir: string): Promise<void> {
  await runQwenExtensionsCommand(["extensions", "link", sourceDir]);
}
