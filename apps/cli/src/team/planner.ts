export type TeamTaskMode = "parallel" | "serial" | "worktree";

export interface TeamTaskSpec {
  id: string;
  title: string;
  description: string;
  files: string[];
  dependencies: string[];
  skills?: string[];
  mode: TeamTaskMode;
}

export interface FileConflict {
  file: string;
  tasks: string[];
}

export interface TeamPlan {
  tasks: TeamTaskSpec[];
  batches: string[][];
  conflicts: FileConflict[];
  recommendedWorkers: number;
  requiresWorktree: boolean;
  reasons: string[];
  canStart: boolean;
  blockers: string[];
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeFile(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function parseTeamTaskDescriptors(rawTasks: readonly string[]): TeamTaskSpec[] {
  return rawTasks.map((raw, index) => {
    const parts = raw
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const title = parts[0] || `task-${index + 1}`;
    const fields = new Map<string, string>();

    for (const part of parts.slice(1)) {
      const separator = part.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      fields.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
    }

    const modeValue = fields.get("mode");
    const mode: TeamTaskMode =
      modeValue === "serial" || modeValue === "worktree" || modeValue === "parallel"
        ? modeValue
        : "parallel";

    return {
      id: `task-${index + 1}`,
      title,
      description: title,
      files: splitList(fields.get("files")).map(normalizeFile),
      dependencies: splitList(fields.get("deps") ?? fields.get("dependencies")),
      skills: splitList(fields.get("skills")),
      mode,
    };
  });
}

export function createTeamPlan(
  tasks: readonly TeamTaskSpec[],
  workerCount?: number,
): TeamPlan {
  const conflicts = detectFileConflicts(tasks);
  const batches = buildBatches(tasks);
  const hasDependencies = tasks.some((task) => task.dependencies.length > 0);
  const parallelRequested = (workerCount ?? tasks.length) > 1;
  const hasUnscopedParallelTasks = parallelRequested && tasks.length > 1 && tasks.some((task) => task.files.length === 0);
  const hasWorktreeMode = tasks.some((task) => task.mode === "worktree");
  const reasons: string[] = [];
  const blockers: string[] = [];

  if (tasks.length > 1) {
    reasons.push("multiple tasks requested");
  }
  if (tasks.length > 0) {
    reasons.push("team workers run in isolated git worktrees");
  }
  if (hasWorktreeMode) {
    reasons.push("one or more tasks explicitly request worktree mode");
  }
  if (parallelRequested && conflicts.length > 0) {
    reasons.push("file conflicts require isolation or serial execution");
    blockers.push("file-conflicts");
  }
  if (parallelRequested && hasDependencies) {
    reasons.push("dependencies require cascade execution instead of blind parallel start");
    blockers.push("dependencies-present");
  }
  if (hasUnscopedParallelTasks) {
    reasons.push("parallel task independence cannot be proven without file ownership metadata");
    blockers.push("missing-file-ownership");
  }

  const maxBatchSize = Math.max(0, ...batches.map((batch) => batch.length));
  const naturalWorkerCount = maxBatchSize || tasks.length || 1;
  const recommendedWorkers = Math.max(
    1,
    Math.min(workerCount ?? naturalWorkerCount, naturalWorkerCount),
  );

  return {
    tasks: [...tasks],
    batches,
    conflicts,
    recommendedWorkers,
    requiresWorktree: tasks.length > 0,
    reasons,
    canStart: blockers.length === 0,
    blockers,
  };
}

function detectFileConflicts(tasks: readonly TeamTaskSpec[]): FileConflict[] {
  const owners = new Map<string, string[]>();

  for (const task of tasks) {
    for (const file of task.files) {
      const current = owners.get(file) ?? [];
      current.push(task.id);
      owners.set(file, current);
    }
  }

  return [...owners.entries()]
    .filter(([, taskIds]) => taskIds.length > 1)
    .map(([file, taskIds]) => ({ file, tasks: taskIds }));
}

function buildBatches(tasks: readonly TeamTaskSpec[]): string[][] {
  const remaining = new Map(tasks.map((task) => [task.id, task]));
  const completed = new Set<string>();
  const batches: string[][] = [];

  while (remaining.size > 0) {
    const batch = [...remaining.values()]
      .filter((task) => task.dependencies.every((dependency) => completed.has(dependency)))
      .map((task) => task.id);

    if (batch.length === 0) {
      batches.push([...remaining.keys()]);
      break;
    }

    batches.push(batch);
    for (const id of batch) {
      remaining.delete(id);
      completed.add(id);
    }
  }

  return batches;
}
