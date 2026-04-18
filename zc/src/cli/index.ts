#!/usr/bin/env node
import { Command } from "commander";
import { registerTeamCommand } from "./team.js";
import { registerTaskCommand } from "./task.js";
import { registerMsgCommand } from "./msg.js";
import { registerDoctorCommand } from "./doctor.js";
import { registerSetupCommand } from "./setup.js";
import { registerRunCommand } from "./run.js";

const program = new Command();

program
  .name("zc")
  .description("多 AI CLI 团队编排运行时 — 让 Codex、Qwen Code 等工具组队并行开发")
  .version("0.1.0");

// Register subcommands
registerTeamCommand(program);
registerTaskCommand(program);
registerMsgCommand(program);
registerDoctorCommand(program);
registerSetupCommand(program);
registerRunCommand(program);

program.parse();
