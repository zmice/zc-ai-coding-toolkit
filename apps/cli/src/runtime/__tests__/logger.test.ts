import { describe, it, expect } from "vitest";
import { Logger } from "../logger.js";

describe("Logger", () => {
  it("creates an instance with logging methods", () => {
    const logger = new Logger();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });
});
