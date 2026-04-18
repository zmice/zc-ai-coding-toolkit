import type { Command } from "commander";
import {
  discoverSkills,
  discoverCommands,
  discoverAgents,
} from "../utils/skill-loader.js";

export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("扫描并验证 toolkit 资产")
    .option("-r, --root <dir>", "项目根目录")
    .action(async (opts: { root?: string }) => {
      console.log("\n🔍 扫描项目资产...\n");

      const [skills, commands, agents] = await Promise.all([
        discoverSkills(opts.root),
        discoverCommands(opts.root),
        discoverAgents(opts.root),
      ]);

      // Skills
      console.log(`📦 Skills: ${skills.length} 个`);
      for (const s of skills) {
        console.log(`   ✅ ${s.name}`);
      }

      // Commands
      console.log(`\n📋 Commands: ${commands.length} 个`);
      for (const c of commands) {
        console.log(`   ✅ ${c.name}`);
      }

      // Agents
      console.log(`\n🤖 Agents: ${agents.length} 个`);
      for (const a of agents) {
        console.log(`   ✅ ${a.name}`);
      }

      // Summary
      const total = skills.length + commands.length + agents.length;
      console.log(`\n📊 总计: ${total} 个资产`);

      if (total === 0) {
        console.log("\n⚠️  未发现任何资产，请检查目录结构是否正确");
        console.log("   期望结构: packages/toolkit/src/content/<kind>/<name>/{meta.yaml,body.md,assets/}");
      } else {
        console.log("\n✅ 目录结构验证通过");
      }
    });
}
