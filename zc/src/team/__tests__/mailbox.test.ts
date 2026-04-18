import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Mailbox } from "../mailbox.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Mailbox", () => {
  let teamDir: string;
  let mailbox: Mailbox;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "mb-test-"));
    mailbox = new Mailbox(teamDir);
    await mailbox.load();
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("send() creates a message with pending status", async () => {
    const msg = await mailbox.send("leader", "worker-1", "hello");

    expect(msg.id).toBeTruthy();
    expect(msg.from).toBe("leader");
    expect(msg.to).toBe("worker-1");
    expect(msg.body).toBe("hello");
    expect(msg.status).toBe("pending");
    expect(msg.timestamp).toBeTruthy();
  });

  it("list() returns messages for a specific worker", async () => {
    await mailbox.send("leader", "worker-1", "msg1");
    await mailbox.send("leader", "worker-2", "msg2");
    await mailbox.send("worker-1", "worker-1", "msg3");

    const w1Messages = mailbox.list("worker-1");
    expect(w1Messages).toHaveLength(2);
    expect(w1Messages.every((m) => m.to === "worker-1")).toBe(true);
  });

  it("broadcast() sends to all and shows in every worker list", async () => {
    const msg = await mailbox.broadcast("leader", "announcement");

    expect(msg.to).toBe("all");

    const w1 = mailbox.list("worker-1");
    const w2 = mailbox.list("worker-2");
    expect(w1).toHaveLength(1);
    expect(w2).toHaveLength(1);
    expect(w1[0].body).toBe("announcement");
  });

  it("markDelivered() updates message status", async () => {
    const msg = await mailbox.send("leader", "worker-1", "test");

    await mailbox.markDelivered(msg.id);

    const messages = mailbox.allMessages();
    const updated = messages.find((m) => m.id === msg.id);
    expect(updated?.status).toBe("delivered");
  });

  it("markRead() updates message status", async () => {
    const msg = await mailbox.send("leader", "worker-1", "test");

    await mailbox.markRead(msg.id);

    const messages = mailbox.allMessages();
    const updated = messages.find((m) => m.id === msg.id);
    expect(updated?.status).toBe("read");
  });

  it("allMessages() returns a copy of all messages", async () => {
    await mailbox.send("a", "b", "1");
    await mailbox.send("c", "d", "2");

    const all = mailbox.allMessages();
    expect(all).toHaveLength(2);
  });

  it("persists and reloads from disk", async () => {
    await mailbox.send("leader", "worker-1", "persist-test");

    const mailbox2 = new Mailbox(teamDir);
    await mailbox2.load();

    expect(mailbox2.allMessages()).toHaveLength(1);
    expect(mailbox2.allMessages()[0].body).toBe("persist-test");
  });
});
