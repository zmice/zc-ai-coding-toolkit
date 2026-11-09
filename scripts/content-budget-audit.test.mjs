import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditSkillCatalog } from "./lib/skill-catalog-audit.mjs";

const skill = (name, description, body = "正文") => ({
  path: `skills/${name}/SKILL.md`,
  content: `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n${body}\n`,
});

test("measures metadata separately from selected body and supporting files", () => {
  const result = auditSkillCatalog([
    skill("review", "审查代码😀", "正文"),
    { path: "skills/review/references/details.md", content: "not loaded initially" },
  ], { namespace: "zc-toolkit", pathPrefix: "C:/long path/plugin" });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].name, "zc-toolkit:review");
  assert.ok(result.entries[0].path.startsWith("C:/long path/plugin/"));
  assert.ok(result.bytes > result.chars);
  assert.equal(result.entries[0].bodyBytes, Buffer.byteLength("正文\n"));
  assert.equal(result.budgetChars, null);
  assert.equal(result.exceedsBudget, false);
});

test("reports simulated truncation collisions and budget overflow", () => {
  const result = auditSkillCatalog([skill("a", "审查代码"), skill("b", "审查界面")], {
    descriptionChars: 2, budgetChars: 1,
  });
  assert.equal(result.exceedsBudget, true);
  assert.equal(result.truncatedDescriptions, 2);
  assert.deepEqual(result.prefixCollisions, [{ prefix: "审查", names: ["a", "b"] }]);
  assert.deepEqual(result.overBudgetEntries, ["a", "b"]);
});

test("description omission and unicode truncation are explicit", () => {
  const result = auditSkillCatalog([skill("a", "😀设计")], { descriptionChars: 1 });
  assert.equal(result.entries[0].description, "😀");
  const omitted = auditSkillCatalog([skill("a", "设计")], { omitDescriptions: true });
  assert.equal(omitted.entries[0].description, "");
  assert.deepEqual(omitted.prefixCollisions, []);
  assert.equal(omitted.descriptionMode, "omitted");
});

test("rejects invalid budgets instead of claiming a valid audit", () => {
  assert.throws(() => auditSkillCatalog([], { budgetChars: -1 }), /budgetChars/);
  assert.throws(() => auditSkillCatalog([], { descriptionChars: 1.5 }), /descriptionChars/);
  assert.throws(() => auditSkillCatalog([{ path: "skills/a/SKILL.md", content: "missing header" }]), /frontmatter/);
});

test("audits actual generated platform plans without counting supporting references as skills", () => {
  const result = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(new URL("./content-budget-audit.mjs", import.meta.url)), "--json",
  ], { encoding: "utf8", timeout: 60000 }));
  for (const platform of result.platforms) {
    const entries = platform.initialCatalog.entries;
    if (platform.platform === "claude") {
      // This adapter currently distributes commands and agents, not SKILL.md assets.
      assert.equal(entries.length, 0);
    } else {
      assert.ok(entries.length > 0, platform.platform);
      assert.ok(entries.some((entry) => entry.name.endsWith("code-review-and-quality")));
      assert.ok(entries.every((entry) => entry.path.endsWith("/SKILL.md") && !entry.path.includes("/references/")));
    }
  }
  const codex = result.platforms.find((entry) => entry.platform === "codex");
  assert.ok(codex.initialCatalog.entries.some((entry) => entry.name === "zc-start"));
});

test("plugin catalog includes the namespace and user-supplied installed path prefix", () => {
  const result = JSON.parse(execFileSync(process.execPath, [
    fileURLToPath(new URL("./content-budget-audit.mjs", import.meta.url)), "--json", "--codex-plugin",
    "--catalog-path-prefix", "C:/example/plugin",
  ], { encoding: "utf8", timeout: 60000 }));
  assert.equal(result.codexLayout, "plugin");
  const catalog = result.platforms.find((entry) => entry.platform === "codex").initialCatalog;
  assert.ok(catalog.entries.some((entry) => entry.name === "zc-toolkit:start" && entry.path === "C:/example/plugin/skills/start/SKILL.md"));
});
