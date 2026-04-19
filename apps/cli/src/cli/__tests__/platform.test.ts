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
  createQwenInstallPlan: vi.fn(),
  createCodexInstallPlan: vi.fn(),
  createClaudeInstallPlan: vi.fn(),
  createOpenCodeInstallPlan: vi.fn(),
  loadToolkitManifest: vi.fn(),
  importWorkspaceDistModule: vi.fn(),
  normalizeInstallSelector: vi.fn(),
  pathExists: vi.fn(),
  resolveInstallTarget: vi.fn(),
  resolvePlatformInstallDoctor: vi.fn(),
  resolvePlatformInstallReceiptPath: vi.fn(),
  resolvePlatformInstallStatus: vi.fn(),
  removeManagedPaths: vi.fn(),
  deletePlatformInstallReceipt: vi.fn(),
  writeArtifacts: vi.fn(),
  writePlatformInstallReceiptForPlan: vi.fn(),
  syncQwenOfficialCliSourceBundle: vi.fn(),
  syncQwenOfficialCliReleaseBundle: vi.fn(),
  toQwenOfficialCliReleaseArtifacts: vi.fn(),
  installQwenExtensionFromOfficialRepoWithCli: vi.fn(),
  installQwenExtensionWithOfficialCli: vi.fn(),
  uninstallQwenExtensionWithOfficialCli: vi.fn(),
  updateQwenExtensionWithOfficialCli: vi.fn(),
  relinkQwenExtensionWithOfficialCli: vi.fn(),
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

vi.mock("../../platform-state/doctor.js", () => ({
  resolvePlatformInstallDoctor: platformMocks.resolvePlatformInstallDoctor,
}));

vi.mock("../../utils/platform-install-receipt.js", () => ({
  deletePlatformInstallReceipt: platformMocks.deletePlatformInstallReceipt,
  resolvePlatformInstallReceiptPath: platformMocks.resolvePlatformInstallReceiptPath,
  writePlatformInstallReceiptForPlan: platformMocks.writePlatformInstallReceiptForPlan,
}));

vi.mock("../../utils/platform-install-cleanup.js", () => ({
  pathExists: platformMocks.pathExists,
  removeManagedPaths: platformMocks.removeManagedPaths,
}));

vi.mock("../../utils/qwen-extension-cli.js", () => ({
  QwenOfficialCliUnavailableError: class QwenOfficialCliUnavailableError extends Error {},
  qwenOfficialExtensionRepoUrl: "https://github.com/zmice/zc-qwen-extension.git",
  syncQwenOfficialCliSourceBundle: platformMocks.syncQwenOfficialCliSourceBundle,
  syncQwenOfficialCliReleaseBundle: platformMocks.syncQwenOfficialCliReleaseBundle,
  toQwenOfficialCliReleaseArtifacts: platformMocks.toQwenOfficialCliReleaseArtifacts,
  resolveQwenOfficialCliReleaseBundleDir: vi.fn((plan: { destinationRoot: string }) => (
    `${plan.destinationRoot}/.zc/platform-bundles/qwen/zc-toolkit`
  )),
  installQwenExtensionFromOfficialRepoWithCli: platformMocks.installQwenExtensionFromOfficialRepoWithCli,
  installQwenExtensionWithOfficialCli: platformMocks.installQwenExtensionWithOfficialCli,
  uninstallQwenExtensionWithOfficialCli: platformMocks.uninstallQwenExtensionWithOfficialCli,
  updateQwenExtensionWithOfficialCli: platformMocks.updateQwenExtensionWithOfficialCli,
  relinkQwenExtensionWithOfficialCli: platformMocks.relinkQwenExtensionWithOfficialCli,
}));

