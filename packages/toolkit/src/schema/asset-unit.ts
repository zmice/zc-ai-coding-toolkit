import type { ToolkitAssetUnit } from "../types.js";

export function validateToolkitAssetUnit(input: unknown): ToolkitAssetUnit {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid asset unit: expected an object");
  }

  const record = input as ToolkitAssetUnit;

  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    throw new Error("Invalid asset unit: id must be a non-empty string");
  }

  if (typeof record.body !== "string") {
    throw new Error("Invalid asset unit: body must be a string");
  }

  if (!Array.isArray(record.attachments)) {
    throw new Error("Invalid asset unit: attachments must be an array");
  }

  if (typeof record.source !== "object" || record.source === null) {
    throw new Error("Invalid asset unit: source must be an object");
  }

  return record;
}
