import { isToolkitKind } from "./kinds.js";
import {
  toolkitAssetAudiences,
  toolkitAssetStabilities,
  toolkitAssetTiers,
  toolkitPlatforms,
  type ToolkitAssetAudience,
  type ToolkitAssetMeta,
  type ToolkitAssetSource,
  type ToolkitAssetStability,
  type ToolkitAssetTier,
  type ToolkitPlatform
} from "../types.js";

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

function assertAssetReferenceArray(value: unknown, fieldName: string): readonly string[] | undefined {
  const references = assertStringArray(value, fieldName);

  if (!references) {
    return undefined;
  }

  for (const reference of references) {
    if (!reference.includes(":")) {
      throw new Error(
        `Invalid asset meta: ${fieldName} references must use full asset ids like "skill:name"`
      );
    }
  }

  return references;
}

function assertEnumValue<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = assertNonEmptyString(value, fieldName);

  if (!(allowedValues as readonly string[]).includes(normalized)) {
    throw new Error(
      `Invalid asset meta: ${fieldName} must be one of ${allowedValues.join(", ")}`
    );
  }

  return normalized as T;
}

function assertSourceRecord(value: unknown): ToolkitAssetSource | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid asset meta: source must be an object");
  }

  const record = value as LooseRecord;
  const upstream = assertNonEmptyString(record.upstream, "source.upstream");
  const strategy = assertNonEmptyString(record.strategy, "source.strategy");
  const notes =
    record.notes === undefined
      ? undefined
      : assertNonEmptyString(record.notes, "source.notes");

  return {
    upstream,
    strategy,
    ...(notes ? { notes } : {})
  };
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
  const tier = assertEnumValue<ToolkitAssetTier>(record.tier, "tier", toolkitAssetTiers);
  const audience = assertEnumValue<ToolkitAssetAudience>(
    record.audience,
    "audience",
    toolkitAssetAudiences
  );
  const stability = assertEnumValue<ToolkitAssetStability>(
    record.stability,
    "stability",
    toolkitAssetStabilities
  );
  const tags = assertStringArray(record.tags, "tags");
  const tools = assertStringArray(record.tools, "tools");
  const platforms = assertPlatformArray(record.platforms);
  const aliases = assertStringArray(record.aliases, "aliases");
  const requires = assertAssetReferenceArray(record.requires, "requires");
  const suggests = assertAssetReferenceArray(record.suggests, "suggests");
  const conflictsWith = assertAssetReferenceArray(record.conflicts_with, "conflicts_with");
  const supersedes = assertAssetReferenceArray(record.supersedes, "supersedes");
  const source = assertSourceRecord(record.source);

  return {
    kind,
    name,
    title,
    description,
    ...(tier ? { tier } : {}),
    ...(audience ? { audience } : {}),
    ...(stability ? { stability } : {}),
    ...(tags ? { tags } : {}),
    ...(tools ? { tools } : {}),
    ...(platforms ? { platforms } : {}),
    ...(aliases ? { aliases } : {}),
    ...(requires ? { requires } : {}),
    ...(suggests ? { suggests } : {}),
    ...(conflictsWith ? { conflictsWith } : {}),
    ...(supersedes ? { supersedes } : {}),
    ...(source ? { source } : {})
  };
}

function kindList(): string {
  return ["skill", "command", "agent"].join(", ");
}
