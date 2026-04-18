import { toolkitKinds, type ToolkitKind } from "../types.js";

const kindDirectoryMap: Readonly<Record<string, ToolkitKind>> = {
  agents: "agent",
  commands: "command",
  skills: "skill"
};

export function isToolkitKind(value: string): value is ToolkitKind {
  return (toolkitKinds as readonly string[]).includes(value);
}

export function getToolkitKindFromDirectory(
  directoryName: string
): ToolkitKind | undefined {
  return kindDirectoryMap[directoryName];
}

export function getToolkitKindDirectory(kind: ToolkitKind): string {
  for (const [directoryName, mappedKind] of Object.entries(kindDirectoryMap)) {
    if (mappedKind === kind) {
      return directoryName;
    }
  }

  return kind;
}

export function compareToolkitKinds(left: ToolkitKind, right: ToolkitKind): number {
  return toolkitKinds.indexOf(left) - toolkitKinds.indexOf(right);
}
