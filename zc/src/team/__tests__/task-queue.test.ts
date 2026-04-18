import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskQueue } from "../task-queue.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("TaskQueue", () => {
  let teamDir: string;
  let queue: TaskQueue;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "tq-test-"));
    queue = new TaskQueue(teamDir);
    await queue.load();
  });

  // afterEach: cleanup is best-effort, not critical for tests
  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("create() should create a task with pending status", async () => {
    const task = await queue.create({
      title: "Test task",
      description: "A test task",
      dependencies: [],
      files: ["src/foo.ts"],
    });

    expect(task.id).toBeTruthy();
    expect(task.status).toBe("pending");
    expect(task.title).toBe("Test task");
    expect(task.files).toEqual(["src/foo.ts"]);
    expect(task.createdAt).toBeTruthy();
  });

  it("claim() + transition() full lifecycle", async () => {
    const task = await queue.create({
      title: "Lifecycle task",
      description: "",
      dependencies: [],
      files: [],
    });

    // claim
    const { task: claimed, token } = await queue.claim(task.id, "worker-1");
    expect(claimed.status).toBe("claimed");
    expect(claimed.assignee).toBe("worker-1");

    // transition to in_progress
    const inProgress = await queue.transition(task.id, token, "in_progress");
    expect(inProgress.status).toBe("in_progress");

    // transition to completed
    const completed = await queue.transition(task.id, token, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.claimToken).toBeUndefined();
  });

  it("claim-safe: wrong token should throw", async () => {
    const task = await queue.create({
      title: "Safe task",
      description: "",
      dependencies: [],
      files: [],
    });

    await queue.claim(task.id, "worker-1");

    await expect(
      queue.transition(task.id, "wrong-token", "in_progress")
    ).rejects.toThrow("Invalid claim token");
  });

  it("claim() on non-pending task should throw", async () => {
    const task = await queue.create({
      title: "Already claimed",
      description: "",
      dependencies: [],
      files: [],
    });

    await queue.claim(task.id, "worker-1");

    await expect(
      queue.claim(task.id, "worker-2")
    ).rejects.toThrow("is not claimable");
  });

  it("release() should reset task to pending", async () => {
    const task = await queue.create({
      title: "Release task",
      description: "",
      dependencies: [],
      files: [],
    });

    const { token } = await queue.claim(task.id, "worker-1");
    await queue.release(task.id, token);

    const released = queue.getById(task.id);
    expect(released?.status).toBe("pending");
    expect(released?.assignee).toBeUndefined();
    expect(released?.claimToken).toBeUndefined();
  });

  it("getReady() returns only tasks with all deps completed", async () => {
    const dep = await queue.create({
      title: "Dependency",
      description: "",
      dependencies: [],
      files: [],
    });

    const child = await queue.create({
      title: "Child",
      description: "",
      dependencies: [dep.id],
      files: [],
    });

    const independent = await queue.create({
      title: "Independent",
      description: "",
      dependencies: [],
      files: [],
    });

    // Before completing dep: child is not ready
    let ready = queue.getReady();
    const readyIds = ready.map((t) => t.id);
    expect(readyIds).toContain(dep.id);
    expect(readyIds).toContain(independent.id);
    expect(readyIds).not.toContain(child.id);

    // Complete the dependency
    const { token } = await queue.claim(dep.id, "w1");
    await queue.transition(dep.id, token, "completed");

    // Now child should be ready
    ready = queue.getReady();
    expect(ready.map((t) => t.id)).toContain(child.id);
  });

  it("getBlocked() returns pending tasks with incomplete deps", async () => {
    const dep = await queue.create({
      title: "Dep",
      description: "",
      dependencies: [],
      files: [],
    });

    const blocked = await queue.create({
      title: "Blocked",
      description: "",
      dependencies: [dep.id],
      files: [],
    });

    expect(queue.getBlocked().map((t) => t.id)).toContain(blocked.id);
  });

  it("list() with status filter", async () => {
    await queue.create({ title: "A", description: "", dependencies: [], files: [] });
    const b = await queue.create({ title: "B", description: "", dependencies: [], files: [] });
    await queue.claim(b.id, "w1");

    expect(queue.list({ status: "pending" })).toHaveLength(1);
    expect(queue.list({ status: "claimed" })).toHaveLength(1);
    expect(queue.list()).toHaveLength(2);
  });

  it("persists and reloads from disk", async () => {
    await queue.create({ title: "Persist", description: "", dependencies: [], files: [] });

    const queue2 = new TaskQueue(teamDir);
    await queue2.load();
    expect(queue2.list()).toHaveLength(1);
    expect(queue2.list()[0].title).toBe("Persist");
  });
});
