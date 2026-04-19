import type {
  ToolkitAssetUnit,
  ToolkitManifest,
  ToolkitRecommendation,
  ToolkitRouteHint,
  ToolkitTaskType,
  ToolkitWorkflowRoute,
  ToolkitWorkflowRole,
} from "../types.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function assetSearchText(asset: ToolkitAssetUnit): string {
  return [
    asset.id,
    asset.meta.name,
    asset.meta.title,
    asset.meta.description,
    ...(asset.meta.tags ?? []),
    ...(asset.meta.aliases ?? [])
  ]
    .join("\n")
    .toLowerCase();
}

export function resolveToolkitAssetQuery(
  manifest: ToolkitManifest,
  query: string
): ToolkitAssetUnit | undefined {
  const normalizedQuery = normalize(query);
  const exactId = manifest.byId[normalizedQuery];

  if (exactId) {
    return exactId;
  }

  const matches = manifest.assets.filter((asset) => {
    const candidates = [asset.meta.name, asset.meta.title, ...(asset.meta.aliases ?? [])];
    return candidates.some((candidate) => normalize(candidate) === normalizedQuery);
  });

  return matches.length === 1 ? matches[0] : undefined;
}

export function searchToolkitAssets(
  manifest: ToolkitManifest,
  keyword: string
): readonly ToolkitAssetUnit[] {
  const normalizedKeyword = normalize(keyword);

  return manifest.assets.filter((asset) => assetSearchText(asset).includes(normalizedKeyword));
}

function buildRoutingWorkflows(asset: ToolkitAssetUnit): readonly ToolkitWorkflowRoute[] {
  return asset.meta.routingWorkflows ?? [];
}

function pickDefaultWorkflowEntry(
  manifest: ToolkitManifest,
  workflow: ToolkitWorkflowRoute
): string | undefined {
  const candidatesByWorkflow: Record<ToolkitWorkflowRoute, readonly string[]> = {
    "product-analysis": ["command:product-analysis", "command:idea", "command:spec"],
    "full-delivery": ["command:sdd-tdd", "command:spec", "command:task-plan", "command:build"],
    bugfix: ["command:debug", "command:build"],
    "review-closure": ["command:quality-review"],
    "docs-release": ["command:doc", "command:ship"],
    investigation: ["command:onboard", "command:ctx-health", "command:idea"]
  };

  return candidatesByWorkflow[workflow].find((assetId) => Boolean(manifest.byId[assetId]));
}

function buildWorkflowEntries(
  manifest: ToolkitManifest,
  workflows: readonly ToolkitWorkflowRoute[]
): ToolkitRouteHint["workflowEntries"] {
  const workflowEntries: Partial<Record<ToolkitWorkflowRoute, string>> = {};

  for (const workflow of workflows) {
    const entry = pickDefaultWorkflowEntry(manifest, workflow);

    if (entry) {
      workflowEntries[workflow] = entry;
    }
  }

  return workflowEntries;
}

function buildRouteHint(
  manifest: ToolkitManifest,
  asset: ToolkitAssetUnit
): ToolkitRouteHint | undefined {
  if (!asset.meta.workflowFamily || !asset.meta.workflowRole) {
    return undefined;
  }

  const workflows = buildRoutingWorkflows(asset);
  const next = [
    ...(asset.meta.requires ?? []).filter((target) => target.startsWith("command:")),
    ...(asset.meta.suggests ?? []).filter((target) => target.startsWith("command:"))
  ];

  return {
    family: asset.meta.workflowFamily,
    role: asset.meta.workflowRole,
    workflows,
    workflowEntries: buildWorkflowEntries(manifest, workflows),
    taskTypes: asset.meta.taskTypes ?? [],
    next,
    requiresFullLifecycle: asset.meta.workflowFamily === "lifecycle" || asset.id === "command:sdd-tdd"
  };
}

function buildRecommendedEntry(
  manifest: ToolkitManifest,
  target: ToolkitAssetUnit,
  route?: ToolkitRouteHint
): ToolkitRecommendation["entry"] | undefined {
  if (!route) {
    return undefined;
  }

  if (target.id === "command:start" || route.role === "intake-router") {
    return {
      commandId: "command:start",
      reason: "该资产本身就是统一任务开始入口。"
    };
  }

  if (route.role === "workflow-entry" || route.role === "specialized-entry" || route.role === "guardrail") {
    return {
      commandId: target.id,
      reason: "该资产本身就是适合直接进入的 workflow 入口。"
    };
  }

  if (route.role === "stage-entry") {
    if (route.workflows.length === 1) {
      const defaultEntry = route.workflowEntries[route.workflows[0]];

      if (defaultEntry && defaultEntry !== target.id) {
        return {
          commandId: defaultEntry,
          reason: "该资产属于固定 workflow 的阶段节点，建议先从该 workflow 的默认入口开始。"
        };
      }
    }

    if (route.family === "lifecycle") {
      return {
        commandId: "command:start",
        reason: "这是阶段入口；若还未完成任务判型，建议先从统一入口开始。"
      };
    }

    const firstCommand = route.next.find((assetId) => manifest.byId[assetId]?.meta.kind === "command");
    if (firstCommand) {
      return {
        commandId: firstCommand,
        reason: "该资产更适合作为阶段节点，建议先从相关 command 入口开始。"
      };
    }
  }

  return undefined;
}

export function recommendToolkitAssets(
  manifest: ToolkitManifest,
  query: string
): ToolkitRecommendation | undefined {
  const target = resolveToolkitAssetQuery(manifest, query);

  if (!target) {
    return undefined;
  }

  const required = (target.meta.requires ?? [])
    .map((assetId) => manifest.byId[assetId])
    .filter(Boolean);
  const suggested = (target.meta.suggests ?? [])
    .map((assetId) => manifest.byId[assetId])
    .filter(Boolean);
  const route = buildRouteHint(manifest, target);
  const entry = buildRecommendedEntry(manifest, target, route);

  return {
    target,
    required,
    suggested,
    ...(route ? { route } : {}),
    ...(entry ? { entry } : {})
  };
}

export function getToolkitRouteHint(
  manifest: ToolkitManifest,
  asset: ToolkitAssetUnit
): ToolkitRouteHint | undefined {
  return buildRouteHint(manifest, asset);
}

export function formatToolkitTaskTypes(taskTypes: readonly ToolkitTaskType[]): string {
  return taskTypes.join(", ");
}

export function isPrimaryWorkflowEntry(role: ToolkitWorkflowRole | undefined): boolean {
  return role === "intake-router" || role === "workflow-entry" || role === "specialized-entry" || role === "guardrail";
}
