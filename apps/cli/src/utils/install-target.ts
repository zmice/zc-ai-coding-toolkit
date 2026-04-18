import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

type PlatformName = "qwen" | "codex" | "qoder";
type ProjectRootMarker = ".git" | "pnpm-workspace.yaml" | "package.json";
type InstallScope = "project" | "global";

export interface InstallTargetResolution {
  root: string;
  source: "explicit" | "project-root" | "cwd" | "official-global";
  marker?: ProjectRootMarker;
  hint?: string;
}

const projectRootMarkers: readonly ProjectRootMarker[] = [".git", "pnpm-workspace.yaml", "package.json"];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findNearestProjectRoot(startDir: string): Promise<InstallTargetResolution | null> {
  let current = resolve(startDir);

  while (true) {
    for (const marker of projectRootMarkers) {
      if (await pathExists(resolve(current, marker))) {
        return {
          root: current,
          source: "project-root",
          marker,
        };
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveOfficialGlobalTarget(platform: PlatformName): InstallTargetResolution {
  const home = homedir();

  switch (platform) {
    case "codex":
      return {
        root: home,
        source: "official-global",
        hint: "Codex 官方文档将 `~` 视为 AGENTS.md 的典型用户级位置。",
      };
    case "qoder":
      return {
        root: resolve(home, ".qoder"),
        source: "official-global",
        hint: "Qoder 官方文档定义用户级 memory 文件位于 `~/.qoder/AGENTS.md`。",
      };
    case "qwen":
      throw new Error(
        "Qwen 官方文档只明确了项目级 `QWEN.md` 和用户级 `~/.qwen/settings.json`，未给出全局 `QWEN.md` 默认位置。请显式传入 `-o <dir>`。",
      );
  }
}

export async function resolveInstallTarget(
  _platform: PlatformName,
  options: { out?: string; cwd?: string; scope?: InstallScope | string },
): Promise<InstallTargetResolution> {
  const platform = _platform;

  if (options.out) {
    return {
      root: resolve(options.out),
      source: "explicit",
    };
  }

  const scope = options.scope ?? "project";
  if (scope !== "project" && scope !== "global") {
    throw new Error(`不支持的安装范围：${scope}。可选值：project | global`);
  }

  if (scope === "global") {
    return resolveOfficialGlobalTarget(platform);
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  const projectRoot = await findNearestProjectRoot(cwd);
  if (projectRoot) {
    return projectRoot;
  }

  return {
    root: cwd,
    source: "cwd",
  };
}