import {
  runPlatformGenerate,
  runPlatformInstall,
  runPlatformDoctor,
  runPlatformRepair,
  runPlatformStatus,
  runPlatformUninstall,
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
  platform: "codex" | "claude",
  destinationRoot: string,
  artifacts: Array<{ path: string; content: string }>,
  scope: "project" | "global" | "dir" = "dir",
  overwrite: "error" | "force" = "error",
) {
  const capability = platform === "codex"
    ? {
        namespace: "zc",
        surfaces: ["entry-file", "skills-dir"],
        entryFile: "AGENTS.md",
        commandsDir: null,
        skillsDir: "skills",
        agentsDir: null,
        extensionDir: null,
      }
    : {
        namespace: "zc",
        surfaces: ["entry-file", "commands-dir", "skills-dir", "agents-dir"],
        entryFile: "AGENTS.md",
        commandsDir: "commands",
        skillsDir: "skills",
        agentsDir: "agents",
        extensionDir: null,
      };

  return {
    platform,
    packageName: platform === "codex" ? "@zmice/platform-codex" : "@zmice/platform-claude",
    manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
    matchedAssets: [],
    destinationRoot,
    scope,
    overwrite,
    capability,
    artifacts,
  };
}

function createQwenInstallPlan(
  destinationRoot: string,
  artifacts: Array<{ path: string; content: string }>,
  scope: "project" | "global" | "dir" = "dir",
  overwrite: "error" | "force" = "error",
) {
  return {
    platform: "qwen" as const,
    packageName: "@zmice/platform-qwen",
    manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
    matchedAssets: [],
    destinationRoot,
    scope,
    overwrite,
    capability: {
      namespace: "zc",
      surfaces: ["entry-file", "commands-dir", "skills-dir", "agents-dir", "extension-dir"],
      entryFile: "QWEN.md",
      commandsDir: "commands/zc",
      skillsDir: "skills",
      agentsDir: "agents",
      extensionDir: "extensions/zc-toolkit",
      extension: {
        relativeDir: "extensions",
        name: "zc-toolkit",
        manifestFile: "qwen-extension.json",
        contextFileName: "QWEN.md",
      },
    },
    artifacts,
  };
}

