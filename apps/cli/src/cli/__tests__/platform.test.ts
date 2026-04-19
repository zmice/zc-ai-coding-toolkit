import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMocks = vi.hoisted(() => ({
  ArtifactConflictError: class ArtifactConflictError extends Error {
    conflicts: { path: string }[];

    constructor(conflicts: { path: string }[]) {
      super("conflicts");
      this.conflicts = conflicts;
    }
  },
  createQwenGenerationPlan: vi.fn(),
  createCodexInstallPlan: vi.fn(),
  createQoderInstallPlan: vi.fn(),
  loadToolkitManifest: vi.fn(),
  importWorkspaceDistModule: vi.fn(),
  normalizeInstallSelector: vi.fn(),
  resolveInstallTarget: vi.fn(),
  resolvePlatformInstallReceiptPath: vi.fn(),
  resolvePlatformInstallStatus: vi.fn(),
  writeArtifacts: vi.fn(),
  writePlatformInstallReceiptForPlan: vi.fn(),
}));

vi.mock("../../utils/workspace.js", () => ({
  ArtifactConflictError: platformMocks.ArtifactConflictError,
  importWorkspaceDistModule: platformMocks.importWorkspaceDistModule,
  resolveWorkspacePath: vi.fn((relativePath: string) => `/workspace/${relativePath}`),
  writeArtifacts: platformMocks.writeArtifacts,
}));

vi.mock("../../utils/install-target.js", () => ({
  normalizeInstallSelector: platformMocks.normalizeInstallSelector,
  resolveInstallTarget: platformMocks.resolveInstallTarget,
}));

vi.mock("../../platform-state/status.js", () => ({
  resolvePlatformInstallStatus: platformMocks.resolvePlatformInstallStatus,
}));

vi.mock("../../utils/platform-install-receipt.js", () => ({
  resolvePlatformInstallReceiptPath: platformMocks.resolvePlatformInstallReceiptPath,
  writePlatformInstallReceiptForPlan: platformMocks.writePlatformInstallReceiptForPlan,
}));

import {
  runPlatformGenerate,
  runPlatformInstall,
  runPlatformStatus,
  runPlatformUpdate,
  runPlatformWhere,
} from "../platform.js";

function createGenerationPlan(artifacts: Array<{ path: string; content: string }>) {
  return {
    platform: "qwen" as const,
    packageName: "@zmice/platform-qwen",
    manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
    matchedAssets: [],
    artifacts,
  };
}

function createInstallPlan(
  platform: "codex" | "qoder",
  destinationRoot: string,
  artifacts: Array<{ path: string; content: string }>,
  scope: "project" | "global" | "dir" = "dir",
  overwrite: "error" | "force" = "error",
) {
  return {
    platform,
    packageName: platform === "codex" ? "@zmice/platform-codex" : "@zmice/platform-qoder",
    manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
    matchedAssets: [],
    destinationRoot,
    scope,
    overwrite,
    artifacts,
  };
}

