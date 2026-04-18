import { mkdir } from "node:fs/promises";
import { TaskQueue, type Task } from "./task-queue.js";
import { Mailbox } from "./mailbox.js";
import { WorkerManager, type WorkerInfo } from "./worker-manager.js";
import { writeJson, readJson } from "../runtime/state.js";
import type { SessionManager } from "../runtime/session-manager.js";
import type { WorktreeManager } from "../runtime/worktree-manager.js";
import {
  discoverSkills,
  matchSkills,
  KeywordSkillMatcher,
  AISkillMatcher,
  type SkillMeta,
  type SkillMatcher,
} from "../utils/skill-loader.js";
import { getAdapter } from "../adapters/types.js";

export interface TeamSpec {
  name: string;
  workers: Array<{
    id: string;
    cli: string;
  }>;
  tasks: string[];
  model?: string;
  skills?: string[];
  skillMatchMode?: "keyword" | "ai";
}

export interface TeamStatus {
  name: string;
  workers: WorkerInfo[];
  tasks: { pending: number; running: number; done: number; failed: number };
  messages: number;
}

const DISPATCH_INTERVAL_MS = 3000;

export class Orchestrator {
  private taskQueue!: TaskQueue;
  private mailbox!: Mailbox;
  private workerManager!: WorkerManager;
  private teamName = "";
  private model?: string;
  private running = false;

  /** Cached skills discovered at team startup */
  private availableSkills: SkillMeta[] = [];

  private skillMatcher: SkillMatcher = new KeywordSkillMatcher();

  /** Map workerId → { taskId, claimToken } for running tasks */
  private activeAssignments = new Map<string, { taskId: string; token: string }>();

  constructor(
    private readonly stateDir: string,
    private readonly sessionManager: SessionManager,
    private readonly worktreeManager: WorktreeManager,
  ) {}

  // --- public API ---

  async startTeam(spec: TeamSpec): Promise<void> {
    this.teamName = spec.name;
    this.model = spec.model;
    const teamDir = `${this.stateDir}/${spec.name}`;

    // 1. Create state directory
    await mkdir(teamDir, { recursive: true });

    // 2. Initialise sub-systems
    this.taskQueue = new TaskQueue(teamDir);
    await this.taskQueue.load();

    this.mailbox = new Mailbox(teamDir);
    await this.mailbox.load();

    this.workerManager = new WorkerManager(
      spec.name,
      this.sessionManager,
      this.worktreeManager,
    );

    // 3. Create tmux session for team
    await this.sessionManager.createSession(`zc-${spec.name}`);

    // 4. Create tasks
    for (const desc of spec.tasks) {
      await this.taskQueue.create({
        title: desc,
        description: desc,
        dependencies: [],
        files: [],
        skills: spec.skills,
      });
    }

    // 5. Discover available skills for context injection
    try {
      this.availableSkills = await discoverSkills();
    } catch {
      this.availableSkills = [];
    }

    // 6. Initialize skill matcher
    if (spec.skillMatchMode === "ai") {
      const adapterName = spec.workers[0]?.cli;
      const adapter = adapterName ? getAdapter(adapterName) : undefined;
      if (adapter?.query) {
        this.skillMatcher = new AISkillMatcher(adapter);
      }
    }

    // 7. Spawn workers
    for (const w of spec.workers) {
      await this.workerManager.spawnWorker(w.id, w.cli);
    }

    // 7. Persist initial state
    await this.persistState();

    // 8. Mark team ready; the caller decides when to run the dispatch loop.
    this.running = true;
  }

  /**
   * Run one iteration of the dispatch loop (exposed for testing).
   */
  async dispatchOnce(): Promise<void> {
    // 1. Check health of busy workers and handle finished/dead ones
    await this.checkWorkerHealth();

    // 2. Dispatch ready tasks to idle workers
    const readyTasks = this.taskQueue.getReady();
    const idleWorkers = this.workerManager.getIdleWorkers();

    const pairs = Math.min(readyTasks.length, idleWorkers.length);
    for (let i = 0; i < pairs; i++) {
      const task = readyTasks[i];
      const worker = idleWorkers[i];
      let token: string | undefined;

      try {
        const claimResult = await this.taskQueue.claim(task.id, worker.id);
        token = claimResult.token;
        await this.taskQueue.transition(task.id, token, "in_progress");

        // Enrich prompt with matched skill context
        const enrichedPrompt = await this.enrichWithSkills(task);

        await this.workerManager.assignTask(
          worker.id,
          task.id,
          enrichedPrompt,
          this.model,
        );
        this.activeAssignments.set(worker.id, { taskId: task.id, token });
      } catch {
        // Rollback: if we already claimed the task, release it back to pending
        if (token) {
          try {
            await this.taskQueue.release(task.id, token);
          } catch {
            // rollback failure is non-fatal
          }
        }
      }
    }

    // 3. Persist state
    await this.persistState();
  }

