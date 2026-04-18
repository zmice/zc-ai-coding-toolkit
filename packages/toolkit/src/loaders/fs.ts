import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveToolkitPackageRoot(moduleUrl: string = import.meta.url): string {
  return resolve(dirname(fileURLToPath(moduleUrl)), "..", "..");
}

export function resolveToolkitContentRoot(moduleUrl: string = import.meta.url): string {
  return join(resolveToolkitPackageRoot(moduleUrl), "src", "content");
}

export function resolveToolkitTemplatesRoot(moduleUrl: string = import.meta.url): string {
  return join(resolveToolkitPackageRoot(moduleUrl), "templates");
}

export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function listDirectoryEntries(directoryPath: string) {
  return readdir(directoryPath, { withFileTypes: true });
}
