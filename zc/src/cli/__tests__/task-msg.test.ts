import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskQueue } from "../../team/task-queue.js";
import { Mailbox } from "../../team/mailbox.js";

describe("task CLI helpers", () => {
  let teamDir: string;
  let queue: TaskQueue;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "zc-task-cli-"));
    queue = new TaskQueue(teamDir);
    await queue.load();
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("TaskQueue list returns tasks after create", async () => {
    await queue.create({ title: "CLI task", description: "test", dependencies: [], files: [] });
    const tasks = queue.list();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("CLI task");
    expect(tasks[0].status).toBe("pending");
  });

  it("claim + done lifecycle via TaskQueue", async () => {
    const task = await queue.create({ title: "Done task", description: "", dependencies: [], files: [] });
    const { token } = await queue.claim(task.id, "cli-user");
    const completed = await queue.transition(task.id, token, "completed");
    expect(completed.status).toBe("completed");
  });

  it("claim + fail lifecycle via TaskQueue", async () => {
    const task = await queue.create({ title: "Fail task", description: "", dependencies: [], files: [] });
    const { token } = await queue.claim(task.id, "cli-user");
    const failed = await queue.transition(task.id, token, "failed");
    expect(failed.status).toBe("failed");
  });

  it("getById returns undefined for non-existent task", () => {
    expect(queue.getById("nonexistent")).toBeUndefined();
  });
});

describe("msg CLI helpers", () => {
  let teamDir: string;
  let mailbox: Mailbox;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "zc-msg-cli-"));
    mailbox = new Mailbox(teamDir);
    await mailbox.load();
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("send + list works correctly", async () => {
    await mailbox.send("cli-user", "worker-1", "hello from cli");
    const msgs = mailbox.list("worker-1");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toBe("hello from cli");
  });

  it("broadcast shows in allMessages", async () => {
    await mailbox.broadcast("cli-user", "announcement");
    const all = mailbox.allMessages();
    expect(all).toHaveLength(1);
    expect(all[0].to).toBe("all");
  });

  it("markRead changes status", async () => {
    const msg = await mailbox.send("cli-user", "w1", "test");
    await mailbox.markRead(msg.id);
    const all = mailbox.allMessages();
    expect(all.find((m) => m.id === msg.id)?.status).toBe("read");
  });

  it("allMessages returns empty array when no messages", () => {
    expect(mailbox.allMessages()).toHaveLength(0);
  });
});
