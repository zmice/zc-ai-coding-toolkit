import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const adaptersMock = vi.hoisted(() => ({
  getAdapter: vi.fn(),
  listAdapters: vi.fn(),
}));

vi.mock("../../adapters/index.js", () => adaptersMock);

import { createProgram } from "../index.js";
import { executeRun } from "../run.js";

describe("CLI 中文化", () => {
  beforeEach(() => {
    adaptersMock.getAdapter.mockReset();
    adaptersMock.listAdapters.mockReset();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("在根帮助中保留中文说明", () => {
    const help = createProgram().helpInformation();

    expect(help).toContain("多 AI CLI 团队编排运行时");
    expect(help).toContain("团队编排命令");
    expect(help).toContain("启动单个 CLI 工人执行任务");
  });

  it("用中文提示未知的 run 适配器", async () => {
    adaptersMock.getAdapter.mockReturnValue(undefined);
    adaptersMock.listAdapters.mockReturnValue(["codex", "qwen-code"]);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await executeRun("hello", { cli: "foo", workdir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(
      '[zc run] 错误：未知的 CLI 适配器 "foo"。可用适配器：codex, qwen-code',
    );
    expect(process.exitCode).toBe(1);
  });

  it("用中文提示 run 目标未安装或不可用", async () => {
    adaptersMock.getAdapter.mockReturnValue({
      detect: vi.fn().mockResolvedValue(false),
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await executeRun(undefined, { cli: "codex", workdir: process.cwd() });

    expect(errorSpy).toHaveBeenCalledWith(
      '[zc run] 错误：未检测到 "codex" CLI 或它当前不可用。请先安装后重试。',
    );
    expect(process.exitCode).toBe(1);
  });
});
