import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export type AgentControllerMode =
  | "none"
  | "readonly-consult"
  | "serial-subagent"
  | "context-fanout"
  | "worktree-team";

export type AgentTaskExecution = "readonly" | "write" | "worktree";

export interface AgentTaskLineRange {
  readonly file: string;
  readonly range: string;
}

export interface AgentTaskOwnership {
  readonly files: readonly string[];
  readonly forbidden: readonly string[];
  readonly lineRanges: readonly AgentTaskLineRange[];
  readonly intent: string;
}

export interface AgentTaskLoopBudget {
  readonly maxRounds: number;
  readonly maxContextRequests: number;
  readonly stopCondition: string;
}

export interface AgentControllerTask {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly execution: AgentTaskExecution;
  readonly agent: string;
  readonly dependencies: readonly string[];
  readonly ownership: AgentTaskOwnership;
  readonly verification: string;
  readonly loopBudget: AgentTaskLoopBudget;
  readonly artifactPaths: {
    readonly brief: string;
    readonly report: string;
    readonly review: string;
  };
}

export interface AgentControllerConflict {
  readonly kind: "file-overlap" | "directory-proximity";
  readonly severity: "blocker" | "warning";
  readonly path: string;
  readonly tasks: readonly string[];
}

export interface AgentControllerPlan {
  readonly schema_version: 1;
  readonly kind: "agent-controller-plan";
  readonly run_id: string;
  readonly root: string;
  readonly objective: string;
  readonly mode: AgentControllerMode;
  readonly requested_mode: AgentControllerMode | "auto";
  readonly status: "ready" | "blocked";
  readonly dry_run: boolean;
  readonly dispatch_contract: {
    readonly dispatch_now: "no";
    readonly dispatch_evidence: readonly string[];
    readonly mode: AgentControllerMode;
    readonly agents: readonly string[];
    readonly ownership_required: boolean;
    readonly loop_budget: string;
    readonly fallback: string;
  };
  readonly artifacts: {
    readonly root: string;
    readonly plan: string;
    readonly ledger: string;
    readonly fan_in: string;
  };
  readonly context_maintenance: {
    readonly needed: boolean;
    readonly agent: "zc_context_steward" | "main-thread";
    readonly mode: "readonly_audit" | "scoped_write";
    readonly owned_files: readonly string[];
  };
  readonly tasks: readonly AgentControllerTask[];
  readonly conflicts: readonly AgentControllerConflict[];
  readonly blockers: readonly string[];
  readonly fan_in_gate: readonly string[];
}

export interface CreateAgentControllerPlanInput {
  readonly root: string;
  readonly objective?: string;
  readonly rawTasks: readonly string[];
  readonly requestedMode?: AgentControllerMode | "auto";
  readonly runId?: string;
  readonly allowWorktreeTeam?: boolean;
}

