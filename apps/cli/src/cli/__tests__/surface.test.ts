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

  it("keeps platform lifecycle aliases consistent", () => {
    const program = createProgram();
    const platform = program.commands.find((command) => command.name() === "platform");

    expect(platform).toBeDefined();

    const aliasesByCommand = Object.fromEntries(
      platform!.commands.map((command) => [command.name(), command.aliases()]),
    );

    expect(aliasesByCommand).toMatchObject({
      generate: ["g"],
      plugin: ["p"],
      install: ["i"],
      where: ["w"],
      status: ["s"],
      update: ["u"],
      uninstall: ["remove"],
      repair: ["fix"],
      doctor: ["check"],
    });
  });

  it("keeps platform target selector options aligned", () => {
    const program = createProgram();
    const platform = program.commands.find((command) => command.name() === "platform");

    expect(platform).toBeDefined();

    const optionFlagsByCommand = Object.fromEntries(
      platform!.commands.map((command) => [
        command.name(),
        command.options.map((option) => option.flags),
      ]),
    );

    for (const commandName of [
      "generate",
      "plugin",
      "install",
      "where",
      "status",
      "update",
      "uninstall",
      "repair",
      "doctor",
    ]) {
      expect(optionFlagsByCommand[commandName]?.slice(0, 3)).toEqual([
        "-d, --dir <dir>",
        "-p, --project",
        "-g, --global",
      ]);
    }

    expect(optionFlagsByCommand.generate).toEqual([
      "-d, --dir <dir>",
      "-p, --project",
      "-g, --global",
      "-b, --bundle <type>",
      "--plan",
      "-j, --json",
      "-f, --force",
    ]);
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
