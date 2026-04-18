import { readdir, readFile, access } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { CLIAdapter } from "../adapters/types.js";

export interface SkillMeta {
  name: string;
  path: string;
  content: string;
}

export interface CommandMeta {
  name: string;
  path: string;
  content: string;
}

export interface AgentMeta {
  name: string;
  path: string;
  content: string;
}

export const SKILL_KEYWORD_MAP: Record<string, string[]> = {
  "debugging-and-error-recovery": ["调试", "debug", "bug", "错误", "报错", "异常", "排错", "fix"],
  "test-driven-development": ["测试", "test", "tdd", "单测", "用例"],
  "code-review-and-quality": ["审查", "review", "代码审查", "评审", "质量"],
  "performance-optimization": ["性能", "优化", "perf", "慢", "延迟", "卡顿"],
  "security-and-hardening": ["安全", "security", "漏洞", "加固", "xss", "csrf"],
  "code-simplification": ["简化", "重构", "refactor", "简洁", "清理"],
  "spec-driven-development": ["规格", "需求", "spec", "定义"],
  "planning-and-task-breakdown": ["拆解", "计划", "plan", "任务分解"],
  "incremental-implementation": ["实现", "开发", "implement", "编码"],
  "frontend-ui-engineering": ["前端", "ui", "界面", "组件", "页面", "样式"],
  "api-and-interface-design": ["接口", "api", "设计"],
  "documentation-and-adrs": ["文档", "doc", "adr", "记录"],
  "shipping-and-launch": ["发布", "上线", "deploy", "ship"],
  "ci-cd-and-automation": ["ci", "cd", "流水线", "自动化", "pipeline"],
  "deprecation-and-migration": ["迁移", "废弃", "migrate", "升级"],
  "git-workflow-and-versioning": ["git", "提交", "分支", "版本"],
  "safety-guardrails": ["安全护栏", "防护", "guardrail", "锁定"],
  "context-engineering": ["上下文", "context", "窗口"],
  "verification-before-completion": ["验证", "verify", "检查", "确认"],
  "codebase-onboarding": ["入门", "上手", "onboard", "了解代码"],
  "sdd-tdd-workflow": ["sdd", "tdd", "工作流", "开发流程"],
  "continuous-learning": ["学习", "learn", "提炼", "经验"],
  "brainstorming-and-design": ["头脑风暴", "设计", "brainstorm", "创意"],
  "idea-refine": ["想法", "idea", "细化", "构思"],
  "source-driven-development": ["源码驱动", "官方文档", "source"],
  "team-orchestration": ["团队", "编排", "team", "协作"],
  "sprint-retrospective": ["回顾", "retrospective", "sprint", "复盘"],
  "multi-perspective-review": ["多视角", "评审", "perspective"],
};

export interface SkillMatcher {
  match(task: string, skills: SkillMeta[]): SkillMeta[] | Promise<SkillMeta[]>;
}

/**
 * Resolve the project root directory.
 * Root = zc/ parent directory (i.e. path.resolve(__dirname, '../../..'))
 */
function resolveRoot(rootDir?: string): string {
  if (rootDir) return rootDir;
  const thisFile = fileURLToPath(import.meta.url);
  // thisFile is zc/src/utils/skill-loader.ts → go up 3 levels to project root
  return resolve(thisFile, "../../../..");
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan `<rootDir>/skills/` SKILL.md` for all skills.
 */
export async function discoverSkills(rootDir?: string): Promise<SkillMeta[]> {
  const root = resolveRoot(rootDir);
  const skillsDir = join(root, "skills");

  if (!(await dirExists(skillsDir))) return [];

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skills: SkillMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(skillsDir, entry.name, "SKILL.md");
    try {
      const content = await readFile(skillPath, "utf-8");
      skills.push({
        name: entry.name,
        path: skillPath,
        content,
      });
    } catch {
      // SKILL.md not found in this directory, skip
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan `<rootDir>/commands/*.md` for all commands.
 */
export async function discoverCommands(rootDir?: string): Promise<CommandMeta[]> {
  const root = resolveRoot(rootDir);
  const commandsDir = join(root, "commands");

  if (!(await dirExists(commandsDir))) return [];

  const entries = await readdir(commandsDir, { withFileTypes: true });
  const commands: CommandMeta[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const cmdPath = join(commandsDir, entry.name);
    try {
      const content = await readFile(cmdPath, "utf-8");
      commands.push({
        name: basename(entry.name, ".md"),
        path: cmdPath,
        content,
      });
    } catch {
      // skip unreadable files
    }
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan `<rootDir>/agents/*.md` for all agent definitions.
 */
export async function discoverAgents(rootDir?: string): Promise<AgentMeta[]> {
  const root = resolveRoot(rootDir);
  const agentsDir = join(root, "agents");

  if (!(await dirExists(agentsDir))) return [];

  const entries = await readdir(agentsDir, { withFileTypes: true });
  const agents: AgentMeta[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const agentPath = join(agentsDir, entry.name);
    try {
      const content = await readFile(agentPath, "utf-8");
      agents.push({
        name: basename(entry.name, ".md"),
        path: agentPath,
        content,
      });
    } catch {
      // skip unreadable files
    }
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Match skills to a task description using simple keyword matching.
 * Matches skill name segments (split by `-`) against task text.
 */
export function matchSkills(task: string, skills: SkillMeta[]): SkillMeta[] {
  const taskLower = task.toLowerCase();
  const matched: Array<{ skill: SkillMeta; score: number }> = [];

  for (const skill of skills) {
    const keywords = skill.name.split("-").filter((k) => k.length > 2);
    let score = 0;

    // Check full skill name match
    if (taskLower.includes(skill.name)) {
      score += 10;
    }

    // Check individual keyword matches
    for (const kw of keywords) {
      if (taskLower.includes(kw)) {
        score += 1;
      }
    }

    // Check alias matches from SKILL_KEYWORD_MAP
    const aliases = SKILL_KEYWORD_MAP[skill.name];
    if (aliases) {
      for (const alias of aliases) {
        if (taskLower.includes(alias.toLowerCase())) {
          score += 2;
        }
      }
    }

    if (score > 0) {
      matched.push({ skill, score });
    }
  }

  return matched
    .sort((a, b) => b.score - a.score)
    .map((m) => m.skill);
}

export class KeywordSkillMatcher implements SkillMatcher {
  match(task: string, skills: SkillMeta[]): SkillMeta[] {
    return matchSkills(task, skills);
  }
}

export class AISkillMatcher implements SkillMatcher {
  constructor(private adapter: CLIAdapter) {}

  async match(task: string, skills: SkillMeta[]): Promise<SkillMeta[]> {
    if (!this.adapter.query) {
      throw new Error(`Adapter "${this.adapter.name}" does not support query()`);
    }
    const skillList = skills.map(s => `- ${s.name}`).join("\n");
    const prompt = [
      "Given the task and available skills below, select up to 3 most relevant skills.",
      "Return ONLY skill names, one per line, no explanations.",
      "",
      `Task: ${task}`,
      "",
      "Available skills:",
      skillList,
    ].join("\n");

    const response = await this.adapter.query(prompt, { timeout: 15000 });
    const selectedNames = response
      .trim()
      .split("\n")
      .map((s) => s.trim().replace(/^-\s*/, ""))
      .filter(Boolean);

    return selectedNames
      .map((name) => skills.find((s) => s.name === name))
      .filter((s): s is SkillMeta => s !== undefined);
  }
}
