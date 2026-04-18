import { beforeEach, describe, expect, it, vi } from "vitest";

const platformMocks = vi.hoisted(() => ({
  createQwenGenerationPlan: vi.fn(),
  createCodexInstallPlan: vi.fn(),
  loadToolkitManifest: vi.fn(),
  importWorkspaceDistModule: vi.fn(),
  writeArtifacts: vi.fn(),
}));

vi.mock("../../utils/workspace.js", () => ({
  importWorkspaceDistModule: platformMocks.importWorkspaceDistModule,
  resolveWorkspacePath: vi.fn((relativePath: string) => `/workspace/${relativePath}`),
  writeArtifacts: platformMocks.writeArtifacts,
}));

import { runPlatformGenerate, runPlatformInstall } from "../platform.js";

describe("platform CLI", () => {
  beforeEach(() => {
    platformMocks.createQwenGenerationPlan.mockReset();
    platformMocks.createCodexInstallPlan.mockReset();
    platformMocks.loadToolkitManifest.mockReset();
    platformMocks.importWorkspaceDistModule.mockReset();
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

      throw new Error(`unexpected import: ${relativePath}`);
    });
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
});
