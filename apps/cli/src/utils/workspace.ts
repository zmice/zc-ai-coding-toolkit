import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface GeneratedArtifact {
  path: string;
  content: string;
}

export type ArtifactOverwriteMode = "error" | "force";

export interface WriteArtifactsOptions {
  overwrite?: ArtifactOverwriteMode;
  dryRun?: boolean;
}

export interface WriteArtifactsResult {
  created: number;
  overwritten: number;
  unchanged: number;
  skipped: number;
  dryRun: boolean;
}

export interface ArtifactConflict {
  path: string;
}

export class ArtifactConflictError extends Error {
  readonly conflicts: readonly ArtifactConflict[];

  constructor(conflicts: readonly ArtifactConflict[]) {
    super(`Artifact conflicts detected for ${conflicts.length} file(s).`);
    this.name = "ArtifactConflictError";
    this.conflicts = conflicts;
  }
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

export async function writeArtifacts(
  artifacts: readonly GeneratedArtifact[],
  options: WriteArtifactsOptions = {}
): Promise<WriteArtifactsResult> {
  const overwrite = options.overwrite ?? "error";
  const dryRun = options.dryRun ?? false;
  const conflicts: ArtifactConflict[] = [];
  const pendingWrites: GeneratedArtifact[] = [];
  const result: WriteArtifactsResult = {
    created: 0,
    overwritten: 0,
    unchanged: 0,
    skipped: 0,
    dryRun
  };

  for (const artifact of artifacts) {
    let existingContent: string | undefined;

    try {
      existingContent = await readFile(artifact.path, "utf8");
    } catch {
      existingContent = undefined;
    }

    if (existingContent === artifact.content) {
      result.unchanged += 1;
      continue;
    }

    if (existingContent !== undefined && overwrite === "error") {
      conflicts.push({ path: artifact.path });
      continue;
    }

    pendingWrites.push(artifact);

    if (existingContent === undefined) {
      result.created += 1;
    } else {
      result.overwritten += 1;
    }
  }

  if (conflicts.length > 0) {
    throw new ArtifactConflictError(conflicts);
  }

  if (dryRun) {
    result.skipped = pendingWrites.length;
    return result;
  }

  for (const artifact of pendingWrites) {
    await mkdir(dirname(artifact.path), { recursive: true });
    await writeFile(artifact.path, artifact.content, "utf8");
  }

  return result;
}
