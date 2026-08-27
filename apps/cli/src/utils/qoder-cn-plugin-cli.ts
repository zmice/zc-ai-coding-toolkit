import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { rm } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  attachPlanMetadata,
  qoderCnPluginName,
  type InstallPlan,
} from "@zmice/platform-core";

import { spawnCommand } from "./cross-platform-spawn.js";
import { writeArtifacts } from "./workspace.js";

export class QoderCnOfficialCliUnavailableError extends Error {
  constructor(message: string = "未检测到 qodercn CLI，无法通过 Qoder CN 官方插件命令安装。") {
    super(message);
    this.name = "QoderCnOfficialCliUnavailableError";
  }
}

export class QoderCnPluginsCommandError extends Error {
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
    this.name = "QoderCnPluginsCommandError";
    this.command = options.command;
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.stdout = options.stdout;
    this.stderr = options.stderr;
  }
}

export { qoderCnPluginName };

export function resolveQoderCnOfficialCliBundleDir(plan: Pick<InstallPlan, "destinationRoot">): string {
  return resolve(plan.destinationRoot, ".zc", "platform-bundles", "qoder-cn", qoderCnPluginName);
}

function assertRelativeArtifactPath(destinationRoot: string, artifactPath: string): string {
  const relativePath = relative(resolve(destinationRoot), resolve(artifactPath));
  const isInsideRoot = relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);

  if (!isInsideRoot) {
    throw new Error(`Qoder CN 安装计划产物不在目标根目录内：${artifactPath}`);
  }

  return relativePath;
}

export function toQoderCnOfficialCliInstallPlan(plan: InstallPlan): InstallPlan {
  const bundleDir = resolveQoderCnOfficialCliBundleDir(plan);
  const artifacts = plan.artifacts.map((artifact) => ({
    path: join(bundleDir, assertRelativeArtifactPath(plan.destinationRoot, artifact.path)),
    content: artifact.content,
  }));

  return attachPlanMetadata({
    ...plan,
    artifacts,
  });
}

export async function syncQoderCnOfficialCliBundle(plan: InstallPlan): Promise<{
  readonly bundleDir: string;
  readonly artifactCount: number;
}> {
  const bundleDir = resolveQoderCnOfficialCliBundleDir(plan);

  for (const artifact of plan.artifacts) {
    assertRelativeArtifactPath(bundleDir, artifact.path);
  }

  await rm(bundleDir, { recursive: true, force: true });
  await writeArtifacts(plan.artifacts, {
    overwrite: "force",
    dryRun: false,
  });

  return {
    bundleDir,
    artifactCount: plan.artifacts.length,
  };
}

async function runQoderCnPluginsCommand(args: readonly string[]): Promise<{
  readonly stdout: string;
  readonly stderr: string;
}> {
  const command = `qodercn ${args.join(" ")}`;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawnCommand("qodercn", args, {
      stdio: "pipe",
    }) as ChildProcessWithoutNullStreams;
    let stdout = "";
    let stderr = "";
    let stdinWasResumed = false;

    const cleanupStdinForwarding = () => {
      process.stdin.removeListener("error", handleStdinError);
      if (child.stdin.writable) {
        process.stdin.unpipe(child.stdin);
      }
      if (stdinWasResumed && !process.stdin.destroyed && !process.stdin.isTTY) {
        process.stdin.pause();
      }
    };

    const handleStdinError = () => {
      cleanupStdinForwarding();
    };

    if (!process.stdin.destroyed) {
      stdinWasResumed = process.stdin.isPaused();
      if (stdinWasResumed) process.stdin.resume();
      process.stdin.on("error", handleStdinError);
      process.stdin.pipe(child.stdin);
    }

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
      cleanupStdinForwarding();
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
        rejectPromise(new QoderCnOfficialCliUnavailableError());
        return;
      }

      rejectPromise(new Error(`${command} 执行失败：${error instanceof Error ? error.message : "未知错误"}`));
    });

    child.once("close", (code, signal) => {
      cleanupStdinForwarding();
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(new QoderCnPluginsCommandError({
        command,
        exitCode: code,
        signal,
        stdout,
        stderr,
      }));
    });
  });
}

export async function installQoderCnPluginWithOfficialCli(bundleDir: string): Promise<void> {
  const resolvedBundleDir = resolve(bundleDir);
  await runQoderCnPluginsCommand(["plugins", "validate", resolvedBundleDir]);
  await runQoderCnPluginsCommand(["plugins", "install", resolvedBundleDir]);
}

export async function uninstallQoderCnPluginWithOfficialCli(
  pluginName: string = qoderCnPluginName,
): Promise<void> {
  try {
    await runQoderCnPluginsCommand(["plugins", "uninstall", pluginName]);
  } catch (error) {
    if (
      error instanceof QoderCnPluginsCommandError
      && /not found|not installed|未安装|不存在/i.test(`${error.stdout}\n${error.stderr}`)
    ) {
      return;
    }

    throw error;
  }
}

export async function reinstallQoderCnPluginWithOfficialCli(bundleDir: string): Promise<void> {
  await uninstallQoderCnPluginWithOfficialCli();
  await installQoderCnPluginWithOfficialCli(bundleDir);
}
