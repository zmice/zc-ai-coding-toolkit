import { describe, it, expect, vi } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  discoverSkills,
  discoverCommands,
  discoverAgents,
  matchSkills,
  KeywordSkillMatcher,
  AISkillMatcher,
  SKILL_KEYWORD_MAP,
  type SkillMeta,
  type SkillMatcher,
} from "../skill-loader.js";
import type { CLIAdapter } from "../../adapters/types.js";

// Project root = zc/../ = ai-coding/
const thisFile = fileURLToPath(import.meta.url);
const PROJECT_ROOT = resolve(thisFile, "../../../../..");

describe("discoverSkills", () => {
  it("should discover skills from the project root", async () => {
    const skills = await discoverSkills(PROJECT_ROOT);
    expect(skills.length).toBeGreaterThan(0);

    // Verify structure
    for (const skill of skills) {
      expect(skill.name).toBeTruthy();
      expect(skill.path).toContain("SKILL.md");
      expect(skill.content).toBeTruthy();
    }
  });

  it("should find known skills like sdd-tdd-workflow", async () => {
    const skills = await discoverSkills(PROJECT_ROOT);
    const names = skills.map((s) => s.name);
    expect(names).toContain("sdd-tdd-workflow");
    expect(names).toContain("debugging-and-error-recovery");
  });

  it("should return sorted results", async () => {
    const skills = await discoverSkills(PROJECT_ROOT);
    const names = skills.map((s) => s.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("should return empty array for non-existent directory", async () => {
    const skills = await discoverSkills("/non/existent/path");
    expect(skills).toEqual([]);
  });
});

describe("discoverCommands", () => {
  it("should discover commands from the project root", async () => {
    const commands = await discoverCommands(PROJECT_ROOT);
    expect(commands.length).toBeGreaterThan(0);

    for (const cmd of commands) {
      expect(cmd.name).toBeTruthy();
      expect(cmd.path).toContain(".md");
      expect(cmd.content).toBeTruthy();
    }
  });

  it("should find known commands like commit and debug", async () => {
    const commands = await discoverCommands(PROJECT_ROOT);
    const names = commands.map((c) => c.name);
    expect(names).toContain("commit");
    expect(names).toContain("debug");
  });

  it("should return empty array for non-existent directory", async () => {
    const commands = await discoverCommands("/non/existent/path");
    expect(commands).toEqual([]);
  });
});

describe("discoverAgents", () => {
  it("should discover agents from the project root", async () => {
    const agents = await discoverAgents(PROJECT_ROOT);
    expect(agents.length).toBeGreaterThan(0);

    for (const agent of agents) {
      expect(agent.name).toBeTruthy();
      expect(agent.path).toContain(".md");
      expect(agent.content).toBeTruthy();
    }
  });

  it("should find known agents like architect and code-reviewer", async () => {
    const agents = await discoverAgents(PROJECT_ROOT);
    const names = agents.map((a) => a.name);
    expect(names).toContain("architect");
    expect(names).toContain("code-reviewer");
  });

  it("should return empty array for non-existent directory", async () => {
    const agents = await discoverAgents("/non/existent/path");
    expect(agents).toEqual([]);
  });
});

describe("matchSkills", () => {
  const mockSkills: SkillMeta[] = [
    { name: "debugging-and-error-recovery", path: "/a", content: "debug skill" },
    { name: "test-driven-development", path: "/b", content: "tdd skill" },
    { name: "code-review-and-quality", path: "/c", content: "review skill" },
    { name: "performance-optimization", path: "/d", content: "perf skill" },
    { name: "security-and-hardening", path: "/e", content: "security skill" },
  ];

  it("should match skills by full name", () => {
    const result = matchSkills("use debugging-and-error-recovery", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("debugging-and-error-recovery");
  });

  it("should match skills by keyword", () => {
    const result = matchSkills("fix this bug and debug the error", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((s) => s.name === "debugging-and-error-recovery")).toBe(true);
  });

  it("should match test-related tasks to TDD skill", () => {
    const result = matchSkills("write tests for the module", mockSkills);
    expect(result.some((s) => s.name === "test-driven-development")).toBe(true);
  });

  it("should return empty array for unrelated task", () => {
    const result = matchSkills("make coffee", mockSkills);
    expect(result).toEqual([]);
  });

  it("should rank full name match higher than keyword match", () => {
    const result = matchSkills("apply code-review-and-quality to the PR and review code", mockSkills);
    expect(result[0].name).toBe("code-review-and-quality");
  });
});

describe("matchSkills — Chinese keyword matching", () => {
  const mockSkills: SkillMeta[] = [
    { name: "debugging-and-error-recovery", path: "/a", content: "debug skill" },
    { name: "test-driven-development", path: "/b", content: "tdd skill" },
    { name: "code-review-and-quality", path: "/c", content: "review skill" },
    { name: "performance-optimization", path: "/d", content: "perf skill" },
    { name: "security-and-hardening", path: "/e", content: "security skill" },
  ];

  it("should match Chinese task '修复登录bug' to debugging skill", () => {
    const result = matchSkills("修复登录bug", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "debugging-and-error-recovery")).toBe(true);
  });

  it("should match Chinese task '优化页面加载速度' to performance skill", () => {
    const result = matchSkills("优化页面加载速度", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "performance-optimization")).toBe(true);
  });

  it("should match Chinese task '编写单元测试' to TDD skill", () => {
    const result = matchSkills("编写单元测试", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.name === "test-driven-development")).toBe(true);
  });

  it("should match mixed Chinese+English 'fix 这个性能问题'", () => {
    const result = matchSkills("fix 这个性能问题", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    // Should match both debugging (fix) and performance (性能)
    const names = result.map(s => s.name);
    expect(names).toContain("debugging-and-error-recovery");
    expect(names).toContain("performance-optimization");
  });

  it("should score alias matches higher than single keyword matches", () => {
    // "安全" is an alias (+2) vs "hardening" which is a keyword split (+1)
    const result = matchSkills("安全加固方案", mockSkills);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe("security-and-hardening");
  });
});

describe("KeywordSkillMatcher", () => {
  it("should implement SkillMatcher interface", () => {
    const matcher = new KeywordSkillMatcher();
    expect(typeof matcher.match).toBe("function");
  });

  it("should return same results as matchSkills()", () => {
    const mockSkills: SkillMeta[] = [
      { name: "debugging-and-error-recovery", path: "/a", content: "debug skill" },
    ];
    const matcher = new KeywordSkillMatcher();
    const direct = matchSkills("debug this error", mockSkills);
    const viaClass = matcher.match("debug this error", mockSkills);
    expect(viaClass).toEqual(direct);
  });
});

describe("AISkillMatcher", () => {
  it("should call adapter.query() with formatted prompt", async () => {
    const mockAdapter = {
      name: "test-adapter",
      detect: async () => true,
      version: async () => "1.0",
      spawn: async () => ({ pid: 1, process: {} as any, kill: async () => {} }),
      injectContext: async () => {},
      healthCheck: async () => true,
      query: vi.fn().mockResolvedValue("debugging-and-error-recovery\ntest-driven-development"),
    };

    const mockSkills: SkillMeta[] = [
      { name: "debugging-and-error-recovery", path: "/a", content: "debug skill" },
      { name: "test-driven-development", path: "/b", content: "tdd skill" },
      { name: "performance-optimization", path: "/c", content: "perf skill" },
    ];

    const matcher = new AISkillMatcher(mockAdapter);
    const result = await matcher.match("fix a bug", mockSkills);

    expect(mockAdapter.query).toHaveBeenCalledOnce();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("debugging-and-error-recovery");
    expect(result[1].name).toBe("test-driven-development");
  });

  it("should throw if adapter does not support query()", async () => {
    const mockAdapter = {
      name: "no-query-adapter",
      detect: async () => true,
      version: async () => "1.0",
      spawn: async () => ({ pid: 1, process: {} as any, kill: async () => {} }),
      injectContext: async () => {},
      healthCheck: async () => true,
      // No query method
    };

    const matcher = new AISkillMatcher(mockAdapter as unknown as CLIAdapter);
    await expect(matcher.match("task", [])).rejects.toThrow("does not support query");
  });

  it("should filter out invalid skill names from AI response", async () => {
    const mockAdapter = {
      name: "test-adapter",
      detect: async () => true,
      version: async () => "1.0",
      spawn: async () => ({ pid: 1, process: {} as any, kill: async () => {} }),
      injectContext: async () => {},
      healthCheck: async () => true,
      query: vi.fn().mockResolvedValue("debugging-and-error-recovery\nnon-existent-skill"),
    };

    const mockSkills: SkillMeta[] = [
      { name: "debugging-and-error-recovery", path: "/a", content: "debug" },
    ];

    const matcher = new AISkillMatcher(mockAdapter);
    const result = await matcher.match("fix", mockSkills);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("debugging-and-error-recovery");
  });
});
