import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "../runtime/state.js";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "claimed" | "in_progress" | "completed" | "failed";
  assignee?: string;
  claimToken?: string;
  dependencies: string[];
  files: string[];
  skills?: string[];
  createdAt: string;
  updatedAt: string;
}

export class TaskQueue {
  private tasks: Task[] = [];
  private filePath: string;

  constructor(teamDir: string) {
    this.filePath = `${teamDir}/tasks.json`;
  }

  async load(): Promise<void> {
    this.tasks = await readJson<Task[]>(this.filePath, []);
  }

  private async save(): Promise<void> {
    await writeJson(this.filePath, this.tasks);
  }

  async create(task: Omit<Task, "id" | "createdAt" | "updatedAt" | "status">): Promise<Task> {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...task,
      id: randomUUID().slice(0, 8),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.push(newTask);
    await this.save();
    return newTask;
  }

  async claim(taskId: string, workerId: string): Promise<{ task: Task; token: string }> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== "pending") throw new Error(`Task ${taskId} is not claimable (status: ${task.status})`);

    const token = randomUUID();
    task.status = "claimed";
    task.assignee = workerId;
    task.claimToken = token;
    task.updatedAt = new Date().toISOString();
    await this.save();
    return { task, token };
  }

  async transition(taskId: string, token: string, newStatus: Task["status"]): Promise<Task> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.claimToken !== token) throw new Error(`Invalid claim token for task ${taskId}`);

    task.status = newStatus;
    task.updatedAt = new Date().toISOString();
    if (newStatus === "completed" || newStatus === "failed") {
      task.claimToken = undefined;
    }
    await this.save();
    return task;
  }

  async release(taskId: string, token: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.claimToken !== token) throw new Error(`Invalid claim token for task ${taskId}`);

    task.status = "pending";
    task.assignee = undefined;
    task.claimToken = undefined;
    task.updatedAt = new Date().toISOString();
    await this.save();
  }

  list(filter?: { status?: Task["status"] }): Task[] {
    if (!filter?.status) return [...this.tasks];
    return this.tasks.filter((t) => t.status === filter.status);
  }

  getBlocked(): Task[] {
    return this.tasks.filter((t) =>
      t.status === "pending" &&
      t.dependencies.length > 0 &&
      t.dependencies.some((dep) => {
        const depTask = this.tasks.find((d) => d.id === dep);
        return !depTask || depTask.status !== "completed";
      })
    );
  }

  getReady(): Task[] {
    return this.tasks.filter((t) => {
      if (t.status !== "pending") return false;
      if (t.dependencies.length === 0) return true;
      return t.dependencies.every((dep) => {
        const depTask = this.tasks.find((d) => d.id === dep);
        return depTask?.status === "completed";
      });
    });
  }

  getById(taskId: string): Task | undefined {
    return this.tasks.find((t) => t.id === taskId);
  }
}
