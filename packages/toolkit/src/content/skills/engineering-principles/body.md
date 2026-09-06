在进入规格、实现、审查和验证前，先用这组原则校准工作方式。它不替代具体 skill，而是作为轻量原则层，约束这些 skill 的执行风格和判断边界。

## 何时使用

- 任务开始时，需要先统一执行方式
- 实现复杂度开始膨胀，出现过度设计倾向
- 调试或重构过程中，开始偏离最初目标
- 准备宣称完成，但缺少可验证证据

## 核心原则

1. 先澄清假设
   先从用户要求和现有证据确定输入、约束、授权及完成条件。低风险未知项可验证或声明假设后继续；澄清不等于必须先向用户提问。

2. 疑点优先收敛
   遇到相互矛盾、会改变架构或会影响数据安全的疑点时，先提出具体问题；低风险疑点可以声明假设后继续推进。

3. 简单优先
   先理解真实流程，再依次判断：当前需求是否必须存在、仓库是否已有可复用能力、标准库或平台原生能力是否满足、已安装依赖是否满足，最后才写最小自定义实现。只有前一级不满足，才升级复杂度。
   简单不得删减显式需求、信任边界验证、数据保护、安全、无障碍和与风险相称的验证。

4. 外科式修改
   只改完成目标所需的最小范围，不顺手扩散、不借题发挥。

5. 目标导向
   每一步都要能回答“这一步为什么必要，它离目标更近了什么”。

6. 证据先于断言
   结论必须建立在测试、构建、检查或运行结果上，而不是感觉。

7. 发布后不允许失控漂移
   已发布行为、文档、门禁和回归基线发生变化时，必须有明确校验与同步动作，不能默认“上线后自然会对齐”。

## 原则落点

| 原则 | 主要落点 |
| --- | --- |
| 疑点优先收敛 | `spec-driven-development`、`planning-and-task-breakdown`、`debugging-and-error-recovery` |
| 证据先于断言 | `verification-before-completion`、`ci-cd-and-automation`、`browser-qa-testing` |
| 复杂任务谨慎优先于求快 | `verification-before-completion`、`context-engineering` |
| 简单优先 | `ci-cd-and-automation`、`browser-qa-testing`、`context-engineering` |
| 外科式修改 | `ci-cd-and-automation`、`context-engineering` |
| 目标导向 | `verification-before-completion`、`context-engineering` |
| 发布后不允许失控漂移 | `ci-cd-and-automation` |

## 执行检查清单

- 我是否明确了当前目标和不做什么
- 我是否把会改变路线的疑点变成了问题或显式假设
- 这次改动是否是当前问题的最小可行解
- 是否先检查了现有实现、标准库、平台原生能力和已有依赖
- 新增依赖、抽象、配置或扩展点是否有当前证据，而不是未来猜测
- 是否引入了与目标无关的抽象、重命名或结构变动
- 是否保留了足够的验证证据来支撑最终结论
- 如果变更已发布，是否明确了发布后需要持续校验的门禁、基线或文档同步点

## 与其他技能的衔接

- 在 `spec-driven-development` 前使用，用来约束需求澄清方式
- 在 `incremental-implementation` 和 `test-driven-development` 中使用，用来限制改动半径和复杂度
- 在 `verification-before-completion` 中使用，用来提醒结论必须落到证据
- 在 `ci-cd-and-automation`、`browser-qa-testing`、`context-engineering` 中使用，用来把原则变成可执行门禁
