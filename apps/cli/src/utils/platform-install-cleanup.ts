import { lstat, rm } from "node:fs/promises";

export interface RemovedPathSummary {
  readonly removed: number;
  readonly missing: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export async function removeManagedPaths(paths: readonly string[]): Promise<RemovedPathSummary> {
  const uniquePaths = [...new Set(paths)];
  let removed = 0;
  let missing = 0;

  for (const path of uniquePaths) {
    if (await pathExists(path)) {
      await rm(path, { recursive: true, force: true });
      removed += 1;
      continue;
    }

    missing += 1;
  }

  return {
    removed,
    missing,
  };
}
