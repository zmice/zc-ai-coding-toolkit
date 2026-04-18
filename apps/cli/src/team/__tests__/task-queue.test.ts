import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskQueue } from "../task-queue.js";

describe("TaskQueue", () => {
  let teamDir: string;
  let queue: TaskQueue;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "zc-taskqueue-"));
    queue = new TaskQueue(teamDir);
    await queue.load();
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates tasks", async () => {
    const task = await queue.create({
      title: "CLI task",
      description: "test",
      dependencies: [],
      files: [],
    });
    expect(task.status).toBe("pending");
    expect(queue.list()).toHaveLength(1);
  });
});
