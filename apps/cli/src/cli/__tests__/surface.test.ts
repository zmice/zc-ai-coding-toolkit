import { describe, expect, it } from "vitest";
import { createProgram } from "../index.js";

describe("zc command surface", () => {
  it("does not expose legacy runtime or setup commands", () => {
    const program = createProgram();
    const names = program.commands.map((command) => command.name());

    expect(names).toContain("run");
    expect(names).toContain("team");
    expect(names).toContain("toolkit");
    expect(names).toContain("platform");
    expect(names).not.toContain("runtime");
    expect(names).not.toContain("setup");
  });
});
