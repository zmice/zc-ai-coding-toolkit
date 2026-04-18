#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { registerTeamCommand } from "./team.js";
import { registerTaskCommand } from "./task.js";
import { registerMsgCommand } from "./msg.js";
import { registerDoctorCommand } from "./doctor.js";
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

export function createProgram(): Command {
  const program = new Command();

  program
    .name("zc")
    .description("AI Coding Toolkit 统一入口 CLI — 运行 runtime、查询 toolkit、安装平台内容")
    .version(getCliVersion());

  registerTeamCommand(program);
  registerTaskCommand(program);
  registerMsgCommand(program);
  registerDoctorCommand(program);
  registerRunCommand(program);

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