describe("platform CLI", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    platformMocks.createQwenGenerationPlan.mockReset();
    platformMocks.createCodexInstallPlan.mockReset();
    platformMocks.createQoderInstallPlan.mockReset();
    platformMocks.loadToolkitManifest.mockReset();
    platformMocks.importWorkspaceDistModule.mockReset();
    platformMocks.normalizeInstallSelector.mockReset();
    platformMocks.resolveInstallTarget.mockReset();
    platformMocks.resolvePlatformInstallReceiptPath.mockReset();
    platformMocks.resolvePlatformInstallStatus.mockReset();
    platformMocks.writeArtifacts.mockReset();
    platformMocks.writePlatformInstallReceiptForPlan.mockReset();

    platformMocks.loadToolkitManifest.mockResolvedValue({
      generatedAt: "2026-04-19T12:00:00.000Z",
      contentRoot: "/repo/packages/toolkit/src/content",
      assets: [
        {
          id: "skill-alpha",
          body: "body",
          meta: {
            kind: "skill",
            name: "alpha",
            title: "Alpha",
            description: "desc",
            platforms: ["qwen", "codex"],
          },
        },
      ],
    });

    platformMocks.importWorkspaceDistModule.mockImplementation(async (relativePath: string) => {
      if (relativePath === "packages/toolkit/dist/index.js") {
        return { loadToolkitManifest: platformMocks.loadToolkitManifest };
      }

      if (relativePath === "packages/platform-qwen/dist/index.js") {
        return { createQwenGenerationPlan: platformMocks.createQwenGenerationPlan };
      }

      if (relativePath === "packages/platform-codex/dist/index.js") {
        return { createCodexInstallPlan: platformMocks.createCodexInstallPlan };
      }

      if (relativePath === "packages/platform-qoder/dist/index.js") {
        return { createQoderInstallPlan: platformMocks.createQoderInstallPlan };
      }

      throw new Error(`unexpected import: ${relativePath}`);
    });

    platformMocks.normalizeInstallSelector.mockImplementation((options: {
      dir?: string;
      global?: boolean;
    }) => ({
      dir: options.dir,
      mode: options.dir ? "dir" : options.global ? "global" : "project",
    }));

    platformMocks.resolveInstallTarget.mockImplementation(async (_target: string, options: { dir?: string; cwd?: string }) => ({
      root: options.dir ?? options.cwd ?? process.cwd(),
      source: options.dir ? "explicit" : "cwd",
    }));

    platformMocks.resolvePlatformInstallReceiptPath.mockImplementation((plan: { platform: string; destinationRoot: string }) => (
      `${plan.destinationRoot}/.zc/platform-state/${plan.platform}.install-receipt.json`
    ));

    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "up-to-date",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: {
        schemaVersion: 1,
        platform: "codex",
        destinationRoot: "/tmp/install",
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        zcVersion: "0.1.0",
        contentFingerprint: "installed-fingerprint",
        artifacts: [],
      },
      installedZcVersion: "0.1.0",
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "installed-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    platformMocks.writePlatformInstallReceiptForPlan.mockResolvedValue({});
  });

  it("uses safe overwrite defaults for platform generate writes", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformGenerate("qwen", { dir: "/tmp/out" });

    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/out/QWEN.md", content: "# context" }],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("prints a JSON plan without writing files when generate uses --plan", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformGenerate("qwen", { dir: "/tmp/out", plan: true, json: true });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "generate",
        target: "qwen",
        root: "/tmp/out",
        artifactCount: 1,
        artifacts: [{ path: "/tmp/out/QWEN.md", content: "# context" }],
      }),
    );

    logSpy.mockRestore();
  });

  it("uses safe overwrite defaults for platform install and writes a receipt", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformInstall("codex", { dir: "/tmp/install" });

    expect(platformMocks.createCodexInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/tmp/install",
        scope: "dir",
        overwrite: "error",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      { dryRun: false, overwrite: "error" },
    );
    expect(platformMocks.writePlatformInstallReceiptForPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationRoot: "/tmp/install",
      }),
      expect.objectContaining({
        zcVersion: expect.any(String),
      }),
    );
  });

  it("forwards force installs to artifact writes", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 1,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformInstall("codex", { dir: "/tmp/install", force: true });

    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      { dryRun: false, overwrite: "force" },
    );
  });

  it("uses the resolved project root when install target is omitted", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/workspace/project", [{ path: "/workspace/project/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/workspace/project",
      source: "project-root",
      marker: "package.json",
    });

    await runPlatformInstall("codex", {});

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("codex", {
      dir: undefined,
      cwd: process.cwd(),
      project: undefined,
      global: undefined,
    });
    expect(platformMocks.createCodexInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/workspace/project",
        scope: "project",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("安装目录自动解析（project-root）"),
    );

    logSpy.mockRestore();
  });

  it("prints a JSON install plan without writing files when install uses --plan", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }], "dir", "error"),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformInstall("codex", { dir: "/tmp/install", plan: true, json: true });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "install",
        target: "codex",
        root: "/tmp/install",
        scope: "dir",
        rootSource: "explicit",
        artifactCount: 1,
        overwrite: "error",
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            path: "/tmp/install/AGENTS.md",
            content: "# agents",
          }),
        ]),
      }),
    );

    logSpy.mockRestore();
  });

  it("prints platform status from receipt and current plan", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/tmp/install",
      source: "explicit",
    });
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );

    await runPlatformStatus("codex", { dir: "/tmp/install", json: true });

    expect(platformMocks.resolvePlatformInstallStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationRoot: "/tmp/install",
      }),
    );
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "status",
        target: "codex",
        root: "/tmp/install",
        status: "up-to-date",
        installedContentFingerprint: "installed-fingerprint",
        contentFingerprint: "current-fingerprint",
      }),
    );

    logSpy.mockRestore();
  });

  it("prints update plan when status shows update-available", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "update-available",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: null,
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "installed-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 1,
      },
      artifacts: [],
    });
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents v2" }], "dir", "error"),
    );

    await runPlatformUpdate("codex", { dir: "/tmp/install", plan: true, json: true });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "update",
        target: "codex",
        status: "update-available",
        root: "/tmp/install",
      }),
    );

    logSpy.mockRestore();
  });

  it("treats update-available as managed overwrite and refreshes the receipt", async () => {
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "update-available",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: null,
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "installed-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 1,
      },
      artifacts: [],
    });
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents v2" }], "dir", "error"),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 1,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformUpdate("codex", { dir: "/tmp/install" });

    expect(platformMocks.createCodexInstallPlan).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/tmp/install",
        overwrite: "force",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents v2" }],
      { dryRun: false, overwrite: "force" },
    );
    expect(platformMocks.writePlatformInstallReceiptForPlan).toHaveBeenCalled();
  });

  it("reports a no-op update when the installation is already up-to-date", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );

    await runPlatformUpdate("codex", { dir: "/tmp/install", json: true });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "result",
        action: "update",
        target: "codex",
        status: "up-to-date",
        noop: true,
      }),
    );

    logSpy.mockRestore();
  });

  it("requires force when the installation drifted", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "drifted",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: null,
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "installed-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 1,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    await runPlatformUpdate("codex", { dir: "/tmp/install" });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "codex 安装目录已漂移。请先运行 `zc platform status codex` 检查差异，确认后追加 `--force` 再更新。",
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it("rejects update when the target has never been installed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "not-installed",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: null,
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: undefined,
      summary: {
        trackedArtifacts: 0,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    await runPlatformUpdate("codex", { dir: "/tmp/install" });

    expect(errorSpy).toHaveBeenCalledWith(
      "codex 尚未安装到该目录。请先运行 `zc platform install codex`。",
    );
    expect(process.exitCode).toBe(1);

    errorSpy.mockRestore();
  });

  it("passes global scope through install target resolution and exposes official path hints", async () => {
    platformMocks.createQoderInstallPlan.mockReturnValue(
      createInstallPlan("qoder", "/home/test/.qoder", [{ path: "/home/test/.qoder/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qoder",
      source: "official-global",
      hint: "Qoder 官方文档定义用户级 memory 文件位于 `~/.qoder/AGENTS.md`。",
    });

    await runPlatformInstall("qoder", { global: true });

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("qoder", {
      dir: undefined,
      cwd: process.cwd(),
      project: undefined,
      global: true,
    });
    expect(platformMocks.createQoderInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/home/test/.qoder",
        scope: "global",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("提示：Qoder 官方文档定义用户级 memory 文件位于 `~/.qoder/AGENTS.md`。"));

    logSpy.mockRestore();
  });

  it("prints a JSON install plan with scope metadata", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/home/test/.codex", [{ path: "/home/test/.codex/AGENTS.md", content: "# agents" }], "global", "error"),
    );
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.codex",
      source: "official-global",
      hint: "Codex 官方文档将 Codex home（默认 `~/.codex`）定义为全局级 `AGENTS.md` 的位置。",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformInstall("codex", { global: true, plan: true, json: true });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "install",
        target: "codex",
        scope: "global",
        root: "/home/test/.codex",
        rootSource: "official-global",
        hint: "Codex 官方文档将 Codex home（默认 `~/.codex`）定义为全局级 `AGENTS.md` 的位置。",
      }),
    );

    logSpy.mockRestore();
  });

  it("prints resolved install targets via platform where", async () => {
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.codex",
      source: "official-global",
      hint: "Codex 官方文档将 Codex home（默认 `~/.codex`）定义为全局级 `AGENTS.md` 的位置。",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformWhere("codex", { global: true, json: true });

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("codex", {
      dir: undefined,
      cwd: process.cwd(),
      project: undefined,
      global: true,
    });
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "where",
        target: "codex",
        scope: "global",
        root: "/home/test/.codex",
        rootSource: "official-global",
      }),
    );

    logSpy.mockRestore();
  });

  it("resolves qwen global scope to the user-level ~/.qwen directory", async () => {
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`，并在官方帮助文档中给出 Qwen CLI 的用户级 `QWEN.md` 位置为 `~/.qwen/QWEN.md`。",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformWhere("qwen", { global: true, json: true });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "where",
        target: "qwen",
        scope: "global",
        root: "/home/test/.qwen",
        rootSource: "official-global",
        hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`，并在官方帮助文档中给出 Qwen CLI 的用户级 `QWEN.md` 位置为 `~/.qwen/QWEN.md`。",
      }),
    );

    logSpy.mockRestore();
  });
});
