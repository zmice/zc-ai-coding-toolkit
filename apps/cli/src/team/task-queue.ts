import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { TeamTaskMode } from "./planner.js";

export type TaskStatus = "pending" | "claimed" | "in_progress" | "completed" | "failed";

export interface Task {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  files: string[];
  status: TaskStatus;
  assignee?: string;
  claimToken?: string;
  skills?: string[];
  mode?: TeamTaskMode;
}

interface StoredTaskQueue {
  tasks: Task[];
}

export class TaskQueue {
  private tasks: Task[] = [];
  private nextId = 1;

  constructor(private readonly teamDir: string) {}

  private get path(): string {
    return join(this.teamDir, "tasks.json");
  }

  async load(): Promise<void> {
    await mkdir(this.teamDir, { recursive: true });
    try {
      const raw = await readFile(this.path, "utf-8");
      const data = JSON.parse(raw) as StoredTaskQueue;
      this.tasks = data.tasks ?? [];
      this.nextId = this.resolveNextId();
    } catch {
      this.tasks = [];
      this.nextId = 1;
      await this.persist();
    }
  }

  async create(task: Omit<Task, "id" | "status">): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: `task-${this.nextId++}`,
      status: "pending",
    };
    this.tasks.push(newTask);
    await this.persist();
    return newTask;
  }

  list(filter?: { status?: TaskStatus }): Task[] {
    if (!filter?.status) {
      return [...this.tasks];
    }
    return this.tasks.filter((task) => task.status === filter.status);
  }

  getById(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  getReady(): Task[] {
    const completed = new Set(
      this.tasks.filter((task) => task.status === "completed").map((task) => task.id),
    );
    return this.tasks.filter((task) => (
      task.status === "pending" &&
      task.dependencies.every((dependency) => completed.has(dependency))
    ));
  }

  async claim(id: string, workerId: string): Promise<{ task: Task; token: string }> {
    const task = this.requireTask(id);
    if (task.status !== "pending") {
      throw new Error(`Task ${id} is not pending`);
    }
    task.status = "claimed";
    task.assignee = workerId;
    task.claimToken = `${id}-${workerId}-${Date.now()}`;
    await this.persist();
    return { task, token: task.claimToken };
  }

  async transition(id: string, token: string, status: Exclude<TaskStatus, "pending" | "claimed">): Promise<Task> {
    const task = this.requireTask(id);
    if (task.claimToken !== token) {
      throw new Error(`Invalid claim token for task ${id}`);
    }
    task.status = status;
    if (status === "completed" || status === "failed") {
      delete task.claimToken;
    }
    await this.persist();
    return task;
  }

  async release(id: string, token: string): Promise<Task> {
    const task = this.requireTask(id);
    if (task.claimToken !== token) {
      throw new Error(`Invalid claim token for task ${id}`);
    }
    task.status = "pending";
    delete task.assignee;
    delete task.claimToken;
    await this.persist();
    return task;
  }

  private requireTask(id: string): Task {
    const task = this.getById(id);
    if (!task) {
      throw new Error(`Task ${id} not found`);
    }
    return task;
  }

  private resolveNextId(): number {
    const ids = this.tasks
      .map((task) => /^task-(\d+)$/.exec(task.id)?.[1])
      .filter((value): value is string => Boolean(value))
      .map((value) => Number.parseInt(value, 10));
    return ids.length === 0 ? 1 : Math.max(...ids) + 1;
  }

  private async persist(): Promise<void> {
    await writeFile(this.path, JSON.stringify({ tasks: this.tasks }, null, 2), "utf-8");
  }
}
