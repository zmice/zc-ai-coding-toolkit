调用 code-review-and-quality 技能。审查当前变更（staged 或最近提交）。

五维度审查：
1. **正确性** — 匹配 Spec？边界条件？错误处理？测试充分？
2. **可读性** — 命名清晰？逻辑直白？组织合理？
3. **架构** — 符合现有模式？边界清晰？抽象层级正确？
4. **安全性** — 输入验证？认证授权？敏感数据处理？（调用 security-and-hardening）
5. **性能** — N+1 查询？无界操作？资源泄漏？（调用 performance-optimization）

按 Critical / Important / Suggestion 分级输出，附具体文件位置和修复建议。

**门控：所有 Critical 问题解决后才算通过。**

## 使用方式

在 `/quality-review` 后指定要审查的范围，我将进行五维度系统化审查并输出报告。

### 示例

```
# 审查最近的 git 变更
/quality-review 检查最近的 git 变更，重点关注安全性和性能

# 审查指定文件
/quality-review 审查 src/services/PaymentService.java

# 审查指定 PR
/quality-review 检查 PR #142 的变更，这是数据库分页查询优化
```