  /**
   * Continuous dispatch loop – runs until `shutdown()` is called.
   */
  async runDispatchLoop(): Promise<void> {
    while (this.running) {
      await this.dispatchOnce();
      await this.sleep(DISPATCH_INTERVAL_MS);
    }
  }

  async getStatus(): Promise<TeamStatus> {
    const workers = this.workerManager.listWorkers();
    const allTasks = this.taskQueue.list();
    const messages = this.mailbox.allMessages();

    return {
      name: this.teamName,
      workers,
      tasks: {
        pending: allTasks.filter((t) => t.status === "pending" || t.status === "claimed").length,
        running: allTasks.filter((t) => t.status === "in_progress").length,
        done: allTasks.filter((t) => t.status === "completed").length,
        failed: allTasks.filter((t) => t.status === "failed").length,
      },
      messages: messages.length,
    };
  }

  async shutdown(): Promise<void> {
    this.running = false;

    // Release all active assignments back to pending
    for (const [, { taskId, token }] of this.activeAssignments) {
      try {
        await this.taskQueue.release(taskId, token);
      } catch {
        // task may already be completed / failed
      }
    }
    this.activeAssignments.clear();

    await this.workerManager.shutdownAll();
    await this.persistState();
  }

  // --- Expose sub-systems for CLI layer ---

  getWorkerManager(): WorkerManager {
    return this.workerManager;
  }

  getMailbox(): Mailbox {
    return this.mailbox;
  }

  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  // --- private helpers ---

  private async checkWorkerHealth(): Promise<void> {
    const workers = this.workerManager.listWorkers();

    for (const w of workers) {
      if (w.status === "busy") {
        const taskState = await this.workerManager.getTaskState(w.id);
        const assignment = this.activeAssignments.get(w.id);

        if (!assignment) {
          if (taskState.status === "completed" || taskState.status === "failed") {
            this.workerManager.markIdle(w.id, taskState.exitCode);
          }
          continue;
        }

        if (taskState.status === "completed" || taskState.status === "failed") {
          try {
            await this.taskQueue.transition(
              assignment.taskId,
              assignment.token,
              taskState.status === "completed" ? "completed" : "failed",
            );
          } catch {
            // ignore
          }
          this.workerManager.markIdle(w.id, taskState.exitCode);
          this.activeAssignments.delete(w.id);
          continue;
        }

        if (taskState.status === "dead") {
          try {
            await this.taskQueue.transition(
              assignment.taskId,
              assignment.token,
              "failed",
            );
          } catch {
            // ignore
          }
          this.activeAssignments.delete(w.id);
        }
      }
    }
  }

  private async persistState(): Promise<void> {
    const status = await this.getStatus();
    await writeJson(`${this.stateDir}/${this.teamName}/state.json`, status);
  }

  /**
   * Enrich a task prompt with matched skill context summaries.
   */
  private async enrichWithSkills(task: { description: string; skills?: string[] }): Promise<string> {
    if (this.availableSkills.length === 0) return task.description;

    let matched: SkillMeta[];

    // Priority 1: Manual skills specification
    if (task.skills && task.skills.length > 0) {
      matched = task.skills
        .map((name) => this.availableSkills.find((s) => s.name === name))
        .filter((s): s is SkillMeta => s !== undefined);
    } else {
      // Priority 2: Use configured skill matcher (AI or keyword)
      try {
        const result = this.skillMatcher.match(task.description, this.availableSkills);
        matched = result instanceof Promise ? await result : result;
      } catch {
        // AI matcher failed, fallback to keyword matching
        matched = matchSkills(task.description, this.availableSkills);
      }
    }

    if (matched.length === 0) return task.description;

    // Take top 3 matches, extract first 500 chars as summary
    const summaries = matched.slice(0, 3).map((s) => {
      const summary = s.content.slice(0, 500);
      return `[Skill: ${s.name}]\n${summary}...`;
    });

    return `${task.description}\n\n--- Related Skills ---\n${summaries.join("\n\n")}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
