import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface GeneratedArtifact {
  path: string;
  content: string;
}

function resolveFromModule(moduleUrl: string, relativePath: string): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), relativePath);
}

export function resolveWorkspaceRoot(moduleUrl: string = import.meta.url): string {
  return resolveFromModule(moduleUrl, "../../../..");
}

export function resolveWorkspacePath(relativePath: string, moduleUrl: string = import.meta.url): string {
  return resolve(resolveWorkspaceRoot(moduleUrl), relativePath);
}

export async function importWorkspaceDistModule<T>(
  relativePath: string,
  moduleUrl: string = import.meta.url
): Promise<T> {
  const absolutePath = resolveWorkspacePath(relativePath, moduleUrl);

  try {
    await access(absolutePath);
  } catch {
    throw new Error(
      `Workspace module "${relativePath}" is not built yet. Build it first, e.g. "pnpm --dir ${dirname(
        resolveWorkspacePath(relativePath.replace(/\/dist\/.*/, ""), moduleUrl)
      )} build".`
    );
  }

  return import(pathToFileURL(absolutePath).href) as Promise<T>;
}

export async function writeArtifacts(artifacts: readonly GeneratedArtifact[]): Promise<void> {
  for (const artifact of artifacts) {
    await mkdir(dirname(artifact.path), { recursive: true });
    await writeFile(artifact.path, artifact.content, "utf8");
  }
}
