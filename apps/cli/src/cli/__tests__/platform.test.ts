import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMocks = vi.hoisted(() => ({
  createQwenGenerationPlan: vi.fn(),
  createCodexInstallPlan: vi.fn(),
  createQoderInstallPlan: vi.fn(),
  loadToolkitManifest: vi.fn(),
  importWorkspaceDistModule: vi.fn(),
  resolveInstallTarget: vi.fn(),
  writeArtifacts: vi.fn(),
}));

vi.mock("../../utils/workspace.js", () => ({
  importWorkspaceDistModule: platformMocks.importWorkspaceDistModule,
  resolveWorkspacePath: vi.fn((relativePath: string) => `/workspace/${relativePath}`),
  writeArtifacts: platformMocks.writeArtifacts,
}));

vi.mock("../../utils/install-target.js", () => ({
  resolveInstallTarget: platformMocks.resolveInstallTarget,
}));

import { runPlatformGenerate, runPlatformInstall } from "../platform.js";

describe("platform CLI", () => {
  beforeEach(() => {
    platformMocks.createQwenGenerationPlan.mockReset();
    platformMocks.createCodexInstallPlan.mockReset();
    platformMocks.createQoderInstallPlan.mockReset();
    platformMocks.loadToolkitManifest.mockReset();
    platformMocks.importWorkspaceDistModule.mockReset();
    platformMocks.resolveInstallTarget.mockReset();
    platformMocks.writeArtifacts.mockReset();

    platformMocks.loadToolkitManifest.mockResolvedValue({
      contentRoot: "/repo/packages/toolkit/src/content",
      assets: [
        {
          id: "skill-alpha",
          body: "body",
          meta: {
            kind: "skill",
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
    platformMocks.resolveInstallTarget.mockImplementation(async (_target: string, options: { out?: string; cwd?: string }) => ({
      root: options.out ?? options.cwd ?? process.cwd(),
      source: options.out ? "explicit" : "cwd",
    }));
  });

  it("passes dry-run options into platform generate writes", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue({
      artifacts: [{ path: "QWEN.md", content: "# context" }],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 0,
      unchanged: 0,
      skipped: 1,
      dryRun: true,
    });

    await runPlatformGenerate("qwen", { out: "/tmp/out", dryRun: true });

    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/out/QWEN.md", content: "# context" }],
      { dryRun: true, overwrite: "error" },
    );
  });

  it("prints a JSON plan without writing files when generate uses --plan", async () => {
    platformMocks.createQwenGenerationPlan.mockReturnValue({
      artifacts: [{ path: "QWEN.md", content: "# context" }],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformGenerate("qwen", { out: "/tmp/out", plan: true, format: "json" });

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

  it("uses safe overwrite defaults for platform install", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue({
      artifacts: [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 1,
      overwritten: 0,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformInstall("codex", { out: "/tmp/install" });

    expect(platformMocks.createCodexInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/tmp/install",
        overwrite: "error",
      }),
    );
    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      { dryRun: false, overwrite: "error" },
    );
  });

  it("forwards force installs to artifact writes", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue({
      artifacts: [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
    });
    platformMocks.writeArtifacts.mockResolvedValue({
      created: 0,
      overwritten: 1,
      unchanged: 0,
      skipped: 0,
      dryRun: false,
    });

    await runPlatformInstall("codex", { out: "/tmp/install", force: true });

    expect(platformMocks.writeArtifacts).toHaveBeenCalledWith(
      [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      { dryRun: false, overwrite: "force" },
    );
  });

  it("uses the resolved project root when install target is omitted", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue({
      artifacts: [{ path: "/workspace/project/AGENTS.md", content: "# agents" }],
    });
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
      out: undefined,
      cwd: process.cwd(),
      scope: undefined,
    });
    expect(platformMocks.createCodexInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/workspace/project",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("安装目录自动解析（project-root）"),
    );

    logSpy.mockRestore();
  });

  it("prints a JSON install plan without writing files when install uses --plan", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue({
      artifacts: [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      overwrite: "error",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformInstall("codex", { out: "/tmp/install", plan: true, format: "json" });

    expect(platformMocks.writeArtifacts).not.toHaveBeenCalled();
    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "install",
        target: "codex",
        root: "/tmp/install",
        rootSource: "explicit",
        artifactCount: 1,
        overwrite: "error",
        artifacts: [{ path: "/tmp/install/AGENTS.md", content: "# agents" }],
      }),
    );

    logSpy.mockRestore();
  });

  it("passes global scope through install target resolution and exposes official path hints", async () => {
    platformMocks.createQoderInstallPlan.mockReturnValue({
      artifacts: [{ path: "/home/test/.qoder/AGENTS.md", content: "# agents" }],
    });
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

    await runPlatformInstall("qoder", { scope: "global" });

    expect(platformMocks.resolveInstallTarget).toHaveBeenCalledWith("qoder", {
      out: undefined,
      cwd: process.cwd(),
      scope: "global",
    });
    expect(platformMocks.createQoderInstallPlan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        destinationRoot: "/home/test/.qoder",
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("提示：Qoder 官方文档定义用户级 memory 文件位于 `~/.qoder/AGENTS.md`。"));

    logSpy.mockRestore();
  });

  it("prints a JSON install plan with scope metadata", async () => {
    platformMocks.createCodexInstallPlan.mockReturnValue({
      artifacts: [{ path: "/home/test/AGENTS.md", content: "# agents" }],
      overwrite: "error",
    });
    platformMocks.resolveInstallTarget.mockResolvedValue({
      root: "/home/test",
      source: "official-global",
      hint: "Codex 官方文档将 `~` 视为 AGENTS.md 的典型用户级位置。",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await runPlatformInstall("codex", { scope: "global", plan: true, format: "json" });

    const payload = JSON.parse(logSpy.mock.calls[0]?.[0] ?? "{}");
    expect(payload).toEqual(
      expect.objectContaining({
        mode: "plan",
        action: "install",
        target: "codex",
        scope: "global",
        root: "/home/test",
        rootSource: "official-global",
        hint: "Codex 官方文档将 `~` 视为 AGENTS.md 的典型用户级位置。",
      }),
    );

    logSpy.mockRestore();
  });
});
