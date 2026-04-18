import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface MailMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: string;
  status: "pending" | "read";
}

interface StoredMailbox {
  messages: MailMessage[];
}

export class Mailbox {
  private messages: MailMessage[] = [];
  private nextId = 1;

  constructor(private readonly teamDir: string) {}

  private get path(): string {
    return join(this.teamDir, "mailbox.json");
  }

  async load(): Promise<void> {
    await mkdir(this.teamDir, { recursive: true });
    try {
      const raw = await readFile(this.path, "utf-8");
      const data = JSON.parse(raw) as StoredMailbox;
      this.messages = data.messages ?? [];
      this.nextId = this.messages.length + 1;
    } catch {
      this.messages = [];
      this.nextId = 1;
      await this.persist();
    }
  }

  async send(from: string, to: string, body: string): Promise<MailMessage> {
    const message: MailMessage = {
      id: `msg-${this.nextId++}`,
      from,
      to,
      body,
      timestamp: new Date().toISOString(),
      status: "pending",
    };
    this.messages.push(message);
    await this.persist();
    return message;
  }

  async broadcast(from: string, body: string): Promise<MailMessage> {
    return this.send(from, "all", body);
  }

  list(workerId: string): MailMessage[] {
    return this.messages.filter((msg) => msg.to === workerId || msg.to === "all");
  }

  allMessages(): MailMessage[] {
    return [...this.messages];
  }

  async markRead(id: string): Promise<MailMessage> {
    const message = this.messages.find((msg) => msg.id === id);
    if (!message) {
      throw new Error(`Message ${id} not found`);
    }
    message.status = "read";
    await this.persist();
    return message;
  }

  async markDelivered(id: string): Promise<MailMessage> {
    return this.markRead(id);
  }

  private async persist(): Promise<void> {
    await writeFile(this.path, JSON.stringify({ messages: this.messages }, null, 2), "utf-8");
  }
}
