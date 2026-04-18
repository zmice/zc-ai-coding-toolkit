# 规格驱动开发

## 概览

在写任何代码之前先写结构化规格。规格是你和人类工程师之间的共同事实来源，它定义我们要做什么、为什么做，以及如何判断完成。没有规格就写代码，本质上是在猜。

## 何时使用

- 启动新项目或新功能
- 需求不完整或存在歧义
- 变更会影响多个文件或模块
- 准备做架构决策
- 任务预计超过 30 分钟

**不适用的情况：** 单行修复、拼写修正，或需求明确且完全自包含的改动。

## 门控式工作流

规格驱动开发有四个阶段。只有当前阶段被验证后，才能进入下一阶段。

```
SPECIFY ──→ PLAN ──→ TASKS ──→ IMPLEMENT
   │          │        │          │
   ▼          ▼        ▼          ▼
 Human      Human    Human      Human
 reviews    reviews  reviews    reviews
```

### 第 1 阶段：Specify

从高层愿景开始。持续向人类提出澄清问题，直到需求足够具体。

**先显式说明假设。** 在写任何规格内容之前，先列出你正在假设的内容：

```
ASSUMPTIONS I'M MAKING:
1. This is a web application (not native mobile)
2. Authentication uses session-based cookies (not JWT)
3. The database is PostgreSQL (based on existing Prisma schema)
4. We're targeting modern browsers only (no IE11)
→ Correct me now or I'll proceed with these.
```

不要悄悄补全歧义。规格的目的就是在写代码前暴露误解，而假设是最危险的误解形式。

**编写规格时覆盖以下六个核心部分：**

1. **Objective** — 我们在构建什么，为什么构建？谁是用户？成功长什么样？

2. **Commands** — 提供完整可执行命令，包含参数，而不只是工具名称。
   ```
   Build: npm run build
   Test: npm test -- --coverage
   Lint: npm run lint --fix
   Dev: npm run dev
   ```

3. **Project Structure** — 源码在哪里、测试放哪里、文档放哪里。
   ```
   src/           → Application source code
   src/components → React components
   src/lib        → Shared utilities
   tests/         → Unit and integration tests
   e2e/           → End-to-end tests
   docs/          → Documentation
   ```

4. **Code Style** — 一个真实代码片段比三段描述更有效。要包含命名约定、格式规则和良好示例。

5. **Testing Strategy** — 使用什么框架、测试放在哪里、覆盖率期望、哪些场景用哪些测试层级。

6. **Boundaries** — 三层边界系统：
   - **Always do:** 提交前跑测试、遵守命名约定、验证输入
   - **Ask first:** 数据库 schema 变更、添加依赖、修改 CI 配置
   - **Never do:** 提交密钥、编辑 vendor 目录、未经批准移除失败测试

**规格模板：**

```markdown
# Spec: [Project/Feature Name]

## Objective
[What we're building and why. User stories or acceptance criteria.]

## Tech Stack
[Framework, language, key dependencies with versions]

## Commands
[Build, test, lint, dev — full commands]

## Project Structure
[Directory layout with descriptions]

## Code Style
[Example snippet + key conventions]

## Testing Strategy
[Framework, test locations, coverage requirements, test levels]

## Boundaries
- Always: [...]
- Ask first: [...]
- Never: [...]

## Success Criteria
[How we'll know this is done — specific, testable conditions]

## Open Questions
[Anything unresolved that needs human input]
```

**把指令重写为成功标准。** 当需求模糊时，把它翻译成具体、可验证的完成条件：

```
REQUIREMENT: "Make the dashboard faster"

REFRAMED SUCCESS CRITERIA:
- Dashboard LCP < 2.5s on 4G connection
- Initial data load completes in < 500ms
- No layout shift during load (CLS < 0.1)
→ Are these the right targets?
```

这样你才能持续迭代、重试和解决问题，而不是猜测“更快”到底意味着什么。

### 第 2 阶段：Plan

在规格被验证后，生成技术实施计划：

1. 识别主要组件及其依赖关系
2. 确定实现顺序（什么必须先做）
3. 标注风险和缓解策略
4. 区分哪些可以并行，哪些必须串行
5. 定义阶段之间的验证检查点

计划应该是可审阅的：人类读完后应当能够说“对，这就是正确的方案”或者“不是，改这里”。

### 第 3 阶段：Tasks

把计划拆成离散、可实施的任务：

- 每个任务都应能在一次专注会话中完成
- 每个任务都必须有明确的验收标准
- 每个任务都必须包含验证步骤（测试、构建、人工检查）
- 任务排序按依赖关系，而不是按“看起来重要”
- 单个任务不应需要修改超过约 5 个文件

**任务模板：**
```markdown
- [ ] Task: [Description]
  - Acceptance: [What must be true when done]
  - Verify: [How to confirm — test command, build, manual check]
  - Files: [Which files will be touched]
```

### 第 4 阶段：Implement

按照 `incremental-implementation` 和 `test-driven-development` 技能逐个执行任务。加载正确的 spec 章节和源码，而不是把整个 spec 一股脑灌进上下文。

## 让规格保持“活着”

规格不是一次性产物，而是活文档：

- **决策变化时更新** — 如果你发现数据模型需要改变，先更新规格，再实现。
- **范围变化时更新** — 新增或砍掉的功能都要反映到规格里。
- **把规格提交入库** — 规格应和代码一起进入版本控制。
- **在 PR 中引用规格** — 每个 PR 都应能回指到对应的规格章节。

## 常见合理化说辞

| 合理化说辞 | 现实 |
|---|---|
| “这很简单，不需要规格” | 简单任务不需要“长”规格，但仍然需要验收标准。两行规格也可以。 |
| “我先写代码，之后补规格” | 那是文档，不是规格。规格的价值在于先逼你澄清。 |
| “规格会拖慢速度” | 15 分钟的规格能避免 15 小时的返工。 |
| “需求总会变” | 所以规格是活文档。过期规格仍然比没有规格好。 |
| “用户知道自己想要什么” | 即使看似清晰的请求也有隐含假设。规格就是用来把这些假设显性化。 |

## 红旗

- 没有任何书面需求就开始写代码
- 还没搞清楚“完成”是什么意思就问“我直接开始做行吗”
- 实现了规格或任务列表里没提到的功能
- 在没有文档的情况下做架构决策
- 因为“看起来很明显”就跳过规格

## 验证

在进入实现之前，确认：

- [ ] 规格覆盖了全部六个核心部分
- [ ] 人类已经审阅并批准规格
- [ ] 成功标准具体且可测试
- [ ] 边界（Always/Ask First/Never）已定义
- [ ] 规格已保存到仓库中的文件
