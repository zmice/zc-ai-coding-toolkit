---
name: plan-review
description: 从产品、工程、设计、DevEx 多个角度评审 Spec/Plan，发现单一视角容易遗漏的问题。
---

调用 multi-perspective-review 技能。四视角独立评审，发现盲点。

1. 读取当前 Spec 或 Plan，提取关键决策点
2. **产品视角** — 用户价值清晰？边界覆盖？验收可测？
3. **工程视角** — 技术方案可行？扩展性？技术债务？
4. **设计视角** — 用户体验顺畅？异常状态完整？设计一致？
5. **DevEx 视角** — API 直觉化？文档充分？配置合理？
6. 汇总发现，按 Critical / Warning / Suggestion 分级
7. **门控：存在 Critical 则阻断，必须修复后继续**

可选参数：`--product` `--engineering` `--design` `--devex` 选择评审视角，默认全部。

## 使用方式

在 Spec 或 Plan 完成后执行 `/plan-review`，获取多视角评审反馈。

### 示例

```
# 全视角评审
/plan-review

# 仅工程和安全视角
/plan-review --engineering 重点关注技术方案的可行性和扩展性

# 评审特定文档
/plan-review 评审 spec.md 中的支付模块设计
```
