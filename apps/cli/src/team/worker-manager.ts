import { SessionManager } from "../runtime/session-manager.js";
import { WorktreeManager } from "../runtime/worktree-manager.js";

export interface WorkerInfo {
  id: string;
  cli: string;
  status: "idle" | "busy";
  currentTask?: string;
  paneId?: string;
  worktreePath?: string;
  exitCode?: number;
}

export interface WorkerTaskState {
  status: "running" | "completed" | "failed";
  exitCode?: number;
}

export class WorkerManager {
  private workers = new Map<string, WorkerInfo>();
  private taskState = new Map<string, WorkerTaskState>();

  constructor(
    private readonly teamName: string,
    private readonly sessionManager: SessionManager,
    private readonly worktreeManager: WorktreeManager,
  ) {}

  async spawnWorker(id: string, cli: string): Promise<WorkerInfo> {
    const worktreePath = await this.worktreeManager.create(`${this.teamName}-${id}`);
    const paneId = await this.sessionManager.createPane(`zc-${this.teamName}`, `${cli} --workdir ${worktreePath}`);
    const worker: WorkerInfo = {
      id,
      cli,
      status: "idle",
      paneId,
      worktreePath,
    };
    this.workers.set(id, worker);
    return worker;
  }

  listWorkers(): WorkerInfo[] {
    return [...this.workers.values()];
  }

  getIdleWorkers(): WorkerInfo[] {
    return this.listWorkers().filter((worker) => worker.status === "idle");
  }

  async assignTask(id: string, taskId: string, prompt: string, model?: string): Promise<void> {
    const worker = this.workers.get(id);
    if (!worker) {
      throw new Error(`Worker ${id} not found`);
    }
    worker.status = "busy";
    worker.currentTask = taskId;
    this.taskState.set(id, { status: "running" });
    await this.sessionManager.sendKeys(worker.paneId ?? "", [prompt, model ? `--model ${model}` : ""].filter(Boolean).join(" "));
  }

  async getTaskState(id: string): Promise<WorkerTaskState> {
    return this.taskState.get(id) ?? { status: "completed", exitCode: 0 };
  }

  markIdle(id: string, exitCode?: number): void {
    const worker = this.workers.get(id);
    if (!worker) return;
    worker.status = "idle";
    delete worker.currentTask;
    worker.exitCode = exitCode;
  }

  async shutdownAll(): Promise<void> {
    for (const worker of this.workers.values()) {
      if (worker.paneId) {
        await this.sessionManager.killPane(worker.paneId);
      }
      if (worker.worktreePath) {
        await this.worktreeManager.remove(`${this.teamName}-${worker.id}`);
      }
    }
    this.workers.clear();
  }
}
