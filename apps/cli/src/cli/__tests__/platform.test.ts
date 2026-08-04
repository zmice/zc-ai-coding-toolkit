import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

const abs = (path: string) => resolve(path);

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
  createCodexGenerationPlan: vi.fn(),
  createCodexMarketplaceGenerationPlan: vi.fn(),
  createCodexInstallPlan: vi.fn(),
  createCodexAgentInstallPlan: vi.fn(),
  createCodexAgentsReceipt: vi.fn(),
  createCodexCompanionAgentInstallPlan: vi.fn(),
  createClaudeInstallPlan: vi.fn(),
  createOpenCodeInstallPlan: vi.fn(),
  loadToolkitManifest: vi.fn(),
  importWorkspaceDistModule: vi.fn(),
  normalizeInstallSelector: vi.fn(),
  pathExists: vi.fn(),
  quarantineCodexLegacyDirectPlugin: vi.fn(),
  restoreCodexLegacyDirectPlugin: vi.fn(),
  resolveInstallTarget: vi.fn(),
  resolvePlatformInstallDoctor: vi.fn(),
  resolvePlatformInstallReceiptPath: vi.fn(),
  resolvePlatformInstallStatus: vi.fn(),
  removeManagedPaths: vi.fn(),
  deletePlatformInstallReceipt: vi.fn(),
  deleteCodexAgentsReceipt: vi.fn(),
  getCodexAgentsReceiptOwnedPaths: vi.fn(),
  readCodexAgentsReceipt: vi.fn(),
  resolveCodexAgentsReceiptPath: vi.fn(),
  writeArtifacts: vi.fn(),
  writeCodexAgentsReceipt: vi.fn(),
  writePlatformInstallReceiptForPlan: vi.fn(),
  syncQwenOfficialCliSourceBundle: vi.fn(),
  syncQwenOfficialCliReleaseBundle: vi.fn(),
  toQwenOfficialCliReleaseArtifacts: vi.fn(),
  installQwenExtensionFromOfficialRepoWithCli: vi.fn(),
  installQwenExtensionWithOfficialCli: vi.fn(),
  loadCodexAgentCompanion: vi.fn(),
  uninstallQwenExtensionWithOfficialCli: vi.fn(),
  updateQwenExtensionWithOfficialCli: vi.fn(),
  relinkQwenExtensionWithOfficialCli: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock("../../utils/cross-platform-spawn.js", () => ({
  spawnCommand: platformMocks.spawn,
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

vi.mock("../../utils/codex-legacy-plugin.js", () => ({
  isCodexLegacyDirectPluginPath: vi.fn((path: string) => path
    .replaceAll("\\", "/")
    .replace(/\/+$/, "")
    .toLowerCase()
    .endsWith("/.codex/plugins/zc-toolkit")),
  quarantineCodexLegacyDirectPlugin: platformMocks.quarantineCodexLegacyDirectPlugin,
  restoreCodexLegacyDirectPlugin: platformMocks.restoreCodexLegacyDirectPlugin,
}));

vi.mock("../../platform-state/codex-agents-receipt.js", () => ({
  createCodexAgentsReceipt: platformMocks.createCodexAgentsReceipt,
  deleteCodexAgentsReceipt: platformMocks.deleteCodexAgentsReceipt,
  getCodexAgentsReceiptOwnedPaths: platformMocks.getCodexAgentsReceiptOwnedPaths,
  readCodexAgentsReceipt: platformMocks.readCodexAgentsReceipt,
  resolveCodexAgentsReceiptPath: platformMocks.resolveCodexAgentsReceiptPath,
  writeCodexAgentsReceipt: platformMocks.writeCodexAgentsReceipt,
}));

vi.mock("../../utils/codex-agent-companion.js", () => ({
  createCodexCompanionAgentInstallPlan: platformMocks.createCodexCompanionAgentInstallPlan,
  loadCodexAgentCompanion: platformMocks.loadCodexAgentCompanion,
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
  runPlatformAgents,
  runPlatformPlugin,
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

function createCodexAgentInstallPlan(
  destinationRoot: string,
  artifacts: Array<{ path: string; content: string }>,
  scope: "project" | "global" | "dir" = "dir",
) {
  return {
    platform: "codex" as const,
    packageName: "@zmice/platform-codex",
    manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
    matchedAssets: [],
    destinationRoot,
    scope,
    overwrite: "force" as const,
    capability: {
      namespace: "zc",
      surfaces: ["agents-dir"],
      entryFile: null,
      commandsDir: null,
      skillsDir: null,
      agentsDir: scope === "project" ? ".codex/agents" : "agents",
      extensionDir: null,
      agents: {
        relativeDir: scope === "project" ? ".codex/agents" : "agents",
        fileExtension: ".toml",
      },
    },
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

function mockCodexSpawnResults(results: Array<{
  code: number;
  stdout?: string;
  stderr?: string;
}>): void {
  platformMocks.spawn.mockImplementation(() => {
    const result = results.shift();
    if (!result) {
      throw new Error("unexpected codex spawn");
    }

    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    queueMicrotask(() => {
      if (result.stdout) {
        child.stdout.emit("data", Buffer.from(result.stdout));
      }
      if (result.stderr) {
        child.stderr.emit("data", Buffer.from(result.stderr));
      }
      child.emit("close", result.code, null);
    });

    return child;
  });
}

describe("platform CLI", () => {
  beforeEach(() => {
    process.exitCode = undefined;
    platformMocks.createQwenGenerationPlan.mockReset();
    platformMocks.createQwenInstallPlan.mockReset();
    platformMocks.createCodexGenerationPlan.mockReset();
    platformMocks.createCodexMarketplaceGenerationPlan.mockReset();
    platformMocks.createCodexInstallPlan.mockReset();
    platformMocks.createCodexAgentInstallPlan.mockReset();
    platformMocks.createCodexAgentsReceipt.mockReset();
    platformMocks.createCodexCompanionAgentInstallPlan.mockReset();
    platformMocks.createClaudeInstallPlan.mockReset();
    platformMocks.createOpenCodeInstallPlan.mockReset();
    platformMocks.loadToolkitManifest.mockReset();
    platformMocks.importWorkspaceDistModule.mockReset();
    platformMocks.normalizeInstallSelector.mockReset();
    platformMocks.pathExists.mockReset();
    platformMocks.quarantineCodexLegacyDirectPlugin.mockReset();
    platformMocks.restoreCodexLegacyDirectPlugin.mockReset();
    platformMocks.resolveInstallTarget.mockReset();
    platformMocks.resolvePlatformInstallDoctor.mockReset();
    platformMocks.resolvePlatformInstallReceiptPath.mockReset();
    platformMocks.resolvePlatformInstallStatus.mockReset();
    platformMocks.removeManagedPaths.mockReset();
    platformMocks.deletePlatformInstallReceipt.mockReset();
    platformMocks.deleteCodexAgentsReceipt.mockReset();
    platformMocks.getCodexAgentsReceiptOwnedPaths.mockReset();
    platformMocks.readCodexAgentsReceipt.mockReset();
    platformMocks.resolveCodexAgentsReceiptPath.mockReset();
    platformMocks.writeArtifacts.mockReset();
    platformMocks.writeCodexAgentsReceipt.mockReset();
    platformMocks.writePlatformInstallReceiptForPlan.mockReset();
    platformMocks.syncQwenOfficialCliSourceBundle.mockReset();
    platformMocks.syncQwenOfficialCliReleaseBundle.mockReset();
    platformMocks.toQwenOfficialCliReleaseArtifacts.mockReset();
    platformMocks.installQwenExtensionFromOfficialRepoWithCli.mockReset();
    platformMocks.installQwenExtensionWithOfficialCli.mockReset();
    platformMocks.loadCodexAgentCompanion.mockReset();
    platformMocks.uninstallQwenExtensionWithOfficialCli.mockReset();
    platformMocks.updateQwenExtensionWithOfficialCli.mockReset();
    platformMocks.relinkQwenExtensionWithOfficialCli.mockReset();
    platformMocks.spawn.mockReset();

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
        return {
          createCodexGenerationPlan: platformMocks.createCodexGenerationPlan,
          createCodexMarketplaceGenerationPlan: platformMocks.createCodexMarketplaceGenerationPlan,
          createCodexInstallPlan: platformMocks.createCodexInstallPlan,
          createCodexAgentInstallPlan: platformMocks.createCodexAgentInstallPlan,
        };
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
      plan.platform === "codex"
        ? join(plan.destinationRoot, ".codex", "platform-state", `${plan.platform}.install-receipt.json`)
        : join(plan.destinationRoot, ".zc", "platform-state", `${plan.platform}.install-receipt.json`)
    ));

    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "up-to-date",
      platform: "codex",
      receiptPath: join(abs("/tmp/install"), ".codex", "platform-state", "codex.install-receipt.json"),
      receipt: {
        schemaVersion: 1,
        platform: "codex",
        destinationRoot: abs("/tmp/install"),
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
    platformMocks.quarantineCodexLegacyDirectPlugin.mockImplementation(async (path: string) => ({
      originalPath: path,
      backupPath: `${path}.backup`,
      moved: true,
    }));
    platformMocks.restoreCodexLegacyDirectPlugin.mockResolvedValue(undefined);
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 1,
      missing: 0,
    });
    platformMocks.deletePlatformInstallReceipt.mockResolvedValue(undefined);
    platformMocks.deleteCodexAgentsReceipt.mockResolvedValue(undefined);
    platformMocks.readCodexAgentsReceipt.mockResolvedValue(null);
    platformMocks.resolveCodexAgentsReceiptPath.mockImplementation((root: string, scope: string) => (
      scope === "project"
        ? join(root, ".codex/platform-state/zc-toolkit-agents.install-receipt.json")
        : join(root, "platform-state/zc-toolkit-agents.install-receipt.json")
    ));
    platformMocks.getCodexAgentsReceiptOwnedPaths.mockImplementation(
      (receipt: { artifacts: Array<{ path: string }> }) => receipt.artifacts.map((artifact) => artifact.path),
    );
    platformMocks.createCodexAgentsReceipt.mockImplementation((input: {
      root: string;
      scope: string;
      artifacts: Array<{ path: string; content: string }>;
    }) => ({
      schemaVersion: 1,
      root: input.root,
      scope: input.scope,
      artifacts: input.artifacts.filter((artifact) => artifact.path.endsWith(".toml")),
    }));
    platformMocks.writeCodexAgentsReceipt.mockResolvedValue(undefined);
    platformMocks.loadCodexAgentCompanion.mockResolvedValue({
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      installedPluginPath: "/cache/zc-toolkit",
      contentFingerprint: "companion-fingerprint",
      configContent: "[agents.zc_code_reviewer]\n",
      agents: [
        {
          name: "zc_code_reviewer",
          relativePath: "agents/zc-code-reviewer.toml",
          content: "name = \"zc_code_reviewer\"\n",
        },
      ],
    });
    platformMocks.createCodexCompanionAgentInstallPlan.mockImplementation((
      _companion: unknown,
      options: { root: string; scope: "global" },
    ) => createCodexAgentInstallPlan(
      options.root,
      [
        { path: join(options.root, "config.toml"), content: "[agents.zc_code_reviewer]\n" },
        { path: join(options.root, "agents/zc-code-reviewer.toml"), content: "name = \"zc_code_reviewer\"\n" },
      ],
      options.scope,
    ));

    platformMocks.writePlatformInstallReceiptForPlan.mockResolvedValue({});
    platformMocks.syncQwenOfficialCliSourceBundle.mockResolvedValue({
      sourceDir: abs("/tmp/qwen-source"),
      extensionName: "zc-toolkit",
      artifactCount: 1,
    });
    platformMocks.syncQwenOfficialCliReleaseBundle.mockResolvedValue({
      bundleDir: abs("/tmp/qwen-release"),
      extensionName: "zc-toolkit",
      artifactCount: 1,
    });
    platformMocks.toQwenOfficialCliReleaseArtifacts.mockImplementation(
      (_plan: unknown, bundleDir: string) => [
        { path: join(bundleDir, "QWEN.md"), content: "# context" },
        { path: join(bundleDir, "commands/zc/start.md"), content: "# start" },
      ],
    );
    platformMocks.installQwenExtensionFromOfficialRepoWithCli.mockResolvedValue(undefined);
    platformMocks.installQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.uninstallQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.updateQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
    platformMocks.relinkQwenExtensionWithOfficialCli.mockResolvedValue(undefined);
  });

  it("uses safe overwrite defaults for platform generate writes", async () => {
    const outputRoot = abs("/tmp/out");
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
      [{ path: join(outputRoot, "QWEN.md"), content: "# context" }],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("prints a JSON plan without writing files when generate uses --plan", async () => {
    const outputRoot = abs("/tmp/out");
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
        root: outputRoot,
        artifactCount: 1,
        artifacts: [{ path: join(outputRoot, "QWEN.md"), content: "# context" }],
      }),
    );

    logSpy.mockRestore();
  });

  it("exports a standalone qwen release bundle during generate", async () => {
    const bundleRoot = abs("/tmp/zc-toolkit");
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        bundleRoot,
        [
          { path: join(bundleRoot, "extensions/zc-toolkit/QWEN.md"), content: "# context" },
          { path: join(bundleRoot, "extensions/zc-toolkit/commands/zc/start.md"), content: "# start" },
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
        { path: join(bundleRoot, "QWEN.md"), content: "# context" },
        { path: join(bundleRoot, "commands/zc/start.md"), content: "# start" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("prints qwen release bundle plan paths without native extension nesting", async () => {
    const bundleRoot = abs("/tmp/zc-toolkit");
    platformMocks.createQwenGenerationPlan.mockReturnValue(
      createGenerationPlan([{ path: "QWEN.md", content: "# context" }]),
    );
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        bundleRoot,
        [
          { path: join(bundleRoot, "extensions/zc-toolkit/QWEN.md"), content: "# context" },
          { path: join(bundleRoot, "extensions/zc-toolkit/commands/zc/start.md"), content: "# start" },
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
      root: bundleRoot,
      bundleType: "release-bundle",
      bundlePath: bundleRoot,
      artifacts: [
        { path: join(bundleRoot, "QWEN.md"), content: "# context" },
        { path: join(bundleRoot, "commands/zc/start.md"), content: "# start" },
      ],
    }));

    logSpy.mockRestore();
  });

  it("forwards toolkit attachments into platform generation plans", async () => {
    platformMocks.loadToolkitManifest.mockResolvedValue({
      generatedAt: "2026-07-28T00:00:00.000Z",
      contentRoot: "/repo/packages/toolkit/src/content",
      assets: [
        {
          id: "skill:alpha",
          body: "See `references/guide.md`.",
          attachments: [
            {
              relativePath: "assets/references/guide.md",
              contents: "# Guide\n",
            },
          ],
          meta: {
            kind: "skill",
            name: "alpha",
            title: "Alpha",
            description: "desc",
            platforms: ["codex"],
          },
        },
      ],
    });
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content",
      matchedAssets: [],
      artifacts: [],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformGenerate("codex", {
      plan: true,
      json: true,
    });

    expect(platformMocks.createCodexGenerationPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [
          expect.objectContaining({
            attachments: [
              {
                relativePath: "assets/references/guide.md",
                contents: "# Guide\n",
              },
            ],
          }),
        ],
      }),
      expect.any(Object),
    );

    logSpy.mockRestore();
  });

  it("exports codex marketplace to the personal marketplace layout with --global", async () => {
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      capability: {
        namespace: "zc",
        surfaces: ["entry-file", "plugin-dir", "skills-dir", "agents-dir"],
        entryFile: ".codex/AGENTS.md",
        commandsDir: null,
        skillsDir: ".codex/plugins/zc-toolkit/skills",
        agentsDir: ".codex/agents",
        extensionDir: null,
      },
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: ".codex/AGENTS.md", content: "# plugin entry" },
        { path: ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: ".codex/agents/zc-code-reviewer.toml", content: "name = \"zc_code_reviewer\"\n" },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 4,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformGenerate("codex", {
      bundle: "codex-marketplace",
      global: true,
    });

    expect(platformMocks.createCodexMarketplaceGenerationPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scope: "global" }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: join(homedir(), ".agents/plugins/marketplace.json"), content: "{}" },
        { path: join(homedir(), ".codex/AGENTS.md"), content: "# plugin entry" },
        { path: join(homedir(), ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json"), content: "{}" },
        { path: join(homedir(), ".codex/agents/zc-code-reviewer.toml"), content: "name = \"zc_code_reviewer\"\n" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("exports codex marketplace to the resolved project root with --project", async () => {
    const projectRoot = join("/repo", "project");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/repo/project",
      source: "project-root",
      marker: "pnpm-workspace.yaml",
    });
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 3,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformGenerate("codex", {
      bundle: "codex-marketplace",
      project: true,
    });

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("codex", { project: true });
    expect(platformMocks.createCodexMarketplaceGenerationPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scope: "project" }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: join(projectRoot, ".agents/plugins/marketplace.json"), content: "{}" },
        { path: join(projectRoot, "AGENTS.md"), content: "# plugin entry" },
        { path: join(projectRoot, "plugins/zc-toolkit/.codex-plugin/plugin.json"), content: "{}" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("uses a short codex plugin command for the project marketplace by default", async () => {
    const projectRoot = join("/repo", "project");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/repo/project",
      source: "project-root",
      marker: "pnpm-workspace.yaml",
    });
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 3,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformPlugin("codex", {});

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("codex", { project: true });
    expect(platformMocks.createCodexMarketplaceGenerationPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scope: "project" }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: join(projectRoot, ".agents/plugins/marketplace.json"), content: "{}" },
        { path: join(projectRoot, "AGENTS.md"), content: "# plugin entry" },
        { path: join(projectRoot, "plugins/zc-toolkit/.codex-plugin/plugin.json"), content: "{}" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("reports plugin-qualified Codex skill examples for marketplace plans", async () => {
    const projectRoot = join("/repo", "project");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: projectRoot,
      source: "project-root",
      marker: "pnpm-workspace.yaml",
    });
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      capability: {
        namespace: "zc",
        surfaces: ["entry-file", "skills-dir"],
        entryFile: "AGENTS.md",
        commandsDir: null,
        skillsDir: "plugins/zc-toolkit/skills",
        agentsDir: null,
        extensionDir: "plugins/zc-toolkit",
      },
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
      ],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.capability.exposure).toEqual({
      style: "plugin-skill",
      entryPattern: "$zc-toolkit:<skill>",
      examples: [
        "zc:start -> $zc-toolkit:start",
        "zc:product-analysis -> $zc-toolkit:product-analysis",
        "zc:sdd-tdd -> $zc-toolkit:sdd-tdd",
      ],
    });
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("prints Codex Git marketplace registration without generating local files", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      git: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "plugin",
      target: "codex",
      distribution: "git-marketplace",
      source: "zmice/zc-codex-marketplace",
      ref: null,
      register: false,
      command: "codex plugin marketplace add zmice/zc-codex-marketplace --json",
      installCommand: "codex plugin add zc-toolkit@zc-toolkit --json",
      updateCommand: "codex plugin marketplace upgrade zc-toolkit --json",
      statusCommand: "codex plugin list --marketplace zc-toolkit --available --json",
      marketplaceName: "zc-toolkit",
      pluginName: "zc-toolkit",
    }));
    expect(platformMocks.resolveInstallTarget).not.toHaveBeenCalled();
    expect(platformMocks.createCodexMarketplaceGenerationPlan).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("uses a custom Codex Git marketplace source and ref", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      git: "https://github.com/example/plugins.git",
      ref: "main",
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      source: "https://github.com/example/plugins.git",
      ref: "main",
      command: "codex plugin marketplace add https://github.com/example/plugins.git --ref main --json",
      args: [
        "codex",
        "plugin",
        "marketplace",
        "add",
        "https://github.com/example/plugins.git",
        "--ref",
        "main",
        "--json",
      ],
    }));
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("rejects local selectors in Codex Git marketplace mode", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      git: true,
      global: true,
      json: true,
    });

    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "error",
      action: "generate",
      target: "codex",
    }));
    expect(payload.error).toContain("不能同时使用 --dir/--project/--global");
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("plans a complete Codex plugin install through the official CLI", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      git: true,
      install: true,
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "plugin",
      target: "codex",
      operation: "install",
      commands: [
        "codex plugin marketplace add zmice/zc-codex-marketplace --json",
        "codex plugin add zc-toolkit@zc-toolkit --json",
      ],
      nextSteps: [
        "运行 codex plugin list --marketplace zc-toolkit --available --json 核对 installed、enabled 和 version",
        "启动新线程后使用 $zc-toolkit:start 或直接 @zc-toolkit",
      ],
    }));
    expect(platformMocks.resolveInstallTarget).not.toHaveBeenCalled();
    expect(platformMocks.createCodexMarketplaceGenerationPlan).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("plans Codex plugin marketplace refresh and status inspection", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      plan: true,
      json: true,
    });

    const upgradePayload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(upgradePayload).toEqual(expect.objectContaining({
      mode: "plan",
      operation: "upgrade",
      commands: [
        "codex plugin marketplace list --json",
        "codex plugin marketplace upgrade zc-toolkit --json",
        "codex plugin add zc-toolkit@zc-toolkit --json",
        "codex plugin list --marketplace zc-toolkit --available --json",
      ],
      migrationCommands: [
        "codex plugin marketplace list --json",
        "codex plugin marketplace remove zc-toolkit --json",
        "codex plugin marketplace add zmice/zc-codex-marketplace --json",
        "codex plugin add zc-toolkit@zc-toolkit --json",
        "codex plugin list --marketplace zc-toolkit --available --json",
      ],
    }));

    logSpy.mockClear();

    await runPlatformPlugin("codex", {
      status: true,
      plan: true,
      json: true,
    });

    const statusPayload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(statusPayload).toEqual(expect.objectContaining({
      mode: "plan",
      operation: "status",
      commands: [
        "codex plugin list --marketplace zc-toolkit --available --json",
      ],
    }));

    logSpy.mockRestore();
  });

  it("migrates a non-Git Codex marketplace before upgrading the installed plugin", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"root\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"local\",\"source\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\"}}]}\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\",\"alreadyAdded\":false}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.7.1\",\"installedPath\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\cache\\\\zc-toolkit\"}\n",
      },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.7.1\",\"installedPath\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\cache\\\\zc-toolkit\"}],\"available\":[]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      json: true,
    });

    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "marketplace", "remove", "zc-toolkit", "--json"],
      ["plugin", "marketplace", "add", "zmice/zc-codex-marketplace", "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "list", "--marketplace", "zc-toolkit", "--available", "--json"],
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      operation: "upgrade",
      marketplaceMigration: "local-to-git",
      installedVersion: "0.7.1",
      updatePending: false,
    }));

    logSpy.mockRestore();
  });

  it("recovers when a stale non-Git marketplace is already absent on Windows", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"root\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"local\",\"source\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\"}}]}\n",
      },
      {
        code: 1,
        stderr: "Error: marketplace 'zc-toolkit' is not configured or installed\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\",\"alreadyAdded\":false}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.8.1\",\"installedPath\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\cache\\\\zc-toolkit\"}\n",
      },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.8.1\",\"installedPath\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\cache\\\\zc-toolkit\"}],\"available\":[]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      json: true,
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "marketplace", "remove", "zc-toolkit", "--json"],
      ["plugin", "marketplace", "add", "zmice/zc-codex-marketplace", "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "list", "--marketplace", "zc-toolkit", "--available", "--json"],
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      operation: "upgrade",
      marketplaceMigration: "local-to-git",
      installedVersion: "0.8.1",
      updatePending: false,
    }));

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("does not hide other failures while removing a non-Git Codex marketplace", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"root\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"local\",\"source\":\"C:\\\\Users\\\\zmice\\\\.codex\\\\plugins\\\\zc-toolkit\"}}]}\n",
      },
      { code: 1, stderr: "Error: permission denied\n" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      json: true,
    });

    expect(logSpy).not.toHaveBeenCalled();
    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.error).toContain("permission denied");
    expect(platformMocks.spawn).toHaveBeenCalledTimes(4);

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("registers the Git marketplace when upgrade finds no existing source", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      { code: 0, stdout: "{\"marketplaces\":[]}\n" },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\",\"alreadyAdded\":false}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.7.1\",\"installedPath\":\"/cache/zc-toolkit\"}\n",
      },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.7.1\",\"installedPath\":\"/cache/zc-toolkit\"}],\"available\":[]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      json: true,
    });

    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "marketplace", "add", "zmice/zc-codex-marketplace", "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "list", "--marketplace", "zc-toolkit", "--available", "--json"],
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.marketplaceMigration).toBe("registered-git");

    logSpy.mockRestore();
  });

  it("reinstalls a legacy direct plugin that shadows the refreshed Git marketplace on Windows", async () => {
    const legacyPluginPath = "C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit";
    const legacyPluginBackupPath = "C:\\Users\\zmice\\.codex\\platform-state\\legacy-plugin-backups\\zc-toolkit-0.5.0";
    const currentPluginPath = "C:\\Users\\zmice\\.codex\\plugins\\cache\\zc-toolkit\\zc-toolkit\\0.8.2";
    platformMocks.quarantineCodexLegacyDirectPlugin.mockResolvedValue({
      originalPath: legacyPluginPath,
      backupPath: legacyPluginBackupPath,
      moved: true,
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 1,
      skipped: 0,
      dryRun: false,
    });
    platformMocks.loadCodexAgentCompanion.mockResolvedValue({
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.8.2",
      installedPluginPath: currentPluginPath,
      contentFingerprint: "current-companion-fingerprint",
      configContent: "[agents.zc_code_reviewer]\n",
      agents: [
        {
          name: "zc_code_reviewer",
          relativePath: "agents/zc-code-reviewer.toml",
          content: "name = \"zc_code_reviewer\"\n",
        },
      ],
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"git\",\"source\":\"https://github.com/zmice/zc-codex-marketplace.git\"}}]}\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      {
        code: 0,
        stdout: `${JSON.stringify({ pluginId: "zc-toolkit@zc-toolkit", version: "0.5.0", installedPath: legacyPluginPath })}\n`,
      },
      {
        code: 0,
        stdout: `${JSON.stringify({ installed: [{ pluginId: "zc-toolkit@zc-toolkit", version: "0.5.0", installedPath: legacyPluginPath }], available: [] })}\n`,
      },
      { code: 1, stderr: "Error: plugin 'zc-toolkit@zc-toolkit' is not installed\n" },
      {
        code: 0,
        stdout: `${JSON.stringify({ pluginId: "zc-toolkit@zc-toolkit", version: "0.8.2", installedPath: currentPluginPath })}\n`,
      },
      {
        code: 0,
        stdout: `${JSON.stringify({ installed: [{ pluginId: "zc-toolkit@zc-toolkit", version: "0.8.2", installedPath: currentPluginPath }], available: [] })}\n`,
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "marketplace", "upgrade", "zc-toolkit", "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "list", "--marketplace", "zc-toolkit", "--available", "--json"],
      ["plugin", "remove", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
      ["plugin", "list", "--marketplace", "zc-toolkit", "--available", "--json"],
    ]);
    expect(platformMocks.quarantineCodexLegacyDirectPlugin).toHaveBeenCalledWith(
      legacyPluginPath,
      "0.5.0",
    );
    expect(platformMocks.loadCodexAgentCompanion).toHaveBeenCalledWith(currentPluginPath);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      overallStatus: "complete",
      plugin: expect.objectContaining({
        version: "0.8.2",
        installedPath: currentPluginPath,
        updatePending: false,
        lifecycle: expect.objectContaining({
          marketplaceMigration: "legacy-plugin-to-git",
          legacyPluginBackupPath,
        }),
      }),
      agents: expect.objectContaining({
        status: "complete",
        pluginVersion: "0.8.2",
        installedPluginPath: currentPluginPath,
      }),
    }));

    logSpy.mockRestore();
  });

  it("restores the quarantined legacy plugin when the replacement install fails", async () => {
    const legacyPluginPath = "C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit";
    const legacyPluginBackupPath = "C:\\Users\\zmice\\.codex\\platform-state\\legacy-plugin-backups\\zc-toolkit-0.5.0";
    platformMocks.quarantineCodexLegacyDirectPlugin.mockResolvedValue({
      originalPath: legacyPluginPath,
      backupPath: legacyPluginBackupPath,
      moved: true,
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"git\",\"source\":\"https://github.com/zmice/zc-codex-marketplace.git\"}}]}\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      {
        code: 0,
        stdout: `${JSON.stringify({ pluginId: "zc-toolkit@zc-toolkit", version: "0.5.0", installedPath: legacyPluginPath })}\n`,
      },
      {
        code: 0,
        stdout: `${JSON.stringify({ installed: [{ pluginId: "zc-toolkit@zc-toolkit", version: "0.5.0", installedPath: legacyPluginPath }], available: [] })}\n`,
      },
      { code: 0, stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\"}\n" },
      { code: 1, stderr: "Error: replacement install failed\n" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.restoreCodexLegacyDirectPlugin).toHaveBeenCalledWith({
      originalPath: legacyPluginPath,
      backupPath: legacyPluginBackupPath,
      moved: true,
    });
    expect(platformMocks.loadCodexAgentCompanion).not.toHaveBeenCalled();
    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.error).toContain("replacement install failed");
    expect(payload.error).toContain("已从");
    expect(payload.error).toContain("恢复旧插件目录");

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("restores the previous marketplace when a non-Git migration fails", async () => {
    const previousSource = "C:\\Users\\zmice\\.codex\\plugins\\zc-toolkit";
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.146.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: `{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"root\":${JSON.stringify(previousSource)},\"marketplaceSource\":{\"sourceType\":\"local\",\"source\":${JSON.stringify(previousSource)}}}]}\n`,
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      { code: 1, stderr: "Git marketplace download failed\n" },
      { code: 1, stderr: "marketplace not configured\n" },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      { code: 0, stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.5.0\"}\n" },
    ]);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      json: true,
    });

    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["plugin", "marketplace", "list", "--json"],
      ["plugin", "marketplace", "remove", "zc-toolkit", "--json"],
      ["plugin", "marketplace", "add", "zmice/zc-codex-marketplace", "--json"],
      ["plugin", "marketplace", "remove", "zc-toolkit", "--json"],
      ["plugin", "marketplace", "add", previousSource, "--json"],
      ["plugin", "add", "zc-toolkit@zc-toolkit", "--json"],
    ]);
    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.error).toContain("已恢复原 local marketplace 和旧版插件");

    errorSpy.mockRestore();
  });

  it("plans official Codex plugin removal when --git and --uninstall are combined", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      git: true,
      uninstall: true,
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      operation: "uninstall",
      commands: [
        "codex plugin remove zc-toolkit@zc-toolkit --json",
      ],
    }));

    logSpy.mockRestore();
  });

  it("falls back to the legacy marketplace add command for older Codex CLIs", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.121.0\n" },
      { code: 2, stderr: "unrecognized subcommand 'plugin'\n" },
      { code: 0, stdout: "Usage: codex marketplace add\n" },
      { code: 0, stdout: "marketplace added\n" },
    ]);

    await runPlatformPlugin("codex", {
      git: true,
      register: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      operation: "register",
      cliMode: "legacy-marketplace",
      cliVersion: "codex-cli 0.121.0",
      executedCommands: [
        "codex marketplace add zmice/zc-codex-marketplace",
      ],
    }));
    expect(platformMocks.spawn.mock.calls.map((call) => call[1])).toEqual([
      ["--version"],
      ["plugin", "add", "--help"],
      ["marketplace", "add", "--help"],
      ["marketplace", "add", "zmice/zc-codex-marketplace"],
    ]);

    logSpy.mockRestore();
  });

  it("executes register and install through a current Codex plugin CLI", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      { code: 0, stdout: "{\"alreadyAdded\":true}\n" },
      { code: 0, stdout: "{\"name\":\"zc-toolkit\",\"version\":\"0.6.0\"}\n" },
    ]);

    await runPlatformPlugin("codex", {
      install: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      operation: "install",
      cliMode: "official-plugin",
      executedCommands: [
        "codex plugin marketplace add zmice/zc-codex-marketplace --json",
        "codex plugin add zc-toolkit@zc-toolkit --json",
      ],
      cliResults: [
        {
          command: "codex plugin marketplace add zmice/zc-codex-marketplace --json",
          output: { alreadyAdded: true },
        },
        {
          command: "codex plugin add zc-toolkit@zc-toolkit --json",
          output: { name: "zc-toolkit", version: "0.6.0" },
        },
      ],
    }));

    logSpy.mockRestore();
  });

  it("plans plugin and companion agents as one lifecycle without side effects", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      install: true,
      withAgents: true,
      plan: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "codex-plugin-companion",
      operation: "install",
      overallStatus: "planned",
      plugin: expect.objectContaining({
        status: "planned",
      }),
      agents: expect.objectContaining({
        requested: true,
        scope: "global",
        status: "planned",
      }),
    }));
    expect(platformMocks.spawn).not.toHaveBeenCalled();
    expect(platformMocks.loadCodexAgentCompanion).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("installs companion agents from the exact local source path returned by Codex", async () => {
    const codexRoot = abs("/home/test/.codex");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: codexRoot,
      source: "official-global",
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 2,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      { code: 0, stdout: "{\"alreadyAdded\":true}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"name\":\"zc-toolkit\",\"version\":\"0.6.0\",\"source\":{\"source\":\"local\",\"path\":\"/cache/zc-toolkit\"}}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      install: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.loadCodexAgentCompanion).toHaveBeenCalledWith("/cache/zc-toolkit");
    expect(platformMocks.createCodexCompanionAgentInstallPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginVersion: "0.6.0",
        installedPluginPath: "/cache/zc-toolkit",
      }),
      {
        root: codexRoot,
        scope: "global",
      },
    );
    expect(platformMocks.writeCodexAgentsReceipt).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      action: "codex-plugin-companion",
      operation: "install",
      overallStatus: "complete",
      plugin: expect.objectContaining({
        status: "complete",
        version: "0.6.0",
        installedPath: "/cache/zc-toolkit",
      }),
      agents: expect.objectContaining({
        requested: true,
        status: "complete",
        pluginVersion: "0.6.0",
      }),
    }));

    logSpy.mockRestore();
  });

  it("reports partial success when plugin install succeeds without a companion path", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      { code: 0, stdout: "{\"alreadyAdded\":true}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"name\":\"zc-toolkit\",\"version\":\"0.6.0\"}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      install: true,
      withAgents: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      overallStatus: "partial",
      plugin: expect.objectContaining({
        status: "complete",
      }),
      agents: expect.objectContaining({
        status: "skipped",
        reason: "installed-plugin-path-unavailable",
      }),
    }));
    expect(process.exitCode).toBe(1);
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("reports partial success when the plugin succeeds but the companion receipt is invalid", async () => {
    platformMocks.readCodexAgentsReceipt.mockRejectedValueOnce(
      new Error("Codex agents receipt root or scope mismatch"),
    );
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      { code: 0, stdout: "{\"alreadyAdded\":true}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"name\":\"zc-toolkit\",\"version\":\"0.6.0\",\"installedPath\":\"/cache/zc-toolkit\"}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      install: true,
      withAgents: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      overallStatus: "partial",
      plugin: expect.objectContaining({
        status: "complete",
      }),
      agents: expect.objectContaining({
        status: "failed",
        reason: expect.stringContaining("receipt root or scope mismatch"),
      }),
    }));
    expect(platformMocks.loadCodexAgentCompanion).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("does not advance companion agents while a newer plugin version is only available", async () => {
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"git\",\"source\":\"https://github.com/zmice/zc-codex-marketplace.git\"}}]}\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}\n",
      },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}],\"available\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.7.0\"}]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      withAgents: true,
      json: true,
    });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      overallStatus: "update-pending",
      plugin: expect.objectContaining({
        version: "0.6.0",
        availableVersion: "0.7.0",
        updatePending: true,
      }),
      agents: expect.objectContaining({
        status: "unchanged",
        reason: "plugin-update-pending",
      }),
    }));
    expect(platformMocks.loadCodexAgentCompanion).not.toHaveBeenCalled();
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("syncs companion agents after upgrade when the installed version is current", async () => {
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 1,
      skipped: 0,
      dryRun: false,
    });
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      installedPluginPath: "/cache/zc-toolkit",
      contentFingerprint: "companion-fingerprint",
      scope: "global",
      root: abs("/home/test/.codex"),
      installedAt: "2026-07-28T00:00:00.000Z",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [],
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"marketplaces\":[{\"name\":\"zc-toolkit\",\"marketplaceSource\":{\"sourceType\":\"git\",\"source\":\"https://github.com/zmice/zc-codex-marketplace.git\"}}]}\n",
      },
      { code: 0, stdout: "{\"marketplaceName\":\"zc-toolkit\"}\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\",\"installedPath\":\"/cache/zc-toolkit\"}\n",
      },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}],\"available\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      upgrade: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.loadCodexAgentCompanion).toHaveBeenCalledWith("/cache/zc-toolkit");
    expect(platformMocks.writeArtifacts).toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      overallStatus: "complete",
      agents: expect.objectContaining({
        status: "complete",
        pluginVersion: "0.6.0",
      }),
    }));

    logSpy.mockRestore();
  });

  it("aggregates plugin and receipt-backed companion status without writing", async () => {
    const codexRoot = mkdtempSync(join(tmpdir(), "zc-codex-status-"));
    const agentPath = join(codexRoot, "agents/zc-code-reviewer.toml");
    mkdirSync(join(codexRoot, "agents"), { recursive: true });
    writeFileSync(join(codexRoot, "config.toml"), "[agents.zc_code_reviewer]\n");
    writeFileSync(agentPath, "name = \"zc_code_reviewer\"\n");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: codexRoot,
      source: "official-global",
    });
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      installedPluginPath: "/cache/zc-toolkit",
      contentFingerprint: "companion-fingerprint",
      scope: "global",
      root: codexRoot,
      installedAt: "2026-07-28T00:00:00.000Z",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [
        { path: agentPath, sha256: "digest", bytes: 32 },
      ],
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"installed\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}],\"available\":[{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"version\":\"0.6.0\"}]}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      status: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.loadCodexAgentCompanion).toHaveBeenCalledWith("/cache/zc-toolkit");
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      operation: "status",
      overallStatus: "complete",
      agents: expect.objectContaining({
        status: "up-to-date",
        receiptInstalled: true,
      }),
    }));

    logSpy.mockRestore();
  });

  it("uninstalls only receipt-owned companion agents alongside the official plugin", async () => {
    const codexRoot = mkdtempSync(join(tmpdir(), "zc-codex-uninstall-"));
    const ownedPath = join(codexRoot, "agents/zc-code-reviewer.toml");
    const localPath = join(codexRoot, "agents/zc-local-reviewer.toml");
    mkdirSync(join(codexRoot, "agents"), { recursive: true });
    writeFileSync(
      join(codexRoot, "config.toml"),
      [
        "[agents.zc_code_reviewer]",
        'config_file = "agents/zc-code-reviewer.toml"',
        "",
        "[agents.zc_local_reviewer]",
        'config_file = "agents/zc-local-reviewer.toml"',
        "",
      ].join("\n"),
    );
    writeFileSync(ownedPath, "name = \"zc_code_reviewer\"\n");
    writeFileSync(localPath, "name = \"zc_local_reviewer\"\n");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: codexRoot,
      source: "official-global",
    });
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      pluginId: "zc-toolkit@zc-toolkit",
      pluginVersion: "0.6.0",
      contentFingerprint: "companion-fingerprint",
      scope: "global",
      root: codexRoot,
      installedAt: "2026-07-28T00:00:00.000Z",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [
        { path: ownedPath, sha256: "digest", bytes: 32 },
      ],
    });
    mockCodexSpawnResults([
      { code: 0, stdout: "codex-cli 0.140.0\n" },
      { code: 0, stdout: "Usage: codex plugin add\n" },
      {
        code: 0,
        stdout: "{\"pluginId\":\"zc-toolkit@zc-toolkit\",\"name\":\"zc-toolkit\"}\n",
      },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      uninstall: true,
      withAgents: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([ownedPath]);
    expect(platformMocks.removeManagedPaths).not.toHaveBeenCalledWith(
      expect.arrayContaining([localPath]),
    );
    expect(readFileSync(join(codexRoot, "config.toml"), "utf8")).toContain(
      "[agents.zc_local_reviewer]",
    );
    expect(platformMocks.deleteCodexAgentsReceipt).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      operation: "uninstall",
      overallStatus: "complete",
      agents: expect.objectContaining({
        status: "complete",
        removed: 1,
      }),
    }));

    logSpy.mockRestore();
  });

  it("rejects conflicting Codex plugin lifecycle operations", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      install: true,
      upgrade: true,
      json: true,
    });

    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.error).toContain("只能选择一个 lifecycle 操作");

    errorSpy.mockRestore();
  });

  it("rejects --with-agents without a supported plugin lifecycle operation", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      withAgents: true,
      json: true,
    });

    const payload = JSON.parse(errorSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.error).toContain("`--with-agents` 必须与");
    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it("uses the personal marketplace for codex plugin when --global is explicit", async () => {
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: ".codex/AGENTS.md", content: "# plugin entry" },
        { path: ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 3,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformPlugin("codex", { global: true });

    expect(platformMocks.resolveInstallTarget).not.toHaveBeenCalled();
    expect(platformMocks.createCodexMarketplaceGenerationPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scope: "global" }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: join(homedir(), ".agents/plugins/marketplace.json"), content: "{}" },
        { path: join(homedir(), ".codex/AGENTS.md"), content: "# plugin entry" },
        { path: join(homedir(), ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json"), content: "{}" },
      ],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("cleans the generated Codex plugin content directories on force writes", async () => {
    platformMocks.createCodexGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [],
    });
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: ".codex/AGENTS.md", content: "# plugin entry" },
        { path: ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: ".codex/plugins/zc-toolkit/skills/start/SKILL.md", content: "# start" },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 4,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformPlugin("codex", { global: true, force: true });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([
      join(homedir(), ".codex/plugins/zc-toolkit/commands"),
      join(homedir(), ".codex/plugins/zc-toolkit/skills"),
      join(homedir(), ".codex/plugins/zc-toolkit/agents"),
    ]);
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [
        { path: join(homedir(), ".agents/plugins/marketplace.json"), content: "{}" },
        { path: join(homedir(), ".codex/AGENTS.md"), content: "# plugin entry" },
        { path: join(homedir(), ".codex/plugins/zc-toolkit/.codex-plugin/plugin.json"), content: "{}" },
        { path: join(homedir(), ".codex/plugins/zc-toolkit/skills/start/SKILL.md"), content: "# start" },
      ],
      { dryRun: false, overwrite: "force" },
    );
  });

  it("uninstalls the local Codex plugin bundle without removing agents by default", async () => {
    const projectRoot = abs("/repo/project");
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/skills/start/SKILL.md", content: "# start" },
        { path: ".codex/config.toml", content: "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n" },
        { path: ".codex/agents/zc-code-reviewer.toml", content: "name = \"zc_code_reviewer\"\n" },
      ],
    });
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 3,
      missing: 0,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      json: true,
    });

    expect(platformMocks.createCodexMarketplaceGenerationPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ scope: "project" }),
    );
    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([
      join(projectRoot, ".agents/plugins/marketplace.json"),
      join(projectRoot, "AGENTS.md"),
      join(projectRoot, "plugins/zc-toolkit"),
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      action: "plugin",
      operation: "uninstall",
      target: "codex",
      includeAgents: false,
      agentsReceiptInstalled: false,
      removed: 3,
    }));
    expect(JSON.stringify(payload.targets)).not.toContain(".codex/agents/zc-code-reviewer.toml");

    logSpy.mockRestore();
  });

  it("skips a drifted Codex plugin directory unless force is requested", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "zc-plugin-uninstall-"));
    mkdirSync(join(projectRoot, ".agents/plugins"), { recursive: true });
    mkdirSync(join(projectRoot, "plugins/zc-toolkit/.codex-plugin"), { recursive: true });
    mkdirSync(join(projectRoot, "plugins/zc-toolkit/skills/start"), { recursive: true });
    writeFileSync(join(projectRoot, ".agents/plugins/marketplace.json"), "{}");
    writeFileSync(join(projectRoot, "AGENTS.md"), "# plugin entry");
    writeFileSync(join(projectRoot, "plugins/zc-toolkit/.codex-plugin/plugin.json"), "{}");
    writeFileSync(join(projectRoot, "plugins/zc-toolkit/skills/start/SKILL.md"), "# local edit");
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/skills/start/SKILL.md", content: "# start" },
      ],
    });
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 2,
      missing: 0,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([
      join(projectRoot, ".agents/plugins/marketplace.json"),
      join(projectRoot, "AGENTS.md"),
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.skipped).toEqual([
      expect.objectContaining({
        path: join(projectRoot, "plugins/zc-toolkit/skills/start/SKILL.md"),
        kind: "plugin-dir",
        reason: "drifted",
      }),
    ]);

    logSpy.mockRestore();
  });

  it("reports drifted Codex plugin directories in uninstall plans", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "zc-plugin-uninstall-plan-"));
    mkdirSync(join(projectRoot, ".agents/plugins"), { recursive: true });
    mkdirSync(join(projectRoot, "plugins/zc-toolkit/.codex-plugin"), { recursive: true });
    mkdirSync(join(projectRoot, "plugins/zc-toolkit/skills/start"), { recursive: true });
    writeFileSync(join(projectRoot, ".agents/plugins/marketplace.json"), "{}");
    writeFileSync(join(projectRoot, "AGENTS.md"), "# plugin entry");
    writeFileSync(join(projectRoot, "plugins/zc-toolkit/.codex-plugin/plugin.json"), "{}");
    writeFileSync(join(projectRoot, "plugins/zc-toolkit/skills/start/SKILL.md"), "# local edit");
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/skills/start/SKILL.md", content: "# start" },
      ],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      plan: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload.targets).toEqual([
      expect.objectContaining({ path: join(projectRoot, ".agents/plugins/marketplace.json") }),
      expect.objectContaining({ path: join(projectRoot, "AGENTS.md") }),
    ]);
    expect(payload.skipped).toEqual([
      expect.objectContaining({
        path: join(projectRoot, "plugins/zc-toolkit/skills/start/SKILL.md"),
        kind: "plugin-dir",
        reason: "drifted",
      }),
    ]);

    logSpy.mockRestore();
  });

  it("removes a drifted Codex plugin directory when force is requested", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "zc-plugin-uninstall-force-"));
    mkdirSync(join(projectRoot, "plugins/zc-toolkit/skills/start"), { recursive: true });
    writeFileSync(join(projectRoot, "plugins/zc-toolkit/skills/start/SKILL.md"), "# local edit");
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/skills/start/SKILL.md", content: "# start" },
      ],
    });
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 3,
      missing: 0,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      force: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([
      join(projectRoot, ".agents/plugins/marketplace.json"),
      join(projectRoot, "AGENTS.md"),
      join(projectRoot, "plugins/zc-toolkit"),
    ]);
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      skipped: [],
      force: true,
    }));

    logSpy.mockRestore();
  });

  it("includes Codex custom agents in plugin uninstall only when requested", async () => {
    const projectRoot = abs("/repo/project");
    const ownedAgentPath = join(projectRoot, "agents/zc-code-reviewer.toml");
    const receiptPath = join(
      projectRoot,
      "platform-state/zc-toolkit-agents.install-receipt.json",
    );
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      capability: {
        namespace: "zc",
        surfaces: ["entry-file", "skills-dir", "agents-dir"],
        entryFile: "AGENTS.md",
        commandsDir: null,
        skillsDir: "plugins/zc-toolkit/skills",
        agentsDir: "plugins/zc-toolkit/agents",
        extensionDir: "plugins/zc-toolkit",
        agents: {
          relativeDir: "plugins/zc-toolkit/agents",
          fileExtension: ".md",
        },
      },
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/agents/code-reviewer.md", content: "# reviewer\n" },
        { path: "plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml", content: "name = \"zc_code_reviewer\"\n" },
      ],
    });
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      root: projectRoot,
      scope: "dir",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [{ path: ownedAgentPath }],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      includeAgents: true,
      plan: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "plugin",
      operation: "uninstall",
      target: "codex",
      includeAgents: true,
    }));
    expect(payload.targets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: ownedAgentPath,
        kind: "agent-file",
      }),
    ]));
    expect(payload.targets).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: join(projectRoot, "plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml"),
        kind: "agent-file",
      }),
    ]));
    expect(payload).toEqual(expect.objectContaining({
      agentConfigPath: join(projectRoot, "config.toml"),
      agentsReceiptPath: receiptPath,
      agentsReceiptInstalled: true,
    }));

    logSpy.mockRestore();
  });

  it("removes only receipt-owned agents and preserves unrelated Codex config", async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), "zc-plugin-agents-uninstall-"));
    const agentsDir = join(projectRoot, "agents");
    const ownedAgentPath = join(agentsDir, "zc-code-reviewer.toml");
    const untrackedAgentPath = join(agentsDir, "zc-local-reviewer.toml");
    const configPath = join(projectRoot, "config.toml");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(ownedAgentPath, 'name = "zc_code_reviewer"\n');
    writeFileSync(untrackedAgentPath, 'name = "zc_local_reviewer"\n');
    writeFileSync(configPath, [
      "[agents.zc_code_reviewer]",
      'config_file = "agents/zc-code-reviewer.toml"',
      "",
      "[agents.zc_local_reviewer]",
      'config_file = "agents/zc-local-reviewer.toml"',
      "",
      "[[mcp_servers]]",
      'name = "keep-me"',
      "",
    ].join("\n"));
    platformMocks.createCodexMarketplaceGenerationPlan.mockReturnValue({
      platform: "codex",
      packageName: "@zmice/platform-codex",
      manifestSource: "/repo/packages/toolkit/src/content",
      matchedAssets: [],
      artifacts: [
        { path: ".agents/plugins/marketplace.json", content: "{}" },
        { path: "AGENTS.md", content: "# plugin entry" },
        { path: "plugins/zc-toolkit/.codex-plugin/plugin.json", content: "{}" },
        { path: "plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml", content: "bundled\n" },
      ],
    });
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      root: projectRoot,
      scope: "dir",
      managedAgentNames: ["zc_code_reviewer"],
      artifacts: [{ path: ownedAgentPath }],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformPlugin("codex", {
      dir: projectRoot,
      uninstall: true,
      includeAgents: true,
      json: true,
    });

    const removedPaths = platformMocks.removeManagedPaths.mock.calls[0]?.[0] as string[];
    expect(removedPaths).toContain(ownedAgentPath);
    expect(removedPaths).not.toContain(untrackedAgentPath);
    expect(removedPaths).not.toContain(
      join(projectRoot, "plugins/zc-toolkit/assets/zc-agents/agents/zc-code-reviewer.toml"),
    );
    expect(readFileSync(configPath, "utf8")).toBe([
      "[agents.zc_local_reviewer]",
      'config_file = "agents/zc-local-reviewer.toml"',
      "",
      "[[mcp_servers]]",
      'name = "keep-me"',
      "",
    ].join("\n"));
    expect(platformMocks.deleteCodexAgentsReceipt).toHaveBeenCalledWith(
      join(projectRoot, "platform-state/zc-toolkit-agents.install-receipt.json"),
    );

    logSpy.mockRestore();
  });

  it("prints a Codex custom agents sync plan without writing files", async () => {
    const codexRoot = abs("/home/test/.codex");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: codexRoot,
      source: "official-global",
    });
    platformMocks.createCodexAgentInstallPlan.mockReturnValue(
      createCodexAgentInstallPlan(
        codexRoot,
        [
          { path: join(codexRoot, "config.toml"), content: "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n" },
          { path: join(codexRoot, "agents/zc-code-reviewer.toml"), content: "name = \"zc_code_reviewer\"\n" },
        ],
        "global",
      ),
    );
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 0,
      unchanged: 0,
      skipped: 2,
      dryRun: true,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformAgents("codex", { global: true, plan: true, json: true });

    expect(platformMocks.createCodexAgentInstallPlan).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        destinationRoot: codexRoot,
        scope: "global",
        overwrite: "force",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledTimes(2);
    expect(platformMocks.writeArtifacts.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        path: join(codexRoot, "agents/zc-code-reviewer.toml"),
        content: "name = \"zc_code_reviewer\"\n",
      }),
    ]);
    expect(platformMocks.writeArtifacts.mock.calls[0]?.[1]).toEqual({ dryRun: true, overwrite: "force" });
    expect(platformMocks.writeArtifacts.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({
        path: join(codexRoot, "config.toml"),
        content: "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n",
      }),
    ]);
    expect(platformMocks.writeArtifacts.mock.calls[1]?.[1]).toEqual({ dryRun: true, overwrite: "force" });
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "plan",
      action: "agents",
      operation: "sync",
      target: "codex",
      artifactCount: 2,
    }));

    logSpy.mockRestore();
  });

  it("uninstalls Codex custom agents without using marketplace state", async () => {
    const projectRoot = abs("/repo/project");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: projectRoot,
      source: "project-root",
    });
    platformMocks.createCodexAgentInstallPlan.mockReturnValue(
      createCodexAgentInstallPlan(
        projectRoot,
        [
          { path: join(projectRoot, ".codex/config.toml"), content: "[agents.zc_code_reviewer]\nconfig_file = \"agents/zc-code-reviewer.toml\"\n" },
          { path: join(projectRoot, ".codex/agents/zc-code-reviewer.toml"), content: "name = \"zc_code_reviewer\"\n" },
        ],
        "project",
      ),
    );
    const receiptPath = join(
      projectRoot,
      ".codex/platform-state/zc-toolkit-agents.install-receipt.json",
    );
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      artifacts: [
        { path: join(projectRoot, ".codex/agents/zc-code-reviewer.toml") },
      ],
    });
    platformMocks.removeManagedPaths.mockResolvedValue({
      removed: 1,
      missing: 0,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformAgents("codex", { project: true, uninstall: true, json: true });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([
      join(projectRoot, ".codex/agents/zc-code-reviewer.toml"),
    ]);
    expect(platformMocks.deleteCodexAgentsReceipt).toHaveBeenCalledWith(receiptPath);
    expect(platformMocks.deletePlatformInstallReceipt).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(expect.objectContaining({
      mode: "result",
      action: "agents",
      operation: "uninstall",
      target: "codex",
      removed: 1,
    }));

    logSpy.mockRestore();
  });

  it("prunes only receipt-owned stale Codex agents and preserves untracked files", async () => {
    const codexRoot = mkdtempSync(join(tmpdir(), "zc-codex-agents-"));
    const agentsDir = join(codexRoot, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const currentPath = join(agentsDir, "zc-code-reviewer.toml");
    const staleOwnedPath = join(agentsDir, "zc-old-reviewer.toml");
    const untrackedPath = join(agentsDir, "zc-local-reviewer.toml");
    writeFileSync(currentPath, "name = \"zc_code_reviewer\"\n");
    writeFileSync(staleOwnedPath, "name = \"zc_old_reviewer\"\n");
    writeFileSync(untrackedPath, "name = \"zc_local_reviewer\"\n");
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: codexRoot,
      source: "official-global",
    });
    platformMocks.createCodexAgentInstallPlan.mockReturnValue(
      createCodexAgentInstallPlan(
        codexRoot,
        [
          { path: join(codexRoot, "config.toml"), content: "[agents.zc_code_reviewer]\n" },
          { path: currentPath, content: "name = \"zc_code_reviewer\"\n" },
        ],
        "global",
      ),
    );
    platformMocks.readCodexAgentsReceipt.mockResolvedValue({
      schemaVersion: 1,
      artifacts: [
        { path: currentPath },
        { path: staleOwnedPath },
      ],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 0,
      unchanged: 2,
      skipped: 0,
      dryRun: false,
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformAgents("codex", {
      global: true,
      sync: true,
      prune: true,
      json: true,
    });

    expect(platformMocks.removeManagedPaths).toHaveBeenCalledWith([staleOwnedPath]);
    expect(platformMocks.removeManagedPaths).not.toHaveBeenCalledWith(
      expect.arrayContaining([untrackedPath]),
    );
    expect(platformMocks.writeCodexAgentsReceipt).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it("uses safe overwrite defaults for platform install and writes a receipt", async () => {
    const installRoot = abs("/tmp/install");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }]),
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
        destinationRoot: installRoot,
        scope: "dir",
        overwrite: "error",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }],
      { dryRun: false, overwrite: "error" },
    );
    expect(platformMocks.writePlatformInstallReceiptForPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationRoot: installRoot,
      }),
      expect.objectContaining({
        zcVersion: expect.any(String),
      }),
    );
  });

  it("forwards force installs to artifact writes", async () => {
    const installRoot = abs("/tmp/install");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }]),
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
      [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }],
      { dryRun: false, overwrite: "force" },
    );
  });

  it("uses the resolved project root when install target is omitted", async () => {
    const projectRoot = abs("/workspace/project");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", projectRoot, [{ path: join(projectRoot, "AGENTS.md"), content: "# agents" }]),
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
        destinationRoot: projectRoot,
        scope: "project",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("安装目录自动解析（project-root）"),
    );

    logSpy.mockRestore();
  });

  it("prints a JSON install plan without writing files when install uses --plan", async () => {
    const installRoot = abs("/tmp/install");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }], "dir", "error"),
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
        root: installRoot,
        scope: "dir",
        rootSource: "explicit",
        artifactCount: 1,
        overwrite: "error",
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            path: join(installRoot, "AGENTS.md"),
            content: "# agents",
          }),
        ]),
      }),
    );

    logSpy.mockRestore();
  });

  it("prints platform status from receipt and current plan", async () => {
    const installRoot = abs("/tmp/install");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/tmp/install",
      source: "explicit",
    });
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents" }]),
    );

    await runPlatformStatus("codex", { dir: "/tmp/install", json: true });

    expect(platformMocks.resolvePlatformInstallStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationRoot: installRoot,
      }),
    );
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "status",
        target: "codex",
        root: installRoot,
        status: "up-to-date",
        installedContentFingerprint: "installed-fingerprint",
        contentFingerprint: "current-fingerprint",
      }),
    );

    logSpy.mockRestore();
  });

  it("prints qwen platform status json with installed metadata from receipt", async () => {
    const qwenRoot = abs("/home/test/.qwen");
    const qwenBundleRoot = abs("/tmp/qwen-release/zc-toolkit");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test/.qwen",
      source: "official-global",
      hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`。",
    });
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        qwenRoot,
        [{ path: join(qwenRoot, "extensions/zc-toolkit/QWEN.md"), content: "# context" }],
        "global",
      ),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "up-to-date",
      platform: "qwen",
      receiptPath: join(qwenRoot, ".zc/platform-state/qwen.install-receipt.json"),
      receipt: {
        schemaVersion: 1,
        platform: "qwen",
        destinationRoot: qwenRoot,
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "filesystem",
        installSource: "local-bundle",
        sourceRef: qwenBundleRoot,
        bundleType: "release-bundle",
        bundlePath: qwenBundleRoot,
        artifacts: [
          {
            path: join(qwenRoot, "extensions/zc-toolkit/QWEN.md"),
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
        root: qwenRoot,
        installMethod: "filesystem",
        installSource: "local-bundle",
        sourceRef: qwenBundleRoot,
        bundleType: "release-bundle",
        bundlePath: qwenBundleRoot,
        recommendedInstallMethod: "qwen-cli",
        recommendedInstallSource: "github-repo",
        recommendedSourceRef: "https://github.com/zmice/zc-qwen-extension.git",
        recommendedBundleType: "release-bundle",
        recommendedBundlePath: expect.stringContaining("zc-toolkit"),
      }),
    );

    logSpy.mockRestore();
  });

  it("prints update plan when status shows update-available", async () => {
    const installRoot = abs("/tmp/install");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "update-available",
      platform: "codex",
      receiptPath: join(installRoot, ".codex/platform-state/codex.install-receipt.json"),
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
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents v2" }], "dir", "error"),
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
        root: installRoot,
      }),
    );

    logSpy.mockRestore();
  });

  it("treats update-available as managed overwrite and refreshes the receipt", async () => {
    const installRoot = abs("/tmp/install");
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "update-available",
      platform: "codex",
      receiptPath: join(installRoot, ".codex/platform-state/codex.install-receipt.json"),
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
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents v2" }], "dir", "error"),
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
        destinationRoot: installRoot,
        overwrite: "force",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: join(installRoot, "AGENTS.md"), content: "# agents v2" }],
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
      receiptPath: "/tmp/install/.codex/platform-state/codex.install-receipt.json",
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
      receiptPath: "/tmp/install/.codex/platform-state/codex.install-receipt.json",
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
    const claudeRoot = abs("/home/test/.claude");
    platformMocks.createClaudeInstallPlan.mockReturnValue(
      createInstallPlan("claude", claudeRoot, [{ path: join(claudeRoot, "CLAUDE.md"), content: "# claude" }]),
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
        destinationRoot: claudeRoot,
        scope: "global",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("提示：Claude Code 官方文档定义用户级 memory 文件位于 `~/.claude/CLAUDE.md`。"));

    logSpy.mockRestore();
  });

  it("prefers the official qwen extensions CLI for global installs", async () => {
    const qwenRoot = abs("/home/test/.qwen");
    platformMocks.createQwenInstallPlan.mockReturnValue(
      createQwenInstallPlan(
        qwenRoot,
        [{ path: join(qwenRoot, "extensions/zc-toolkit/QWEN.md"), content: "# context" }],
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
      receiptPath: join(qwenRoot, ".zc/platform-state/qwen.install-receipt.json"),
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
    const codexRoot = abs("/home/test/.codex");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", codexRoot, [{ path: join(codexRoot, "AGENTS.md"), content: "# agents" }], "global", "error"),
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
        root: codexRoot,
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
      receiptPath: "/tmp/install/.codex/platform-state/codex.install-receipt.json",
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
      "/tmp/install/.codex/platform-state/codex.install-receipt.json",
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
    const installRoot = abs("/tmp/install");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", installRoot, [{ path: join(installRoot, "AGENTS.md"), content: "# agents repaired" }]),
    );
    platformMocks.resolvePlatformInstallStatus.mockResolvedValue({
      kind: "drifted",
      platform: "codex",
      receiptPath: join(installRoot, ".codex/platform-state/codex.install-receipt.json"),
      receipt: {
        schemaVersion: 1,
        platform: "codex",
        destinationRoot: installRoot,
        manifestSource: "/repo/packages/toolkit/src/content",
        overwrite: "error",
        installedAt: "2026-04-19T12:00:00.000Z",
        installMethod: "filesystem",
        artifacts: [
          {
            path: join(installRoot, "AGENTS.md"),
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
          path: join(installRoot, "AGENTS.md"),
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
        destinationRoot: installRoot,
        overwrite: "force",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: join(installRoot, "AGENTS.md"), content: "# agents repaired" }],
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
      receiptPath: "/tmp/install/.codex/platform-state/codex.install-receipt.json",
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
    const codexRoot = abs("/home/test/.codex");
    platformMocks.createCodexInstallPlan.mockReturnValue(
      createInstallPlan("codex", codexRoot, [{ path: join(codexRoot, "AGENTS.md"), content: "# agents" }], "global"),
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
        root: codexRoot,
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
    const qwenRoot = abs("/home/test/.qwen");
    platformMocks.createQwenInstallPlan.mockReturnValue({
      platform: "qwen",
      packageName: "@zmice/platform-qwen",
      manifestSource: "/repo/packages/toolkit/src/content#generatedAt=2026-04-19T12:00:00.000Z",
      matchedAssets: [],
      destinationRoot: qwenRoot,
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
      artifacts: [{ path: join(qwenRoot, "extensions/zc-toolkit/QWEN.md"), content: "# context" }],
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
        root: qwenRoot,
        rootSource: "official-global",
        hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`，并在官方帮助文档中给出 Qwen CLI 的用户级 `QWEN.md` 位置为 `~/.qwen/QWEN.md`。",
      }),
    );

    logSpy.mockRestore();
  });
});
