# Design System Contract

只有在目标页面的设计系统、状态或边界不清楚时读取本文件。目标不是发明一套新系统，而是找出当前界面真正消费的约束。

## Evidence Order

1. 用户明确给出的设计稿、品牌或验收目标
2. 当前应用的项目说明与正式设计文档
3. 目标路由实际导入的主题、token、组件和样式
4. 同一产品内已上线且承担相同任务的页面
5. 外部通用指南

草案、迁移计划、未启用主题和名称相似的组件不能自动视为有效契约。

## Capture

```markdown
## Local design contract
- Surface and primary task:
- Governing routes/layouts:
- Component owners:
- Color and state tokens:
- Type and spacing scale:
- Radius, border and elevation rules:
- Responsive breakpoints:
- Motion rules:
- Content vocabulary:
- Accessibility baseline:
- Explicit exceptions:
```

每项都附文件、组件或渲染证据。没有证据时写 `未确认`，不要补一个看似合理的值。

## State Matrix

| State | Required evidence | Implementation question |
|---|---|---|
| Initial/loading | API 和组件行为 | 是否保留稳定布局并表达 busy 状态 |
| Empty | 真实业务条件 | 是否说明原因和下一步 |
| Error/offline | 错误契约 | 是否可恢复且保留用户输入 |
| Partial/permission | 权限与字段契约 | 是否避免泄露或伪造可用操作 |
| Success | 提交和刷新语义 | 是否确认结果且避免重复提交 |

## Decision Gate

新增 token、组件或交互模式前确认：

- 现有 owner 是否确实无法表达需求
- 新抽象是否至少有清晰的当前消费者，而非只因为代码重复
- 新视觉选择是否服务页面任务和产品身份
- 替代方案为何不满足约束
- 窄屏、键盘、辅助技术和失败态是否仍成立
