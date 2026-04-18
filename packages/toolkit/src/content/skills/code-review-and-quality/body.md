# 代码审查与质量

## 概览

多维度代码审查与质量门控。每个变更在合并前都要经过审查，没有例外。审查覆盖五个维度：正确性、可读性、架构、安全性和性能。

**批准标准：** 当一个变更明确提升了整体代码质量，即使它并不完美，也应当批准。完美代码并不存在，目标是持续改进。不要因为“不是我会写的样子”就阻止一个改进了代码库、并且遵循项目约定的变更。

## 何时使用

- 合并任何 PR 或变更之前
- 完成一次功能实现之后
- 评估你自己、另一个代理或人类写的代码时
- 重构现有代码时
- 任何 bug 修复之后（同时审查修复和回归测试）

## 五轴审查

每次审查都要从以下维度评估：

### 1. 正确性

代码是否真的做到了它声称要做的事？

- 是否符合 spec 或任务要求？
- 边界情况有没有处理（null、空值、边界值、错误路径）？
- 测试是否真的验证了行为？是否测对了东西？
- 是否存在竞态条件、off-by-one 错误或状态不一致？

### 2. 可读性与简洁性

其他工程师（或代理）能否在不被作者解释的情况下看懂？

- 命名是否清晰，并且与项目约定一致？（不要用没有上下文的 `temp`、`data`、`result`）
- 控制流是否直接了当（避免深层嵌套、复杂回调）？
- 代码组织是否合理（相关代码聚合，边界清晰）？
- 有没有过于“聪明”的技巧应该简化？
- **能否用更少的行数完成？** 1000 行才能表达 100 行能说清的内容，就是失败。
- **抽象是否真的值得它的复杂度？** 不要在第三次使用之前就泛化。
- 注释是否有助于解释非显而易见的意图？（不要注释显而易见的代码。）
- 是否存在死代码：未使用变量（`_unused`）、过时兼容层、或 `// removed` 注释？

### 3. 架构

变更是否符合系统设计？

- 是否遵循现有模式？如果引入新模式，是否合理？
- 是否保持了模块边界？
- 是否有应该共享的重复代码？
- 依赖方向是否正确（没有循环依赖）？
- 抽象层级是否合适（不过度工程，也不过度耦合）？

### 4. 安全性

更详细的安全指导见 `security-and-hardening`。这个变更是否引入漏洞？

- 用户输入是否经过验证和清理？
- 密钥是否远离代码、日志和版本控制？
- 是否需要认证/授权的地方都已检查？
- SQL 查询是否使用参数化（没有字符串拼接）？
- 输出是否经过编码以防 XSS？
- 依赖是否来自可信来源且没有已知漏洞？
- 外部来源的数据（API、日志、用户内容、配置文件）是否被当作不可信数据处理？
- 外部数据流是否在系统边界处先验证，再进入逻辑或渲染？

### 5. 性能

更详细的性能分析和优化见 `performance-optimization`。这个变更是否引入性能问题？

- 是否存在 N+1 查询模式？
- 是否存在无界循环或无约束的数据获取？
- 是否有应该异步却同步执行的操作？
- 是否存在不必要的 UI 重渲染？
- 是否缺少列表接口的分页？
- 是否在热点路径中创建了过大的对象？

## 变更规模

小而聚焦的改动更容易审查、更快合并，也更安全。尽量控制在这样的规模：

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

**什么算“一次变更”：** 一个自洽的修改，解决一件事，包含相关测试，并且在提交后系统仍保持可用。它是功能的一部分，不是整个功能。

当变更太大时，可以用这些方式拆分：

| Strategy | How | When |
|----------|-----|------|
| **Stack** | 先提交一个小变更，再基于它做下一步 | 存在顺序依赖 |
| **By file group** | 按需要不同审阅者的文件组拆分 | 跨多个关注面 |
| **Horizontal** | 先做共享代码/桩，再做消费者 | 分层架构 |
| **Vertical** | 按更小的完整功能切片拆分 | 功能开发 |

**把重构和功能工作分开。** 同时重构现有代码又增加新行为，等于做了两件事，应该拆开提交。小的清理（比如变量重命名）可由审阅者酌情接受。

## 变更描述

每个变更都需要一段能独立出现在版本历史中的描述。

**第一行：** 简短、祈使句、可独立理解。比如“Delete the FizzBuzz RPC”，而不是“Deleting the FizzBuzz RPC.”。它必须足够信息化，让人不用看 diff 也能理解大意。

**正文：** 说明改了什么、为什么改。包含代码里看不出来的上下文、决策和理由。若相关，链接到 bug 编号、基准测试结果或设计文档。若方案存在不足，也要明确承认。

**反模式：** “Fix bug”、“Fix build”、“Add patch”、“Moving code from A to B”、“Phase 1”、“Add convenience functions”。

## 审查流程

### 第 1 步：理解上下文

在看代码前，先理解意图：

```
- What is this change trying to accomplish?
- What spec or task does it implement?
- What is the expected behavior change?
```

### 第 2 步：先看测试

测试会暴露意图和覆盖范围：

```
- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?
```

### 第 3 步：审查实现

从五个维度逐个看文件：

```
For each file changed:
1. Correctness: Does this code do what the test says it should?
2. Readability: Can I understand this without help?
3. Architecture: Does this fit the system?
4. Security: Any vulnerabilities?
5. Performance: Any bottlenecks?
```

### 第 4 步：给发现分类