describe("platform CLI", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    platformMocks.createQwenGenerationPlan.mockReset();
    platformMocks.createQwenInstallPlan.mockReset();
    platformMocks.createCodexInstallPlan.mockReset();
    platformMocks.createClaudeInstallPlan.mockReset();
    platformMocks.createOpenCodeInstallPlan.mockReset();
    platformMocks.loadToolkitManifest.mockReset();
    platformMocks.importWorkspaceDistModule.mockReset();
    platformMocks.normalizeInstallSelector.mockReset();
    platformMocks.pathExists.mockReset();
    platformMocks.resolveInstallTarget.mockReset();
    platformMocks.resolvePlatformInstallDoctor.mockReset();
    platformMocks.resolvePlatformInstallReceiptPath.mockReset();
    platformMocks.resolvePlatformInstallStatus.mockReset();
    platformMocks.removeManagedPaths.mockReset();
    platformMocks.deletePlatformInstallReceipt.mockReset();
    platformMocks.writeArtifacts.mockReset();
    platformMocks.writePlatformInstallReceiptForPlan.mockReset();
    platformMocks.syncQwenOfficialCliSourceBundle.mockReset();
    platformMocks.syncQwenOfficialCliReleaseBundle.mockReset();
    platformMocks.toQwenOfficialCliReleaseArtifacts.mockReset();
    platformMocks.installQwenExtensionFromOfficialRepoWithCli.mockReset();
    platformMocks.installQwenExtensionWithOfficialCli.mockReset();
    platformMocks.uninstallQwenExtensionWithOfficialCli.mockReset();
    platformMocks.updateQwenExtensionWithOfficialCli.mockReset();
    platformMocks.relinkQwenExtensionWithOfficialCli.mockReset();

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
        return {
          createQwenGenerationPlan: platformMocks.createQwenGenerationPlan,
          createQwenInstallPlan: platformMocks.createQwenInstallPlan,
        };
      }

      if (relativePath === "packages/platform-codex/dist/index.js") {
        return { createCodexInstallPlan: platformMocks.createCodexInstallPlan };
      }

      if (relativePath === "packages/platform-claude/dist/index.js") {
        return { createClaudeInstallPlan: platformMocks.createClaudeInstallPlan };
      }

      if (relativePath === "packages/platform-opencode/dist/index.js") {
        return { createOpenCodeInstallPlan: platformMocks.createOpenCodeInstallPlan };
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
    platformMocks.resolvePlatformInstallDoctor.mockResolvedValue({
      platform: "codex",
      health: "healthy",
      issues: [],
    });
    platformMocks.pathExists.mockResolvedValue(true);
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 1,
      missing: 0,
    });
    platformMocks.deletePlatformInstallReceipt.mockResolvedValue(undefined);

    platformMocks.writePlatformInstallReceiptForPlan.mockResolvedValue({});
    platformMocks.syncQwenOfficialCliSourceBundle.mockResolvedValue({
      sourceDir: "/tmp/qwen-source",
      extensionName: "zc-toolkit",
      artifactCount: 1,
    });
    platformMocks.syncQwenOfficialCliReleaseBundle.mockResolvedValue({
      bundleDir: "/tmp/qwen-release",
      extensionName: "zc-toolkit",
      artifactCount: 1,
    });
    platformMocks.toQwenOfficialCliReleaseArtifacts.mockImplementation(
      (_plan: unknown, bundleDir: string) => [
        { path: `${bundleDir}/QWEN.md`, content: "# context" },
        { path: `${bundleDir}/commands/zc/start.md`, content: "# start" },
      ],
    );
    platformMocks.installQwenExtensionFromOfficialRepoWithCli.mockResolvedValue(undefined);
    platformMocks.installQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.uninstallQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.updateQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.relinkQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
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

  it("exports a standalone qwen release bundle during generate", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/tmp/zc-toolkit",
        [
          { path: "/tmp/zc-toolkit/extensions/zc-toolkit/QWEN.md", content: "# context" },
          { path: "/tmp/zc-toolkit/extensions/zc-toolkit/commands/zc/start.md", content: "# start" },
        ],
      ),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 2,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformGenerate("qwen", { dir: "/tmp/zc-toolkit", bundle: "release-bundle" });

    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: "/tmp/zc-toolkit/QWEN.md", content: "# context" },
        { path: "/tmp/zc-toolkit/commands/zc/start.md", content: "# start" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("prints qwen release bundle plan paths without native extension nesting", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/tmp/zc-toolkit",
        [
          { path: "/tmp/zc-toolkit/extensions/zc-toolkit/QWEN.md", content: "# context" },
          { path: "/tmp/zc-toolkit/extensions/zc-toolkit/commands/zc/start.md", content: "# start" },
        ],
      ),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformGenerate("qwen", {
      dir: "/tmp/zc-toolkit",
      bundle: "release-bundle",
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "generate",
      target: "qwen",
      root: "/tmp/zc-toolkit",
      bundleType: "release-bundle",
      bundlePath: "/tmp/zc-toolkit",
      artifacts: [
        { path: "/tmp/zc-toolkit/QWEN.md", content: "# context" },
        { path: "/tmp/zc-toolkit/commands/zc/start.md", content: "# start" },
      ],
    }));

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

  it("prints qwen platform status json with installed metadata from receipt", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`。",
    });
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/home/test/.qwen",
        [{ path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md", content: "# context" }],
        "global",
      ),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "up-to-date",
      platform: "qwen",
      receiptPath: "/home/test/.qwen/.zc/platform-state/qwen.install-receipt.json",
      receipt: {
        schemaVersion: 1,
        platform: "qwen",
        destinationRoot: "/home/test/.qwen",
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "filesystem",
        installSource: "local-bundle",
        sourceRef: "/tmp/qwen-release/zc-toolkit",
        bundleType: "release-bundle",
        bundlePath: "/tmp/qwen-release/zc-toolkit",
        artifacts: [
          {
            path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md",
            sha256: "sha",
            bytes: 9,
          },
        ],
      },
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "current-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    await runPlatformStatus("qwen", { global: true, json: true });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "status",
        target: "qwen",
        root: "/home/test/.qwen",
        installMethod: "filesystem",
        installSource: "local-bundle",
        sourceRef: "/tmp/qwen-release/zc-toolkit",
        bundleType: "release-bundle",
        bundlePath: "/tmp/qwen-release/zc-toolkit",
        recommendedInstallMethod: "qwen-cli",
        recommendedInstallSource: "github-repo",
        recommendedSourceRef: "https://github.com/zmice/zc-qwen-extension.git",
        recommendedBundleType: "release-bundle",
        recommendedBundlePath: "/home/test/.qwen/.zc/platform-bundles/qwen/zc-toolkit",
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
    platformMocks.createClaudeInstallPlan.mockReturnValue(
      createInstallPlan("claude", "/home/test/.claude", [{ path: "/home/test/.claude/CLAUDE.md", content: "# claude" }]),
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
      root: "/home/test/.claude",
      source: "official-global",
      hint: "Claude Code 官方文档定义用户级 memory 文件位于 `~/.claude/CLAUDE.md`。",
    });

    await runPlatformInstall("claude", { global: true });

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("claude", {
      dir: undefined,
      cwd: process.cwd(),
      project: undefined,
      global: true,
    });
    expect(platformMocks.createClaudeInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/home/test/.claude",
        scope: "global",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("提示：Claude Code 官方文档定义用户级 memory 文件位于 `~/.claude/CLAUDE.md`。"));

    logSpy.mockRestore();
  });

  it("prefers the official qwen extensions CLI for global installs", async () => {
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/home/test/.qwen",
        [{ path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md", content: "# context" }],
        "global",
      ),
    );
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`。",
    });
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "not-installed",
      platform: "qwen",
      receiptPath: "/home/test/.qwen/.zc/platform-state/qwen.install-receipt.json",
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

    await runPlatformInstall("qwen", { global: true });

    expect(platformMocks.installQwenExtensionFromOfficialRepoWithCli).toHaveBeenCalledWith(
      "https://github.com/zmice/zc-qwen-extension.git",
    );
    expect(platformMocks.syncQwenOfficialCliReleaseBundle).not.toHaveBeenCalled();
    expect(platformMocks.installQwenExtensionWithOfficialCli).not.toHaveBeenCalled();
    expect(platformMocks.relinkQwenExtensionWithOfficialCli).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
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

  it("prefers the official qwen extensions CLI for global updates", async () => {
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/home/test/.qwen",
        [{ path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md", content: "# context v2" }],
        "global",
      ),
    );
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`。",
    });
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "update-available",
      platform: "qwen",
      receiptPath: "/home/test/.qwen/.zc/platform-state/qwen.install-receipt.json",
      receipt: null,
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "installed-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 1,
      },
      artifacts: [
        {
          path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md",
          receiptSha256: "old",
          actualSha256: "old",
          plannedSha256: "new",
          matchesReceiptOnDisk: true,
          differsFromPlan: true,
        },
      ],
    });

    await runPlatformUpdate("qwen", { global: true });

    expect(platformMocks.syncQwenOfficialCliReleaseBundle).not.toHaveBeenCalled();
    expect(platformMocks.updateQwenExtensionWithOfficialCli).toHaveBeenCalledWith("zc-toolkit");
    expect(platformMocks.uninstallQwenExtensionWithOfficialCli).not.toHaveBeenCalled();
    expect(platformMocks.relinkQwenExtensionWithOfficialCli).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
  });

  it("uninstalls managed filesystem artifacts from the receipt", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
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
        installMethod: "filesystem",
        artifacts: [
          {
            path: "/tmp/install/AGENTS.md",
            sha256: "sha",
            bytes: 8,
          },
        ],
      },
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "current-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    await runPlatformUninstall("codex", { dir: "/tmp/install" });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith(["/tmp/install/AGENTS.md"]);
    expect(platformMocks.deletePlatformInstallReceipt).toHaveBeenCalledWith(
      "/tmp/install/.zc/platform-state/codex.install-receipt.json",
    );
  });

  it("prefers official qwen uninstall for qwen-cli managed installs", async () => {
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        "/home/test/.qwen",
        [{ path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md", content: "# context" }],
        "global",
      ),
    );
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`。",
    });
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "up-to-date",
      platform: "qwen",
      receiptPath: "/home/test/.qwen/.zc/platform-state/qwen.install-receipt.json",
      receipt: {
        schemaVersion: 1,
        platform: "qwen",
        destinationRoot: "/home/test/.qwen",
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "qwen-cli",
        installSource: "github-repo",
        sourceRef: "https://github.com/zmice/zc-qwen-extension.git",
        artifacts: [
          {
            path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md",
            sha256: "sha",
            bytes: 9,
          },
        ],
      },
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "current-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 0,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [],
    });

    await runPlatformUninstall("qwen", { global: true });

    expect(platformMocks.uninstallQwenExtensionWithOfficialCli).toHaveBeenCalledWith("zc-toolkit");
    expect(platformMocks.removeManagedPaths).not.toHaveBeenCalled();
    expect(platformMocks.deletePlatformInstallReceipt).toHaveBeenCalledWith(
      "/home/test/.qwen/.zc/platform-state/qwen.install-receipt.json",
    );
  });

  it("repairs drifted filesystem installs by rewriting managed artifacts", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents repaired" }]),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "drifted",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: {
        schemaVersion: 1,
        platform: "codex",
        destinationRoot: "/tmp/install",
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "filesystem",
        artifacts: [
          {
            path: "/tmp/install/AGENTS.md",
            sha256: "old-sha",
            bytes: 8,
          },
        ],
      },
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "old-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 1,
        missingArtifacts: 0,
        plannedChanges: 0,
      },
      artifacts: [
        {
          path: "/tmp/install/AGENTS.md",
          receiptSha256: "old-sha",
          actualSha256: "drifted-sha",
          plannedSha256: "new-sha",
          matchesReceiptOnDisk: false,
          differsFromPlan: true,
        },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 1,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformRepair("codex", { dir: "/tmp/install" });

    expect(platformMocks.createCodexInstallPlan).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/tmp/install",
        overwrite: "force",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents repaired" }],
      { dryRun: false, overwrite: "force" },
    );
    expect(platformMocks.writePlatformInstallReceiptForPlan).toHaveBeenCalled();
  });

  it("prints platform doctor health and issues", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/tmp/install", [{ path: "/tmp/install/AGENTS.md", content: "# agents" }]),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "drifted",
      platform: "codex",
      receiptPath: "/tmp/install/.zc/platform-state/codex.install-receipt.json",
      receipt: {
        schemaVersion: 1,
        platform: "codex",
        destinationRoot: "/tmp/install",
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "filesystem",
        artifacts: [],
      },
      contentFingerprint: "current-fingerprint",
      installedContentFingerprint: "old-fingerprint",
      summary: {
        trackedArtifacts: 1,
        driftedArtifacts: 1,
        missingArtifacts: 1,
        plannedChanges: 0,
      },
      artifacts: [],
    });
    platformMocks.resolvePlatformInstallDoctor.mockResolvedValue({
      platform: "codex",
      health: "broken",
      issues: [
        {
          code: "drifted-artifacts",
          severity: "broken",
          message: "受管产物和回执记录不一致，安装目录已漂移。",
          paths: ["/tmp/install/AGENTS.md"],
        },
      ],
    });

    await runPlatformDoctor("codex", { dir: "/tmp/install", json: true });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "doctor",
        target: "codex",
        health: "broken",
        status: "drifted",
        issues: [
          expect.objectContaining({
            code: "drifted-artifacts",
            severity: "broken",
          }),
        ],
      }),
    );

    logSpy.mockRestore();
  });

  it("prints resolved install targets via platform where", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", "/home/test/.codex", [{ path: "/home/test/.codex/AGENTS.md", content: "# agents" }], "global"),
    );
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
        capability: expect.objectContaining({
          namespace: "zc",
          surfaces: ["entry-file", "skills-dir"],
        }),
      }),
    );

    logSpy.mockRestore();
  });

  it("resolves qwen global scope to the user-level ~/.qwen directory", async () => {
    platformMocks.createQwenInstallPlan.mockReturnValue({
      platform: "qwen",
      packageName: "@zmice/platform-qwen",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      destinationRoot: "/home/test/.qwen",
      scope: "global",
      overwrite: "error",
      capability: {
        namespace: "zc",
        surfaces: ["entry-file", "commands-dir", "skills-dir", "agents-dir", "extension-dir"],
        entryFile: "QWEN.md",
        commandsDir: "commands/zc",
        skillsDir: "skills",
        agentsDir: "agents",
        extensionDir: "extensions/zc-toolkit",
      },
      artifacts: [{ path: "/home/test/.qwen/extensions/zc-toolkit/QWEN.md", content: "# context" }],
    });
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
