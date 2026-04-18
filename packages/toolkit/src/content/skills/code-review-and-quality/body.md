# 代码审查与质量

## 何时使用

- 合并任何变更之前
- 完成一次功能实现之后
- 评估自己、其他代理或人类写的代码时
- bug 修复和重构之后

## 输入前提

- 已知道这次变更对应的规格或任务
- 已有测试、构建或其他验证证据可供审查
- 愿意按问题严重度给出明确结论，而不是泛泛评价

## 执行步骤

1. 先理解变更意图，再看测试和验证证据
2. 按五个维度审查：
   - 正确性
   - 可读性
   - 架构
   - 安全性
   - 性能
3. 把发现按 `Critical / Important / Suggestion` 分级
4. 对每条问题给出具体位置和修复方向
5. 审查结论给出后，要求作者进入 review 响应闭环，逐条收敛问题
6. 所有 Critical 清零并完成必要回归验证后，才算通过

## 成功标准

- 评审结论基于代码和证据，而不是个人偏好
- 真正会阻塞合并的问题被明确指出
- 报告能让作者快速定位问题和采取动作
- 评审没有用“看起来还行”替代事实判断
- 审查后的问题处理路径清楚，不把“提了意见”误当成“问题已关闭”

## 相关原则

- 先报问题，再做总结
- 只评论代码，不评论作者
- 技术事实高于风格偏好

## 与其他技能的衔接

- 接在 `incremental-implementation` 或 bug 修复之后
- 安全和性能深挖时可转给对应专项 skill
- 对验证证据的审查依赖 `verification-before-completion`
- 审查输出如果产生待修问题，应进入 `review-response-and-resolution`

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
- [ ] 审查意见已逐条进入响应闭环，没有“已读未处理”的项
- [ ] 测试通过
- [ ] 构建成功
- [ ] 已记录验证故事（改了什么、如何验证）