给每条评论标上严重程度，让作者知道哪些必须修，哪些可选：

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | 合并前必须修复 |
| **Critical:** | 阻塞合并 | 安全漏洞、数据丢失、功能损坏 |
| **Nit:** | Minor, optional | 作者可忽略 — 格式、风格偏好 |
| **Optional:** / **Consider:** | Suggestion | 值得考虑，但非必须 |
| **FYI** | Informational only | 无需处理 — 提供后续上下文 |

这样作者不会把所有反馈都当成强制项，也不会在低价值的地方浪费时间。

### 第 5 步：验证“验证”

检查作者的验证故事：

```
- What tests were run?
- Did the build pass?
- Was the change tested manually?
- Are there screenshots for UI changes?
- Is there a before/after comparison?
```

## 多模型审查模式

用不同模型承担不同审查视角：

```
Model A writes the code
    │
    ▼
Model B reviews for correctness and architecture
    │
    ▼
Model A addresses the feedback
    │
    ▼
Human makes the final call
```

这能捕捉单个模型容易漏掉的问题，因为不同模型会有不同盲点。

**给审查代理的示例提示：**
```
Review this code change for correctness, security, and adherence to
our project conventions. The spec says [X]. The change should [Y].
Flag any issues as Critical, Important, or Suggestion.
```

## 死代码治理

在任何重构或实现改动后，检查是否留下了孤儿代码：

1. 找出现在已不可达或未使用的代码
2. 明确列出
3. **删除前先问：**“是否应该移除这些现在已不用的元素：[list]？”

不要把死代码留在仓库里，它会误导后续的读者和代理。但也不要在不确定时悄悄删除。拿不准时，先问。

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard component in src/components/ — replaced by TaskCard
- LEGACY_API_URL constant in src/config.ts — no remaining references
→ Safe to remove these?
```

## 审查速度

慢审查会阻塞整个团队。切换上下文去审查的成本，低于让其他人等待的成本。

- **在一个工作日内响应** — 这是上限，不是目标
- **理想节奏：** 除非你正深度专注，否则应尽快给出反馈。一个典型变更应在同一天完成多轮审查
- **大型变更：** 要求作者拆分，而不是一次审查一个过大的变更集

## 处理分歧

解决审查分歧时，按这个优先级：

1. **技术事实和数据** 高于意见和偏好
2. **风格指南** 是风格问题的绝对权威
3. **软件设计** 必须基于工程原则，而不是个人口味
4. **代码库一致性** 可以接受，只要它不会拖累整体健康

**不要接受“我以后会修”这种说法。** 经验表明，延期清理通常不会发生。审查就是质量门槛——除非是紧急情况，否则应在提交前要求清理，而不是之后。

## 审查中的诚实

当你在审查代码时，不管是自己、另一个代理还是人类写的代码：

- **不要机械盖章。** 没有证据的 “LGTM” 对任何人都没有帮助。
- **不要淡化真实问题。** 如果是会进生产的 bug，就直接说它是 bug。
- **能量化就量化。** “这个 N+1 查询会让每个列表项多出约 50ms” 比“这可能会慢”更好。
- **对明显有问题的方案要明确反对。** 阿谀奉承是审查中的失败模式。如果实现有问题，就直接指出，并提出替代方案。
- **如果作者掌握更多上下文，礼貌地让步。** 只评论代码，不评论人；把个人批评改写成对代码的评价。

## 依赖纪律

代码审查的一部分是依赖审查：

**在添加任何依赖前：**
1. 现有技术栈能解决吗？（通常能）
2. 依赖有多大？（检查包体积影响）
3. 是否仍然活跃维护？（看最近提交、开放 issue）
4. 是否有已知漏洞？（`npm audit`）
5. 许可证是否兼容项目？

**规则：** 优先使用标准库和现有工具，而不是新增依赖。每个依赖都是负担。

## 审查清单

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Names are clear and consistent
- [ ] Logic is straightforward
- [ ] No unnecessary complexity

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level

### Security
- [ ] No secrets in code
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities
- [ ] Auth checks in place
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual verification done (if applicable)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Request changes** — Issues must be addressed
```

## 另见

- 更详细的安全审查指导，请见 `references/security-checklist.md`
- 更详细的性能审查检查项，请见 `references/performance-checklist.md`

## 常见合理化说辞

| Rationalization | Reality |
|---|---|
| “能跑就行” | 能跑但不可读、不安全或架构错误的代码，只会制造持续累积的技术债。 |
| “我写的，所以我知道它是对的” | 作者往往看不到自己的假设。每次变更都值得多一双眼睛。 |
| “以后再清理” | 以后通常不会来。审查就是质量门槛，应该在提交前清理，而不是之后。 |
| “AI 生成的代码大概没问题” | AI 代码更需要审查，而不是更少。它会用很流畅的语言包装错误。 |
| “测试都过了，所以没问题” | 测试是必要条件，但不是充分条件。它们不能发现架构问题、安全问题或可读性问题。 |

## 红旗

- PR 在没有审查的情况下合并
- 审查只看测试是否通过，而忽略其他维度
- 没有真正审查就直接说 “LGTM”
- 安全敏感改动没有安全向审查
- 大 PR 大到“没法好好审查”
- bug 修复没有回归测试
- 审查意见没有严重程度标签，导致不清楚哪些必须修
- 接受“我以后再修”——通常不会发生

## 验证

审查完成后：

- [ ] 所有 Critical 问题已解决
- [ ] 所有 Important 问题已解决，或已明确延后并给出理由
- [ ] 测试通过
- [ ] 构建成功
- [ ] 已记录验证故事（改了什么、如何验证）
