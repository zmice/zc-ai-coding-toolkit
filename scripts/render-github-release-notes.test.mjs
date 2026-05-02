import test from "node:test";
import assert from "node:assert/strict";
import {
  findPreviousReleaseTag,
  parseCommitSubject,
  renderNotes
} from "./render-github-release-notes.mjs";

test("findPreviousReleaseTag returns the previous @zmice/zc version", () => {
  assert.equal(
    findPreviousReleaseTag("@zmice/zc@0.2.6", [
      "@zmice/zc@0.2.0",
      "@zmice/zc@0.2.5",
      "@zmice/zc@0.2.6"
    ]),
    "@zmice/zc@0.2.5"
  );
});

test("findPreviousReleaseTag handles a tag that is not created yet", () => {
  assert.equal(
    findPreviousReleaseTag("@zmice/zc@0.2.6", ["@zmice/zc@0.2.4", "@zmice/zc@0.2.5"]),
    "@zmice/zc@0.2.5"
  );
});

test("parseCommitSubject extracts conventional commit type and scope", () => {
  assert.deepEqual(parseCommitSubject("docs(toolkit): 精炼 skills 渐进式披露结构"), {
    type: "docs",
    scope: "toolkit",
    summary: "精炼 skills 渐进式披露结构"
  });
});

test("renderNotes groups release changes and uses compare links", () => {
  const notes = renderNotes({
    tag: "@zmice/zc@0.2.6",
    version: "0.2.6",
    previousTag: "@zmice/zc@0.2.5",
    commits: [
      parseCommitSubject("feat: 优化 Codex 平台插件命令体验"),
      parseCommitSubject("docs(toolkit): 精炼剩余大体量 skills"),
      parseCommitSubject("chore: 新增内容上下文预算审计")
    ]
  });

  assert.match(notes, /### 新增能力/);
  assert.match(notes, /优化 Codex 平台插件命令体验/);
  assert.match(notes, /### 文档与内容/);
  assert.match(notes, /\*\*toolkit\*\*: 精炼剩余大体量 skills/);
  assert.match(notes, /### 工程维护/);
  assert.match(notes, /compare\/@zmice\/zc@0.2.5\.\.\.@zmice\/zc@0.2.6/);
});
