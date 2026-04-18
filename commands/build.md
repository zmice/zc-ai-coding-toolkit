---
name: build
description: 按 TDD 红绿重构循环进行增量构建，每次只实现一个任务，确保系统始终可编译、测试通过。
---

调用 incremental-implementation + test-driven-development 技能。逐个任务增量实现。

对每个任务严格执行 TDD 循环：
1. 读取任务的验收标准，加载相关上下文
2. **Red** — 写失败测试，定义期望行为
3. **Green** — 写最小实现使测试通过
4. **Refactor** — 改善代码质量，保持测试绿色
5. 运行完整测试套件，检查无回归
6. 原子提交，描述性消息
7. 标记完成，进入下一个任务

Bug 修复使用 Prove-It 模式：写复现测试（FAIL）-> 修复 -> 测试 PASS -> 全量回归。

遇到失败时 STOP，按 debugging-and-error-recovery 技能诊断。

## 使用方式

在 `/build` 后指定要实现的任务或需求，我将按 TDD 循环逐个增量实现。

### 示例

```
# 按计划中的任务实现
/build 按照 spec 中的 Task 3，实现 UserService.updateProfile 方法

# 实现一个小功能
/build 给 OrderController 增加分页查询接口，参数为 page 和 size

# Bug 修复（Prove-It 模式）
/build 修复批量导入时的重复数据问题，先写复现测试再修复
```
