在进入规格、实现、审查和验证前，先用这组原则校准工作方式。它不替代具体 skill，而是作为轻量原则层，约束这些 skill 的执行风格和判断边界。

## 何时使用

- 任务开始时，需要先统一执行方式
- 实现复杂度开始膨胀，出现过度设计倾向
- 调试或重构过程中，开始偏离最初目标
- 准备宣称完成，但缺少可验证证据

## 核心原则

1. 先澄清假设
   把输入、约束、风险和未知项说清楚，再进入实现。

2. 简单优先
   先选最直接、最容易验证、最少抽象的方案。

3. 外科式修改
   只改完成目标所需的最小范围，不顺手扩散、不借题发挥。

4. 目标导向
   每一步都要能回答“这一步为什么必要，它离目标更近了什么”。

5. 证据先于断言
   结论必须建立在测试、构建、检查或运行结果上，而不是感觉。

6. 发布后不允许失控漂移
   已发布行为、文档、门禁和回归基线发生变化时，必须有明确校验与同步动作，不能默认“上线后自然会对齐”。

## 原则落点

| 原则 | 主要落点 |
| --- | --- |
| 证据先于断言 | `verification-before-completion`、`ci-cd-and-automation`、`browser-qa-testing` |
| 复杂任务谨慎优先于求快 | `verification-before-completion`、`context-engineering` |
| 简单优先 | `ci-cd-and-automation`、`browser-qa-testing`、`context-engineering` |
| 外科式修改 | `ci-cd-and-automation`、`context-engineering` |
| 目标导向 | `verification-before-completion`、`context-engineering` |
| 发布后不允许失控漂移 | `ci-cd-and-automation` |

## 执行检查清单

- 我是否明确了当前目标和不做什么
- 这次改动是否是当前问题的最小可行解
- 是否引入了与目标无关的抽象、重命名或结构变动
- 是否保留了足够的验证证据来支撑最终结论
- 如果变更已发布，是否明确了发布后需要持续校验的门禁、基线或文档同步点

## 与其他技能的衔接

- 在 `spec-driven-development` 前使用，用来约束需求澄清方式
- 在 `incremental-implementation` 和 `test-driven-development` 中使用，用来限制改动半径和复杂度
- 在 `verification-before-completion` 中使用，用来提醒结论必须落到证据
- 在 `ci-cd-and-automation`、`browser-qa-testing`、`context-engineering` 中使用，用来把原则变成可执行门禁
