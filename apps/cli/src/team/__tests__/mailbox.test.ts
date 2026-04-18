import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Mailbox } from "../mailbox.js";

describe("Mailbox", () => {
  let teamDir: string;
  let mailbox: Mailbox;

  beforeEach(async () => {
    teamDir = await mkdtemp(join(tmpdir(), "zc-mailbox-"));
    mailbox = new Mailbox(teamDir);
    await mailbox.load();
  });

  afterEach(async () => {
    await rm(teamDir, { recursive: true, force: true }).catch(() => {});
  });

  it("sends and lists messages", async () => {
    await mailbox.send("cli-user", "worker-1", "hello");
    expect(mailbox.list("worker-1")).toHaveLength(1);
  });
});
