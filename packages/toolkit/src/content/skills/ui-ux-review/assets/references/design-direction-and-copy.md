# Design Direction and Copy

当任务涉及视觉方向、信息层级、差异化或界面文案时使用。本文件改写自 Anthropic `frontend-design`，但项目设计系统和用户明确目标始终优先。

## Ground the Direction

设计前明确：

- 具体产品或主题是什么
- 谁在使用
- 页面唯一的主要任务是什么
- 主题世界中哪些材料、工具、数据或语言可以成为真实视觉来源

没有这些约束时，不要用流行配色、卡片网格或模板 hero 代替产品判断。

## Compact Design Plan

```markdown
- Color: 4–6 个具名颜色或现有 token，以及各自语义
- Type: 标题、正文和数据/辅助文字的角色
- Layout: 信息优先级、栅格与窄屏重排方式
- Signature: 一项能代表主题、又不妨碍任务的特征
- Restraint: 主动删除的一项无功能装饰
```

“Signature” 不是强制动画或视觉噱头。它可以是内容组织、真实数据表达、交互方式或克制的排版特征。

## Critique Pass

- 每个结构标记、编号、分隔线和装饰是否表达真实信息
- 字体、颜色和布局是否可替换到任何同类产品而毫无变化
- 是否在多个位置同时追求醒目，造成竞争焦点
- 最大胆的选择是否集中在一个有理由的位置
- 最简方案是否仍在间距、排版、状态和细节上精确

## Copy as Interface Material

- 从用户侧命名对象，不暴露内部实现术语
- 使用主动、具体的动作：“保存更改”优于“提交”
- 同一动作贯穿按钮、进度、成功提示和历史记录时保持同名
- 标签只负责标签，示例只负责示例，不让一句文案承担多个角色
- 错误说明发生了什么以及如何恢复；空态给出真实下一步
- 使用真实业务内容验证换行、密度和溢出，不用 lorem ipsum 隐藏问题

## Evidence Boundary

新建页面可以由 brief 支持新的视觉方向；审查现有页面时，只有项目契约、直接矛盾或渲染证据能证明方向偏离。不能因为结果“像 AI”就直接判错，必须指出可定位的模板化选择及其对产品身份或任务的影响。

原始来源与许可：

- https://github.com/anthropics/skills/tree/main/skills/frontend-design
- `references/LICENSE-anthropic-frontend-design.txt`
