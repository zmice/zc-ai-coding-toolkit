import type { ToolkitManifest } from "../types.js";
import { validateToolkitAssetUnit } from "./asset-unit.js";

export function validateToolkitManifest(input: unknown): ToolkitManifest {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid toolkit manifest: expected an object");
  }

  const manifest = input as ToolkitManifest;

  if (manifest.version !== 1) {
    throw new Error("Invalid toolkit manifest: version must be 1");
  }

  if (typeof manifest.generatedAt !== "string" || manifest.generatedAt.trim().length === 0) {
    throw new Error("Invalid toolkit manifest: generatedAt must be a non-empty string");
  }

  if (typeof manifest.contentRoot !== "string" || manifest.contentRoot.trim().length === 0) {
    throw new Error("Invalid toolkit manifest: contentRoot must be a non-empty string");
  }

  if (!Array.isArray(manifest.assets)) {
    throw new Error("Invalid toolkit manifest: assets must be an array");
  }

  for (const asset of manifest.assets) {
    validateToolkitAssetUnit(asset);
  }

  if (typeof manifest.byId !== "object" || manifest.byId === null) {
    throw new Error("Invalid toolkit manifest: byId must be an object");
  }

  return manifest;
}
