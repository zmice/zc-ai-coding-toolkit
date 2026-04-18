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

function getCliVersion(): string {
  const packageJsonPath = new URL("../../package.json", import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
    version?: string;
  };
  return packageJson.version ?? "0.0.0";
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name("zc")
    .description("多 AI CLI 团队编排运行时 — 让 Codex、Qwen Code 等工具组队并行开发")
    .version(getCliVersion());

  // Register subcommands
  registerTeamCommand(program);
  registerTaskCommand(program);
  registerMsgCommand(program);
  registerDoctorCommand(program);
  registerSetupCommand(program);
  registerRunCommand(program);

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
