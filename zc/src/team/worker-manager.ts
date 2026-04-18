import { SessionManager } from "../runtime/session-manager.js";
import { WorktreeManager } from "../runtime/worktree-manager.js";
import { getAdapter } from "../adapters/types.js";

export interface WorkerInfo {
  id: string;
  cli: string;
  status: "idle" | "busy" | "dead";
  paneId: string;
  worktree: string;
  branch: string;
  pid?: number;
  currentTask?: string;
  lastExitCode?: number;
}

export interface WorkerTaskState {
  status: "idle" | "running" | "completed" | "failed" | "dead";
  exitCode?: number;
}

export class WorkerManager {
  private workers = new Map<string, WorkerInfo>();

  constructor(
    private readonly teamName: string,
    private readonly sessionManager: SessionManager,
    private readonly worktreeManager: WorktreeManager,
  ) {}

  /**
   * Create a new worker: create worktree + tmux pane, cd into worktree
   */
  async spawnWorker(id: string, cli: string): Promise<WorkerInfo> {
    if (this.workers.has(id)) {
      throw new Error(`Worker "${id}" already exists`);
    }

    // Validate CLI adapter exists
    const adapter = getAdapter(cli);
    if (!adapter) {
      throw new Error(`Unknown CLI adapter: "${cli}"`);
    }

    // Create git worktree
    const worktreePath = await this.worktreeManager.create(id, this.teamName);
    const branch = `zc/${this.teamName}/${id}`;

    // Create tmux pane and cd into worktree
    const paneId = await this.sessionManager.createPane(
      `zc-${this.teamName}`,
      `cd "${worktreePath}"`,
    );

    const info: WorkerInfo = {
      id,
      cli,
      status: "idle",
      paneId,
      worktree: worktreePath,
      branch,
    };

    this.workers.set(id, info);
    return { ...info };
  }

  /**
   * Assign a task to a worker: start CLI in its tmux pane
   */
  async assignTask(
    workerId: string,
    taskId: string,
    prompt: string,
    model?: string,
  ): Promise<void> {
    const worker = this.getWorkerOrThrow(workerId);

    if (worker.status === "dead") {
      throw new Error(`Worker "${workerId}" is dead`);
    }

    if (worker.status === "busy") {
      throw new Error(`Worker "${workerId}" is already busy`);
    }

    const adapter = getAdapter(worker.cli);
    if (!adapter) {
      throw new Error(`CLI adapter "${worker.cli}" not found`);
    }

    // Build CLI command string based on adapter name
    const cmd = this.buildCliCommand(worker.cli, taskId, prompt, model);

    // Send command to tmux pane
    await this.sessionManager.sendKeys(worker.paneId, cmd);

    // Update worker status
    worker.status = "busy";
    worker.currentTask = taskId;
    worker.lastExitCode = undefined;
  }

  /**
   * Get worker's current output via tmux capture
   */
  async getOutput(workerId: string): Promise<string> {
    const worker = this.getWorkerOrThrow(workerId);
    return this.sessionManager.captureOutput(worker.paneId);
  }

  /**
   * Check if a worker's tmux pane is still alive
   */
  async healthCheck(workerId: string): Promise<boolean> {
    const worker = this.getWorkerOrThrow(workerId);
    try {
      await this.sessionManager.captureOutput(worker.paneId, 1);
      return true;
    } catch {
      worker.status = "dead";
      return false;
    }
  }

  async getTaskState(workerId: string): Promise<WorkerTaskState> {
    const worker = this.getWorkerOrThrow(workerId);

    if (worker.status === "dead") {
      return { status: "dead", exitCode: worker.lastExitCode };
    }

    if (worker.status !== "busy" || !worker.currentTask) {
      return { status: "idle", exitCode: worker.lastExitCode };
    }

    try {
      const output = await this.sessionManager.captureOutput(worker.paneId, 50);
      const exitCode = this.parseExitCode(output, worker.currentTask);

      if (exitCode === undefined) {
        return { status: "running" };
      }

      return {
        status: exitCode === 0 ? "completed" : "failed",
        exitCode,
      };
    } catch {
      worker.status = "dead";
      return { status: "dead", exitCode: worker.lastExitCode };
    }
  }

  markIdle(workerId: string, exitCode?: number): void {
    const worker = this.getWorkerOrThrow(workerId);
    if (worker.status === "dead") {
      return;
    }

    worker.status = "idle";
    worker.currentTask = undefined;
    worker.lastExitCode = exitCode;
  }

  /**
   * Kill a single worker: destroy pane, remove worktree
   */
  async killWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    // Kill tmux pane
    await this.sessionManager.killPane(worker.paneId);

    // Remove worktree
    try {
      await this.worktreeManager.remove(worker.worktree);
    } catch {
      // worktree may already be removed
    }

    worker.status = "dead";
    this.workers.delete(workerId);
  }

  /**
   * Shutdown all workers and kill the tmux session
   */
  async shutdownAll(): Promise<void> {
    const ids = Array.from(this.workers.keys());
    for (const id of ids) {
      await this.killWorker(id);
    }

    // Kill the team session
    await this.sessionManager.killSession(`zc-${this.teamName}`);
  }

  /**
   * List all workers
   */
  listWorkers(): WorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => ({ ...w }));
  }

  /**
   * Get all idle workers
   */
  getIdleWorkers(): WorkerInfo[] {
    return this.listWorkers().filter((w) => w.status === "idle");
  }

  // --- private helpers ---

  private getWorkerOrThrow(workerId: string): WorkerInfo {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker "${workerId}" not found`);
    }
    return worker;
  }

  private buildCliCommand(
    cli: string,
    taskId: string,
    prompt: string,
    model?: string,
  ): string {
    const escapedPrompt = this.quoteShellArg(prompt);

    let baseCommand: string;

    if (cli === "codex") {
      const parts = ["codex", "exec"];
      if (model) parts.push("--model", this.quoteShellArg(model));
      parts.push(escapedPrompt);
      baseCommand = parts.join(" ");
    } else if (cli === "qwen-code") {
      const parts = ["qwen"];
      if (model) parts.push("--model", this.quoteShellArg(model));
      parts.push("-p", escapedPrompt);
      baseCommand = parts.join(" ");
    } else {
      // Fallback: just use cli name with prompt
      const parts = [cli];
      if (model) parts.push("--model", this.quoteShellArg(model));
      parts.push(escapedPrompt);
      baseCommand = parts.join(" ");
    }

    return `${baseCommand}; printf "\\n${this.getCompletionMarker(taskId)}%s\\n" "$?"`;
  }

  private getCompletionMarker(taskId: string): string {
    return `__ZC_TASK_DONE__:${taskId}:`;
  }

  private parseExitCode(output: string, taskId: string): number | undefined {
    const marker = this.escapeForRegex(this.getCompletionMarker(taskId));
    const matches = output.match(new RegExp(`${marker}(-?\\d+)`, "g"));
    if (!matches || matches.length === 0) {
      return undefined;
    }

    const lastMatch = matches[matches.length - 1];
    const exitCode = lastMatch.match(/(-?\d+)$/)?.[1];
    if (!exitCode) {
      return undefined;
    }

    const parsed = Number(exitCode);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private quoteShellArg(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}
