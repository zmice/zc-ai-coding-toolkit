import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveToolkitPackageRoot } from "../loaders/fs.js";

export const internalSourceUpstreamIds = ["toolkit-original"] as const;

export function extractKnownUpstreamIds(source: string): readonly string[] {
  const ids = new Set<string>(internalSourceUpstreamIds);
  const pattern = /^\s*-\s+id:\s*([a-z0-9-]+)\s*$/gim;

  for (const match of source.matchAll(pattern)) {
    const id = match[1]?.trim();
    if (id) {
      ids.add(id);
    }
  }

  return [...ids];
}

export function resolveWorkspaceRoot(moduleUrl: string = import.meta.url): string {
  return resolve(resolveToolkitPackageRoot(moduleUrl), "..", "..");
}

export function resolveUpstreamRegistryPath(moduleUrl: string = import.meta.url): string {
  return join(resolveWorkspaceRoot(moduleUrl), "references", "upstreams.yaml");
}

export async function loadKnownUpstreamIds(moduleUrl: string = import.meta.url): Promise<readonly string[]> {
  const registryPath = resolveUpstreamRegistryPath(moduleUrl);

  if (!existsSync(registryPath)) {
    return [...internalSourceUpstreamIds];
  }

  const raw = await readFile(registryPath, "utf8");
  return extractKnownUpstreamIds(raw);
}
