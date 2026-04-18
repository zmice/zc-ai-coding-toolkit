import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type PlatformName = "qwen" | "codex" | "qoder";
type ProjectRootMarker = ".git" | "pnpm-workspace.yaml" | "package.json";

export interface InstallTargetResolution {
  root: string;
  source: "explicit" | "project-root" | "cwd";
  marker?: ProjectRootMarker;
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

export async function resolveInstallTarget(
  _platform: PlatformName,
  options: { out?: string; cwd?: string },
): Promise<InstallTargetResolution> {
  if (options.out) {
    return {
      root: resolve(options.out),
      source: "explicit",
    };
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
