#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { registerTeamCommand } from "./team.js";
import { registerTaskCommand } from "./task.js";
import { registerMsgCommand } from "./msg.js";
import { registerDoctorCommand } from "./doctor.js";
import { registerSetupCommand } from "./setup.js";
import { registerRunCommand } from "./run.js";
import { registerToolkitCommand } from "./toolkit.js";
import { registerPlatformCommand } from "./platform.js";

function getCliVersion(): string {
  const packageJsonPath = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    version?: string;
  };
  return packageJson.version ?? "0.0.0";
}

function registerPlannedNamespace(program: Command, name: string, description: string): Command {
  const namespace = program.command(name).description(description);
  namespace.action(() => {
    namespace.outputHelp();
  });
  return namespace;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("zc")
    .description("多 AI CLI 团队编排运行时 — 让 Codex、Qwen Code 等工具组队并行开发")
    .version(getCliVersion());

  // Current surface
  registerTeamCommand(program);
  registerTaskCommand(program);
  registerMsgCommand(program);
  registerDoctorCommand(program);
  registerSetupCommand(program);
  registerRunCommand(program);

  // Future namespace scaffold
  const runtime = registerPlannedNamespace(program, "runtime", "运行时命令命名空间");
  registerRunCommand(runtime);
  registerTeamCommand(runtime);
  registerTaskCommand(runtime);
  registerMsgCommand(runtime);
  registerDoctorCommand(runtime);
  registerSetupCommand(runtime);

  registerToolkitCommand(program);
  registerPlatformCommand(program);

  return program;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return pathToFileURL(entry).href === import.meta.url;
}

if (isDirectExecution()) {
  createProgram().parse();
}
