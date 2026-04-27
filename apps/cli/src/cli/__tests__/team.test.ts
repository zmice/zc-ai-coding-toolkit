import { describe, expect, it, vi, afterEach } from "vitest";
import { createProgram } from "../index.js";

describe("team CLI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("prints a dry-run team plan without starting runtime", async () => {
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });

    const program = createProgram();
    await program.parseAsync([
      "node",
      "zc",
      "team",
      "plan",
      "--tasks",
      "API | files=src/api.ts",
      "UI | files=src/ui.ts",
      "--json",
    ]);

    const plan = JSON.parse(output.join("\n")) as { canStart: boolean; tasks: unknown[] };
    expect(plan.canStart).toBe(true);
    expect(plan.tasks).toHaveLength(2);
  });
});
