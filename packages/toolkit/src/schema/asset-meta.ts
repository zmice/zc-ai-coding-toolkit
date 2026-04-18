import { isToolkitKind } from "./kinds.js";
import { toolkitPlatforms, type ToolkitAssetMeta, type ToolkitPlatform } from "../types.js";

type LooseRecord = Record<string, unknown>;

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid asset meta: ${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function assertStringArray(value: unknown, fieldName: string): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid asset meta: ${fieldName} must be an array of strings`);
  }

  const normalized = value.map((item) => assertNonEmptyString(item, fieldName));

  return normalized.length > 0 ? normalized : undefined;
}

function assertPlatformArray(value: unknown): readonly ToolkitPlatform[] | undefined {
  const platforms = assertStringArray(value, "platforms");

  if (!platforms) {
    return undefined;
  }

  for (const platform of platforms) {
    if (!(toolkitPlatforms as readonly string[]).includes(platform)) {
      throw new Error(
        `Invalid asset meta: platforms must only contain ${toolkitPlatforms.join(", ")}`
      );
    }
  }

  return platforms as readonly ToolkitPlatform[];
}

export function validateToolkitAssetMeta(input: unknown): ToolkitAssetMeta {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid asset meta: expected an object");
  }

  const record = input as LooseRecord;
  const kind = assertNonEmptyString(record.kind, "kind");

  if (!isToolkitKind(kind)) {
    throw new Error(`Invalid asset meta: kind must be one of ${kindList()}`);
  }

  const name = assertNonEmptyString(record.name, "name");
  const title = assertNonEmptyString(record.title, "title");
  const description = assertNonEmptyString(record.description, "description");
  const tags = assertStringArray(record.tags, "tags");
  const tools = assertStringArray(record.tools, "tools");
  const platforms = assertPlatformArray(record.platforms);

  return {
    kind,
    name,
    title,
    description,
    ...(tags ? { tags } : {}),
    ...(tools ? { tools } : {}),
    ...(platforms ? { platforms } : {})
  };
}

function kindList(): string {
  return ["skill", "command", "agent"].join(", ");
}
