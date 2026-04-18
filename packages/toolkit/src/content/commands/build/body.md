调用 `incremental-implementation` + `test-driven-development`，按任务逐个增量实现。

## 核心动作

对每个任务严格执行 TDD 循环：

1. 读取验收标准，加载必要上下文
2. **Red**：先写失败测试，定义期望行为
3. **Green**：写最小实现，让测试通过
4. **Refactor**：在保持绿色前提下简化实现
5. 运行回归验证，确认无新破坏
6. 原子提交，进入下一个切片

Bug 修复使用 Prove-It 模式：先写复现测试，再修复，再回归。

## 相关原则

- 先保证目标收敛，再谈扩展设计
- 只做当前任务需要的最小改动
- 遇到失败先停下来定位根因，不要继续堆代码

## 使用方式

在 `/build` 后指定要实现的任务或需求，我会按 TDD 循环逐个增量实现。

### 示例

```
# 按计划中的任务实现
/build 按照 spec 中的 Task 3，实现 UserService.updateProfile 方法

# 实现一个小功能
/build 给 OrderController 增加分页查询接口，参数为 page 和 size

# Bug 修复（Prove-It 模式）
/build 修复批量导入时的重复数据问题，先写复现测试再修复
```
