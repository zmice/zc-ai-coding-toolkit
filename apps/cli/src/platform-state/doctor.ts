import type {
  PlatformInstallDoctorIssue,
  PlatformInstallDoctorResult,
  PlatformInstallPlanLike,
  PlatformInstallStatusResult,
} from "./types.js";
import { pathExists } from "../utils/platform-install-cleanup.js";

function getHealth(issues: readonly PlatformInstallDoctorIssue[]): PlatformInstallDoctorResult["health"] {
  if (issues.some((issue) => issue.severity === "broken")) {
    return "broken";
  }

  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }

  return "healthy";
}

export async function resolvePlatformInstallDoctor(
  plan: PlatformInstallPlanLike,
  status: PlatformInstallStatusResult,
): Promise<PlatformInstallDoctorResult> {
  const issues: PlatformInstallDoctorIssue[] = [];

  if (status.kind === "not-installed") {
    const unmanagedPaths = status.artifacts
      .filter((artifact) => artifact.actualSha256 !== null)
      .map((artifact) => artifact.path);

    if (unmanagedPaths.length > 0) {
      issues.push({
        code: "unmanaged-artifacts-detected",
        severity: "warning",
        message: "发现疑似平台产物，但当前目录没有受管回执。",
        paths: unmanagedPaths,
      });
    } else {
      issues.push({
        code: "not-installed",
        severity: "info",
        message: "当前目录尚未建立受管安装状态。",
      });
    }
  }

  if (status.kind === "update-available") {
    issues.push({
      code: "update-available",
      severity: "warning",
      message: "当前安装内容落后于最新 toolkit 产物，可执行 update 或 repair。",
      paths: status.artifacts
        .filter((artifact) => artifact.differsFromPlan)
        .map((artifact) => artifact.path),
    });
  }

  if (status.kind === "drifted") {
    const driftedPaths = status.artifacts
      .filter((artifact) => artifact.matchesReceiptOnDisk === false)
      .map((artifact) => artifact.path);
    const missingPaths = status.artifacts
      .filter((artifact) => artifact.receiptSha256 !== null && artifact.actualSha256 === null)
      .map((artifact) => artifact.path);
    const stalePaths = status.artifacts
      .filter((artifact) => artifact.receiptSha256 !== null && artifact.plannedSha256 === null)
      .map((artifact) => artifact.path);

    if (driftedPaths.length > 0) {
      issues.push({
        code: "drifted-artifacts",
        severity: "broken",
        message: "受管产物和回执记录不一致，安装目录已漂移。",
        paths: driftedPaths,
      });
    }

    if (missingPaths.length > 0) {
      issues.push({
        code: "missing-artifacts",
        severity: "broken",
        message: "部分受管产物缺失，可执行 repair 进行恢复。",
        paths: missingPaths,
      });
    }

    if (stalePaths.length > 0) {
      issues.push({
        code: "stale-managed-artifacts",
        severity: "warning",
        message: "存在旧回执跟踪但当前计划已不再生成的历史产物。",
        paths: stalePaths,
      });
    }
  }

  if (status.receipt?.installMethod === "qwen-cli") {
    const bundlePath = status.receipt.bundlePath;

    if (!bundlePath || !(await pathExists(bundlePath))) {
      issues.push({
        code: "qwen-bundle-missing",
        severity: "warning",
        message: "Qwen 发布态 bundle 缺失，可执行 repair 重新生成并 relink。",
        paths: bundlePath ? [bundlePath] : [],
      });
    }
  }

  return {
    platform: plan.platform,
    health: getHealth(issues),
    issues,
  };
}
