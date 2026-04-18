import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createProgram, isDirectExecution } from "../index.js";

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

  it("treats a symlinked bin path as direct execution", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "zc-symlink-"));
    const target = join(tempRoot, "index.js");
    const linkPath = join(tempRoot, "zc");

    writeFileSync(target, "console.log('zc');\n", "utf8");
    symlinkSync(target, linkPath);

    expect(isDirectExecution(linkPath, pathToFileURL(target).href)).toBe(true);
  });
});