export interface WriteAgentControllerPlanOptions {
  readonly force?: boolean;
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

function normalizePath(pathValue: string): string {
  return pathValue.replace(/\\/g, "/").replace(/^\.\//, "");
}

function normalizeMode(value: string | undefined): AgentControllerMode | "auto" {
  if (
    value === "none"
    || value === "readonly-consult"
    || value === "serial-subagent"
    || value === "context-fanout"
    || value === "worktree-team"
    || value === "auto"
  ) {
    return value;
  }
  return "auto";
}

function normalizeExecution(value: string | undefined): AgentTaskExecution {
  if (value === "readonly" || value === "read-only" || value === "ro") {
    return "readonly";
  }
  if (value === "worktree") {
    return "worktree";
  }
  return "write";
}

function parseFields(raw: string): { title: string; fields: ReadonlyMap<string, string> } {
  const parts = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  const fields = new Map<string, string>();

  for (const part of parts.slice(1)) {
    const separator = part.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    fields.set(part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim());
  }

  return {
    title: parts[0] ?? "task",
    fields,
  };
}

function parseLineRanges(value: string | undefined): AgentTaskLineRange[] {
  return splitList(value).map((entry) => {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) {
      return { file: normalizePath(entry), range: "-" };
    }
    return {
      file: normalizePath(entry.slice(0, separator)),
      range: entry.slice(separator + 1),
    };
  });
}

function createRunId(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return [
    "agent",
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`,
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`,
  ].join("-");
}

function artifactRootFor(root: string, runId: string): string {
  return join(root, ".codex", "work", "agent-runs", runId);
}

function toRelative(root: string, pathValue: string): string {
  return normalizePath(relative(root, pathValue));
}

function buildTask(
  raw: string,
  index: number,
  runRoot: string,
  root: string,
): AgentControllerTask {
  const { title, fields } = parseFields(raw);
  const id = fields.get("id") ?? `task-${String(index + 1).padStart(3, "0")}`;
  const files = splitList(fields.get("files")).map(normalizePath);
  const execution = normalizeExecution(fields.get("mode") ?? fields.get("execution"));
  const verification = fields.get("verify") ?? fields.get("verification") ?? "";
  const briefPath = join(runRoot, "tasks", `${id}.md`);
  const reportPath = join(runRoot, "reports", `${id}.md`);
  const reviewPath = join(runRoot, "reviews", `${id}.md`);

  return {
    id,
    title,
    description: fields.get("description") ?? title,
    execution,
    agent: fields.get("agent") ?? (execution === "readonly" ? "readonly-consult" : "implementer"),
    dependencies: splitList(fields.get("deps") ?? fields.get("dependencies")),
    ownership: {
      files,
      forbidden: splitList(fields.get("forbidden")).map(normalizePath),
      lineRanges: parseLineRanges(fields.get("lines") ?? fields.get("line_ranges")),
      intent: fields.get("intent") ?? (execution === "readonly" ? "readonly-consult" : "implementation"),
    },
    verification,
    loopBudget: {
      maxRounds: Number.parseInt(fields.get("rounds") ?? "2", 10) || 2,
      maxContextRequests: Number.parseInt(fields.get("context_requests") ?? "2", 10) || 2,
      stopCondition: "same finding twice, missing report, unowned file change, or skipped verification",
    },
    artifactPaths: {
      brief: toRelative(root, briefPath),
      report: toRelative(root, reportPath),
      review: toRelative(root, reviewPath),
    },
  };
}

function fileParent(pathValue: string): string {
  const index = pathValue.lastIndexOf("/");
  return index <= 0 ? "." : pathValue.slice(0, index);
}

function detectConflicts(tasks: readonly AgentControllerTask[]): AgentControllerConflict[] {
  const writable = tasks.filter((task) => task.execution !== "readonly");
  const fileOwners = new Map<string, string[]>();
  const directoryOwners = new Map<string, string[]>();

  for (const task of writable) {
    for (const file of task.ownership.files) {
      fileOwners.set(file, [...(fileOwners.get(file) ?? []), task.id]);
      directoryOwners.set(fileParent(file), [...(directoryOwners.get(fileParent(file)) ?? []), task.id]);
    }
  }

  const overlaps = [...fileOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([path, owners]) => ({
      kind: "file-overlap" as const,
      severity: "blocker" as const,
      path,
      tasks: owners,
    }));
  const proximity = [...directoryOwners.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .filter(([path]) => path !== ".")
    .map(([path, owners]) => ({
      kind: "directory-proximity" as const,
      severity: "warning" as const,
      path,
      tasks: [...new Set(owners)],
    }));

  return [...overlaps, ...proximity];
}

function chooseAutoMode(
  tasks: readonly AgentControllerTask[],
  conflicts: readonly AgentControllerConflict[],
): AgentControllerMode {
  if (tasks.length === 0) {
    return "none";
  }
  if (tasks.some((task) => task.execution === "worktree")) {
    return "worktree-team";
  }
  if (tasks.every((task) => task.execution === "readonly")) {
    return "readonly-consult";
  }
  if (tasks.some((task) => task.dependencies.length > 0)) {
    return "serial-subagent";
  }
  if (conflicts.some((conflict) => conflict.kind === "file-overlap")) {
    return "serial-subagent";
  }
  return tasks.length > 1 ? "context-fanout" : "serial-subagent";
}

function buildBlockers(
  tasks: readonly AgentControllerTask[],
  mode: AgentControllerMode,
  requestedMode: AgentControllerMode | "auto",
  conflicts: readonly AgentControllerConflict[],
  allowWorktreeTeam: boolean | undefined,
): string[] {
  const blockers: string[] = [];
  const writableTasks = tasks.filter((task) => task.execution !== "readonly");

  if (tasks.length === 0) {
    blockers.push("missing-tasks");
  }
  if (mode === "readonly-consult" && writableTasks.length > 0) {
    blockers.push("readonly-mode-cannot-write");
  }
  if ((mode === "context-fanout" || mode === "worktree-team") && writableTasks.some((task) => task.ownership.files.length === 0)) {
    blockers.push("missing-file-ownership");
  }
  if (writableTasks.some((task) => task.verification.length === 0)) {
    blockers.push("missing-verification");
  }
  if (mode === "context-fanout" && tasks.some((task) => task.dependencies.length > 0)) {
    blockers.push("dependencies-present");
  }
  if (mode === "context-fanout" && conflicts.some((conflict) => conflict.kind === "file-overlap")) {
    blockers.push("file-conflicts");
  }
  if (mode === "worktree-team" && !allowWorktreeTeam) {
    blockers.push("worktree-team-requires-explicit-confirmation");
  }
  if (requestedMode === "readonly-consult" && writableTasks.length > 0) {
    blockers.push("requested-readonly-conflicts-with-writable-task");
  }

  return [...new Set(blockers)];
}

function needsContextMaintenance(tasks: readonly AgentControllerTask[]): boolean {
  return tasks.some((task) =>
    task.ownership.files.some((file) =>
      file === "AGENTS.md"
      || file.startsWith(".codex/context/")
      || file.startsWith("docs/")
      || file === "package.json",
    ),
  );
}

function fanInGateFor(mode: AgentControllerMode): string[] {
  const base = [
    "all task reports exist before acceptance",
    "controller checks unowned file changes before fan-in",
    "producer owns fix for accepted findings",
    "reviewer owns regression for review findings",
    "controller runs final verification before completion",
  ];

  if (mode === "context-fanout" || mode === "worktree-team") {
    return [
      ...base,
      "no overlapping writable files or unresolved directory proximity warnings",
    ];
  }

  return base;
}

export function createAgentControllerPlan(input: CreateAgentControllerPlanInput): AgentControllerPlan {
  const root = resolve(input.root);
  const runId = input.runId ?? createRunId();
  const runRoot = artifactRootFor(root, runId);
  const tasks = input.rawTasks.map((task, index) => buildTask(task, index, runRoot, root));
  const conflicts = detectConflicts(tasks);
  const requestedMode = normalizeMode(input.requestedMode);
  const mode = requestedMode === "auto" ? chooseAutoMode(tasks, conflicts) : requestedMode;
  const blockers = buildBlockers(tasks, mode, requestedMode, conflicts, input.allowWorktreeTeam);
  const contextMaintenanceNeeded = needsContextMaintenance(tasks);

  return {
    schema_version: 1,
    kind: "agent-controller-plan",
    run_id: runId,
    root,
    objective: input.objective ?? "agent-controller-run",
    mode,
    requested_mode: requestedMode,
    status: blockers.length > 0 ? "blocked" : "ready",
    dry_run: true,
    dispatch_contract: {
      dispatch_now: "no",
      dispatch_evidence: [
        "dry-run controller artifact only",
        "no Codex worker was spawned",
      ],
      mode,
      agents: [...new Set(tasks.map((task) => task.agent))],
      ownership_required: tasks.some((task) => task.execution !== "readonly"),
      loop_budget: "readonly=1 round, writable=2 rounds, context requests=2",
      fallback: blockers.length > 0 ? "main-thread or serial-subagent after blockers are resolved" : "ready for explicit dispatch by platform runtime",
    },
    artifacts: {
      root: toRelative(root, runRoot),
      plan: toRelative(root, join(runRoot, "plan.json")),
      ledger: toRelative(root, join(runRoot, "ledger.md")),
      fan_in: toRelative(root, join(runRoot, "fan-in.md")),
    },
    context_maintenance: {
      needed: contextMaintenanceNeeded,
      agent: contextMaintenanceNeeded ? "zc_context_steward" : "main-thread",
      mode: contextMaintenanceNeeded ? "scoped_write" : "readonly_audit",
      owned_files: [".codex/context/**", "AGENTS.md managed block"],
    },
    tasks,
    conflicts,
    blockers,
    fan_in_gate: fanInGateFor(mode),
  };
}

function renderList(items: readonly string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
}

function renderTaskBrief(plan: AgentControllerPlan, task: AgentControllerTask): string {
  return [
    `# ${task.id}: ${task.title}`,
    "",
    `Run: ${plan.run_id}`,
    `Mode: ${task.execution}`,
    `Agent: ${task.agent}`,
    "",
    "## Objective",
    "",
    task.description,
    "",
    "## Ownership",
    "",
    "Allowed files:",
    renderList(task.ownership.files),
    "",
    "Forbidden files:",
    renderList(task.ownership.forbidden),
    "",
    `Intent: ${task.ownership.intent}`,
    "",
    "## Verification",
    "",
    task.verification || "- missing",
    "",
    "## Loop Budget",
    "",
    `- max rounds: ${task.loopBudget.maxRounds}`,
    `- max context requests: ${task.loopBudget.maxContextRequests}`,
    `- stop condition: ${task.loopBudget.stopCondition}`,
    "",
    "## Output Contract",
    "",
    "- status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
    "- changed files",
    "- verification evidence",
    "- findings and risks",
    "- fan-in notes",
    "",
  ].join("\n");
}

function renderReportTemplate(plan: AgentControllerPlan, task: AgentControllerTask): string {
  return [
    `# Report: ${task.id}`,
    "",
    `Run: ${plan.run_id}`,
    "",
    "## Status",
    "",
    "BLOCKED",
    "",
    "## Changed Files",
    "",
    "- none",
    "",
    "## Verification",
    "",
    "- not run",
    "",
    "## Findings",
    "",
    "- none",
    "",
    "## Fan-In Notes",
    "",
    "- report template only",
    "",
  ].join("\n");
}

function renderReviewTemplate(plan: AgentControllerPlan, task: AgentControllerTask): string {
  return [
    `# Review: ${task.id}`,
    "",
    `Run: ${plan.run_id}`,
    "",
    "## Spec Compliance",
    "",
    "- pending",
    "",
    "## Code Quality",
    "",
    "- pending",
    "",
    "## Regression",
    "",
    "- pending",
    "",
  ].join("\n");
}

function renderLedger(plan: AgentControllerPlan): string {
  return [
    `# Agent Ledger: ${plan.run_id}`,
    "",
    `Status: ${plan.status}`,
    `Mode: ${plan.mode}`,
    "",
    "## Timeline",
    "",
    "- planned: controller dry-run artifacts created",
    "",
    "## Tasks",
    "",
    ...plan.tasks.map((task) => [`### ${task.id}`, "", `- status: planned`, `- report: ${task.artifactPaths.report}`, ""].join("\n")),
  ].join("\n");
}

function renderFanIn(plan: AgentControllerPlan): string {
  return [
    `# Fan-In: ${plan.run_id}`,
    "",
    `Mode: ${plan.mode}`,
    "",
    "## Gate",
    "",
    renderList(plan.fan_in_gate),
    "",
    "## Accepted Changes",
    "",
    "- pending",
    "",
    "## Rejected Changes",
    "",
    "- pending",
    "",
    "## Verification Evidence",
    "",
    "- pending",
    "",
    "## Remaining Risks",
    "",
    "- pending",
    "",
  ].join("\n");
}

async function writeText(pathValue: string, content: string, force: boolean | undefined): Promise<void> {
  if (!force && existsSync(pathValue)) {
    throw new Error(`artifact already exists: ${pathValue}`);
  }
  await mkdir(dirname(pathValue), { recursive: true });
  await writeFile(pathValue, content, "utf8");
}

export async function writeAgentControllerArtifacts(
  plan: AgentControllerPlan,
  options: WriteAgentControllerPlanOptions = {},
): Promise<string[]> {
  const root = resolve(plan.root);
  const runRoot = resolve(root, plan.artifacts.root);
  const written: string[] = [];
  const writes: Array<{ path: string; content: string }> = [
    {
      path: resolve(root, plan.artifacts.plan),
      content: `${JSON.stringify({ ...plan, dry_run: false }, null, 2)}\n`,
    },
    {
      path: resolve(root, plan.artifacts.ledger),
      content: renderLedger(plan),
    },
    {
      path: resolve(root, plan.artifacts.fan_in),
      content: renderFanIn(plan),
    },
  ];

  for (const task of plan.tasks) {
    writes.push(
      { path: join(runRoot, "tasks", `${task.id}.md`), content: renderTaskBrief(plan, task) },
      { path: join(runRoot, "reports", `${task.id}.md`), content: renderReportTemplate(plan, task) },
      { path: join(runRoot, "reviews", `${task.id}.md`), content: renderReviewTemplate(plan, task) },
    );
  }

  for (const write of writes) {
    await writeText(write.path, write.content, options.force);
    written.push(toRelative(root, write.path));
  }

  return written;
}
