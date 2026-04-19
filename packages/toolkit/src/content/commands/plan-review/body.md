这是 `command:start` 之后的 **计划/规格评审阶段入口**。

当 `command:start`、`command:spec` 或 `command:task-plan` 产出了关键方案，但在进入实现前还需要多视角把关时，就从这里接力到 `multi-perspective-review`。

## 当前阶段要做什么

1. 读取当前 Spec 或 Plan，提取关键决策点
2. **产品视角**：用户价值清晰？边界覆盖？验收可测？
3. **工程视角**：方案可行？扩展性和技术债务可控？
4. **设计视角**：体验流畅？异常状态完整？一致性足够？
5. **DevEx 视角**：接口直觉？文档充分？配置合理？
6. 汇总发现，按 `Critical / Warning / Suggestion` 分级
7. 存在 `Critical` 时阻断，先修复再继续

## 当前阶段的边界

- 这里只做评审，不直接进入实现
- 重点是提前暴露盲点，而不是重写整份规格
- 评审结论必须指向明确修正动作

## 从这里通常接到哪里

- 评审通过：进入 `command:task-plan` 或 `command:build`
- 评审发现规格空洞：回到 `command:spec`
- 评审发现计划颗粒度不对：回到 `command:task-plan`

## 使用方式

提供当前的 Spec、Plan 或关键方案，我会按多视角输出结构化评审结果，并给出下一步接力建议。
