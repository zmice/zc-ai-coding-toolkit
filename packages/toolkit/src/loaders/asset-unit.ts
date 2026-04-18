import { readdir } from "node:fs/promises";
import { basename, dirname, join, relative, sep } from "node:path";
import { readTextFile, listDirectoryEntries, resolveToolkitContentRoot } from "./fs.js";
import { parseSimpleYaml } from "./simple-yaml.js";
import { getToolkitKindFromDirectory } from "../schema/kinds.js";
import { validateToolkitAssetMeta } from "../schema/asset-meta.js";
import type { ToolkitAssetAttachment, ToolkitAssetUnit } from "../types.js";

function sortByRelativePath(left: ToolkitAssetAttachment, right: ToolkitAssetAttachment): number {
  return left.relativePath.localeCompare(right.relativePath);
}

async function readAttachmentsRecursive(
  assetsDirectory: string,
  unitDirectory: string
): Promise<readonly ToolkitAssetAttachment[]> {
  try {
    const directoryEntries = await readdir(assetsDirectory, { withFileTypes: true });
    const attachments: ToolkitAssetAttachment[] = [];

    for (const entry of directoryEntries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const entryPath = join(assetsDirectory, entry.name);

      if (entry.isDirectory()) {
        const nestedAttachments = await readAttachmentsRecursive(entryPath, unitDirectory);
        attachments.push(...nestedAttachments);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      attachments.push({
        relativePath: relative(unitDirectory, entryPath).split(sep).join("/"),
        contents: await readTextFile(entryPath)
      });
    }

    return attachments.sort(sortByRelativePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function loadToolkitAssetUnit(unitDirectory: string): Promise<ToolkitAssetUnit> {
  const directoryName = basename(unitDirectory);
  const kindDirectoryName = basename(dirname(unitDirectory));
  const kind = getToolkitKindFromDirectory(kindDirectoryName);
  const metaPath = join(unitDirectory, "meta.yaml");
  const bodyPath = join(unitDirectory, "body.md");
  const assetsPath = join(unitDirectory, "assets");

  if (!kind) {
    throw new Error(`Unsupported toolkit asset directory: ${kindDirectoryName}`);
  }

  const parsedMeta = parseSimpleYaml(await readTextFile(metaPath));
  const meta = validateToolkitAssetMeta(parsedMeta);

  if (meta.kind !== kind) {
    throw new Error(
      `Toolkit asset kind mismatch at ${unitDirectory}: expected ${kind}, found ${meta.kind}`
    );
  }

  if (meta.name !== directoryName) {
    throw new Error(
      `Toolkit asset name mismatch at ${unitDirectory}: expected ${directoryName}, found ${meta.name}`
    );
  }

  const body = await readTextFile(bodyPath);
  const attachments = await readAttachmentsRecursive(assetsPath, unitDirectory);

  return {
    id: `${meta.kind}:${meta.name}`,
    meta,
    body,
    attachments,
    source: {
      directory: unitDirectory,
      meta: metaPath,
      body: bodyPath,
      assets: assetsPath
    }
  };
}

export async function loadToolkitContentTree(
  contentRoot: string = resolveToolkitContentRoot()
): Promise<readonly ToolkitAssetUnit[]> {
  const kinds = ["skills", "commands", "agents"];
  const assets: ToolkitAssetUnit[] = [];

  for (const kindDirectoryName of kinds) {
    const kindDirectory = join(contentRoot, kindDirectoryName);
    const entries = await listDirectoryEntries(kindDirectory).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    });

    const unitDirectories = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => join(kindDirectory, entry.name))
      .sort((left, right) => left.localeCompare(right));

    for (const unitDirectory of unitDirectories) {
      assets.push(await loadToolkitAssetUnit(unitDirectory));
    }
  }

  return assets;
}
