import { describe, expect, it } from "vitest";
import { createTeamPlan, parseTeamTaskDescriptors } from "../planner.js";

describe("team planner", () => {
  it("detects file conflicts and blocks unsafe parallel starts", () => {
    const tasks = parseTeamTaskDescriptors([
      "API work | files=src/api.ts,src/shared.ts",
      "UI work | files=src/shared.ts,src/ui.ts",
    ]);

    const plan = createTeamPlan(tasks, 2);

    expect(plan.canStart).toBe(false);
    expect(plan.blockers).toContain("file-conflicts");
    expect(plan.conflicts).toEqual([
      { file: "src/shared.ts", tasks: ["task-1", "task-2"] },
    ]);
  });

  it("builds dependency batches and blocks blind parallel dependency starts", () => {
    const tasks = parseTeamTaskDescriptors([
      "Schema | files=src/schema.ts",
      "API | files=src/api.ts | deps=task-1",
    ]);

    const plan = createTeamPlan(tasks, 2);

    expect(plan.canStart).toBe(false);
    expect(plan.blockers).toContain("dependencies-present");
    expect(plan.batches).toEqual([["task-1"], ["task-2"]]);
  });

  it("allows scoped independent tasks", () => {
    const tasks = parseTeamTaskDescriptors([
      "API | files=src/api.ts",
      "UI | files=src/ui.ts",
    ]);

    const plan = createTeamPlan(tasks, 2);

    expect(plan.canStart).toBe(true);
    expect(plan.recommendedWorkers).toBe(2);
  });

  it("marks team runtime as requiring worktree isolation even for one task", () => {
    const tasks = parseTeamTaskDescriptors([
      "Docs | files=docs/usage-guide.md",
    ]);

    const plan = createTeamPlan(tasks, 1);

    expect(plan.requiresWorktree).toBe(true);
  });
});
