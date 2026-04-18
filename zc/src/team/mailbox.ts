import { randomUUID } from "node:crypto";
import { readJson, writeJson } from "../runtime/state.js";

export interface Message {
  id: string;
  from: string;
  to: string;       // worker ID 或 "all" 表示广播
  body: string;
  timestamp: string;
  status: "pending" | "delivered" | "read";
}

export class Mailbox {
  private messages: Message[] = [];
  private filePath: string;

  constructor(teamDir: string) {
    this.filePath = `${teamDir}/mailbox.json`;
  }

  async load(): Promise<void> {
    this.messages = await readJson<Message[]>(this.filePath, []);
  }

  private async save(): Promise<void> {
    await writeJson(this.filePath, this.messages);
  }

  async send(from: string, to: string, body: string): Promise<Message> {
    const msg: Message = {
      id: randomUUID().slice(0, 8),
      from,
      to,
      body,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    this.messages.push(msg);
    await this.save();
    return msg;
  }

  async broadcast(from: string, body: string): Promise<Message> {
    return this.send(from, "all", body);
  }

  list(workerId: string): Message[] {
    return this.messages.filter(
      (m) => m.to === workerId || m.to === "all"
    );
  }

  async markDelivered(msgId: string): Promise<void> {
    const msg = this.messages.find((m) => m.id === msgId);
    if (msg) {
      msg.status = "delivered";
      await this.save();
    }
  }

  async markRead(msgId: string): Promise<void> {
    const msg = this.messages.find((m) => m.id === msgId);
    if (msg) {
      msg.status = "read";
      await this.save();
    }
  }

  allMessages(): Message[] {
    return [...this.messages];
  }
}
