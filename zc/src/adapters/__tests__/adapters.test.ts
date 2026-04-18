import { describe, it, expect, beforeEach } from "vitest";
import { CodexAdapter } from "../codex.js";
import { QwenCodeAdapter } from "../qwen-code.js";
import { registerAdapter, getAdapter, listAdapters } from "../types.js";

describe("CodexAdapter", () => {
  it("should instantiate with correct name", () => {
    const adapter = new CodexAdapter();
    expect(adapter.name).toBe("codex");
  });

  it("detect() should return a boolean", async () => {
    const adapter = new CodexAdapter();
    const result = await adapter.detect();
    expect(typeof result).toBe("boolean");
  });

  it("version() should return a non-empty string", async () => {
    const adapter = new CodexAdapter();
    const result = await adapter.version();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("healthCheck() should return a boolean", async () => {
    const adapter = new CodexAdapter();
    const result = await adapter.healthCheck();
    expect(typeof result).toBe("boolean");
  });

  it("query() method should exist", () => {
    const adapter = new CodexAdapter();
    expect(typeof adapter.query).toBe("function");
  });
});

describe("QwenCodeAdapter", () => {
  it("should instantiate with correct name", () => {
    const adapter = new QwenCodeAdapter();
    expect(adapter.name).toBe("qwen-code");
  });

  it("detect() should return a boolean", async () => {
    const adapter = new QwenCodeAdapter();
    const result = await adapter.detect();
    expect(typeof result).toBe("boolean");
  });

  it("version() should return a non-empty string", async () => {
    const adapter = new QwenCodeAdapter();
    const result = await adapter.version();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("healthCheck() should return a boolean", async () => {
    const adapter = new QwenCodeAdapter();
    const result = await adapter.healthCheck();
    expect(typeof result).toBe("boolean");
  });

  it("query() method should exist", () => {
    const adapter = new QwenCodeAdapter();
    expect(typeof adapter.query).toBe("function");
  });
});

describe("Adapter Registry", () => {
  beforeEach(() => {
    // Register fresh adapters for each test
    registerAdapter(new CodexAdapter());
    registerAdapter(new QwenCodeAdapter());
  });

  it("getAdapter() should return registered adapter by name", () => {
    const codex = getAdapter("codex");
    expect(codex).toBeDefined();
    expect(codex?.name).toBe("codex");

    const qwen = getAdapter("qwen-code");
    expect(qwen).toBeDefined();
    expect(qwen?.name).toBe("qwen-code");
  });

  it("getAdapter() should return undefined for unknown adapter", () => {
    const result = getAdapter("unknown-adapter");
    expect(result).toBeUndefined();
  });

  it("listAdapters() should return all registered adapter names", () => {
    const names = listAdapters();
    expect(names).toContain("codex");
    expect(names).toContain("qwen-code");
  });
});
