---
name: sdd-tdd
description: 启动完整的 SDD+TDD 开发流程，从需求分析到规格编写、任务拆解、TDD 增量构建、代码审查，全流程门控推进。
---

调用 sdd-tdd-workflow 技能。按阶段门控推进完整开发生命周期：

1. **Spec** — 分析需求，列出假设和约束，编写技术规格（调用 spec-driven-development）
2. **Plan Review**（可选） — 多视角评审 Spec（调用 multi-perspective-review）
3. **Task Plan** — 将 Spec 拆解为原子任务，标注依赖（调用 planning-and-task-breakdown）
4. **Build** — 对每个任务执行 TDD 红绿重构循环（调用 incremental-implementation + test-driven-development）
5. **Quality Review** — 五维度代码审查，确认无 Critical 问题（调用 code-review-and-quality）
6. **Commit** — 审查通过后，代理收集变更并生成提交消息，展示摘要 **等待用户确认后执行提交**（调用 git-workflow-and-versioning）
7. **Retro**（可选） — Sprint 回顾，提取改进项（调用 sprint-retrospective）

每个阶段完成后 **停下等待人类确认** 再继续。

如果某些阶段已完成，可单独使用子命令：

| 场景 | 推荐命令 |
|------|----------|
| 需求不清晰 | `/spec` 先理清 |
| 已有 Spec | `/task-plan` 直接拆解 |
| 已有 Plan | `/build` 逐个实现 |
| 实现完成 | `/quality-review` 审查 |
| 审查通过 | `/commit` 代理提交 |
| 小修改 / Bug | `/build` 或 `/debug` |

## 使用方式

在 `/sdd-tdd` 后描述你的需求，我将按阶段门控流程推进开发。

### 示例

```
# 新功能开发（完整流程）
/sdd-tdd 实现用户登录功能，支持邮箱+密码登录和 JWT Token 刷新

# 带约束的需求
/sdd-tdd 实现订单导出功能，支持 CSV 和 Excel 格式，需要分页查询避免内存溢出

# 从零搭建
/sdd-tdd 搭建一个 React + Vite 前端项目，包含路由、状态管理和基础组件库
```
