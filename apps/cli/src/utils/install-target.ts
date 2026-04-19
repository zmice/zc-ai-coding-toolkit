import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

type PlatformName = "qwen" | "codex" | "claude" | "opencode";
type ProjectRootMarker = ".git" | "pnpm-workspace.yaml" | "package.json";
type InstallSelectorMode = "project" | "global" | "dir";

export interface InstallTargetResolution {
  root: string;
  source: "explicit" | "project-root" | "cwd" | "official-global";
  marker?: ProjectRootMarker;
  hint?: string;
}

export interface InstallSelectorInput {
  dir?: string;
  cwd?: string;
  project?: boolean;
  global?: boolean;
}

export interface InstallSelector {
  dir?: string;
  mode: InstallSelectorMode;
}

const projectRootMarkers: readonly ProjectRootMarker[] = [".git", "pnpm-workspace.yaml", "package.json"];

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findNearestProjectRoot(startDir: string): Promise<InstallTargetResolution | null> {
  let current = resolve(startDir);

  while (true) {
    for (const marker of projectRootMarkers) {
      if (await pathExists(resolve(current, marker))) {
        return {
          root: current,
          source: "project-root",
          marker,
        };
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveOfficialGlobalTarget(platform: PlatformName): InstallTargetResolution {
  const home = homedir();

  switch (platform) {
    case "codex":
      return {
        root: resolve(home, ".codex"),
        source: "official-global",
        hint: "Codex 官方文档将 Codex home（默认 `~/.codex`）定义为全局级 `AGENTS.md` 的位置。",
      };
    case "claude":
      return {
        root: resolve(home, ".claude"),
        source: "official-global",
        hint: "Claude Code 官方文档定义用户级 memory 文件位于 `~/.claude/CLAUDE.md`。",
      };
    case "opencode":
      return {
        root: resolve(home, ".config", "opencode"),
        source: "official-global",
        hint: "OpenCode 官方文档定义全局 rules 位于 `~/.config/opencode/AGENTS.md`，commands/skills/agents 目录也位于该配置根下。",
      };
    case "qwen":
      return {
        root: resolve(home, ".qwen"),
        source: "official-global",
        hint: "Qwen 官方文档定义用户级配置目录为 `~/.qwen`，并在官方帮助文档中给出 Qwen CLI 的用户级 `QWEN.md` 位置为 `~/.qwen/QWEN.md`。",
      };
  }
}

export function normalizeInstallSelector(options: InstallSelectorInput): InstallSelector {
  const explicitDir = options.dir;

  if (options.project && options.global) {
    throw new Error("`--project` 与 `--global` 不能同时使用。");
  }

  if (explicitDir && (options.project || options.global)) {
    throw new Error("显式目录 `--dir` 不能与 `--project` 或 `--global` 同时使用。");
  }

  const selectorFromFlags: InstallSelectorMode =
    options.global ? "global" : "project";

  const mode: InstallSelectorMode = explicitDir ? "dir" : selectorFromFlags;

  return {
    dir: explicitDir,
    mode,
  };
}

export async function resolveInstallTarget(
  _platform: PlatformName,
  options: InstallSelectorInput,
): Promise<InstallTargetResolution> {
  const platform = _platform;
  const selector = normalizeInstallSelector(options);

  if (selector.dir) {
    return {
      root: resolve(selector.dir),
      source: "explicit",
    };
  }

  if (selector.mode === "global") {
    return resolveOfficialGlobalTarget(platform);
  }

  const cwd = resolve(options.cwd ?? process.cwd());
  const projectRoot = await findNearestProjectRoot(cwd);
  if (projectRoot) {
    return projectRoot;
  }

  return {
    root: cwd,
    source: "cwd",
  };
}
