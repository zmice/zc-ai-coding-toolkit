import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger, createLogger } from "../logger.js";
import type { LogLevel } from "../logger.js";

describe("Logger", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;
  const origLevel = process.env["ZC_LOG_LEVEL"];

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    delete process.env["ZC_LOG_LEVEL"];
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (origLevel === undefined) delete process.env["ZC_LOG_LEVEL"];
    else process.env["ZC_LOG_LEVEL"] = origLevel;
  });

  it("createLogger returns a Logger instance", () => {
    const logger = createLogger("test");
    expect(logger).toBeInstanceOf(Logger);
  });

  it("info() outputs to stderr with correct format", () => {
    const logger = createLogger("my-module");
    logger.info("hello world");

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/);
    expect(output).toContain("[INFO ]");
    expect(output).toContain("[my-module]");
    expect(output).toContain("hello world");
  });

  it("debug() is suppressed at default level (info)", () => {
    const logger = createLogger("test");
    logger.debug("should not appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("debug() outputs when ZC_LOG_LEVEL=debug", () => {
    process.env["ZC_LOG_LEVEL"] = "debug";
    const logger = createLogger("test");
    logger.debug("visible");
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain("[DEBUG]");
  });

  it("warn() and error() always output at default level", () => {
    const logger = createLogger("test");
    logger.warn("warning");
    logger.error("error");
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it("respects ZC_LOG_LEVEL=error (suppresses info and warn)", () => {
    process.env["ZC_LOG_LEVEL"] = "error";
    const logger = createLogger("test");
    logger.info("suppressed");
    logger.warn("suppressed");
    logger.error("visible");
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });
});
