# UI/UX Review

## Overview

对一个真实产品界面执行证据驱动的只读审查。目标是识别能够被设计契约、运行路径或渲染结果证明的问题，而不是把个人审美包装成规则。

## When to Use

- 用户要求审计、点评、改善、清理或设计交接
- 排查设计系统漂移、响应式断点或状态表达不一致
- 在实现前为现有页面形成有证据的改进优先级

若用户已经明确要求直接修改，先完成审查并确定范围，再交给 `skill:frontend-ui-engineering` 实现。不要在只读审查阶段安装依赖、格式化、提交或修改产品源码。

## 1. Select One Surface

遵守用户范围。范围过大时只选择一个可部署应用和一个连贯任务面，从路由或布局入口沿导入、props、token、CSS 和运行配置追踪真实渲染路径。

名称相似、目录邻近、重复值或搜索命中只能产生候选，不能证明两个界面由同一设计契约管理。

## 2. Load the Smallest Reference Set

默认读取 1 份、最多选择 3 份参考文件：

- 一般交互、表单、响应式和状态：`references/interface-review-checklist.md`
- 视觉方向、信息层级和界面文案：`references/design-direction-and-copy.md`
- 动效、拖拽和反馈时序：`references/interaction-and-motion-checklist.md`

无障碍深审时再配合 `skill:frontend-ui-engineering` 的 WCAG 2.2 附件。不要为了“完整”一次性加载所有清单。

## 3. Reconstruct the Local System

记录目标界面实际消费的设计文档、token、主题、共用组件、变体和例外。项目契约、用户目标与可访问性优先于外部风格偏好。

```markdown
## Design language
- Audited surface:
- Primary user task:
- Governing sources:
- External references (optional, not governing by default):
- Runtime owners and consumers:
- Documented decisions:
- Explicit exceptions:
```

设计文档缺失本身不是问题；未来草案也不能证明当前实现错误。

## 4. Apply the Evidence Gate

每个候选问题至少满足对应证据：

1. **Contract**：绑定该属性与界面的项目规则、明确用户目标、可访问性规范，或同一任务内直接矛盾的可见文案/状态
2. **Runtime**：通过渲染、导入、props、解析后的配置、CSS 继承或运行产物证明它到达目标界面
3. **Correction**：证据能确定一个修正方向，并能指出应复用的 token、组件或范例

信息层级、视觉突出度、密度、可发现性、连贯性和“看起来不对”等主观判断必须有截图、真实浏览器或用户研究等渲染证据。源码差异不足以证明这些问题。

外部品牌站点、截图或 `DESIGN.md` 只能提供候选修正方向；除非用户明确把它纳入本项目验收目标，否则不能单独满足 Contract 证据，也不能因为界面“与参考不够像”生成 finding。

直接影响键盘、辅助技术、缩放、目标尺寸或认证的规范性问题，可以由有效标准与运行路径共同证明，不要求先看到视觉缺陷。

## 5. Falsify Before Reporting

重新打开每条证据并尝试推翻候选。出现以下任一情况就删除：

- 规则不管理该界面或属性
- 存在明确例外或反证
- 多种修正都同样合理，需要发明产品意图
- 问题实际属于功能、架构或性能，且不在用户审查范围
- 与另一条发现是同一根因

没有受支持的发现，比报告无证据问题更可信。

## 6. Report a Short, Actionable Review

最多保留 5 条发现，按用户影响、证据强度、覆盖范围和修正成本排序。

```markdown
## 审查范围
- 界面与主任务：
- 设计契约：
- 证据类型：源码 / 运行时 / 截图 / 浏览器 / 用户反馈
- 未覆盖范围：

## 发现
| 严重度 | 问题 | 证据 | 用户影响 | 唯一修正方向 | 置信度 |
| --- | --- | --- | --- | --- | --- |

## 优先改善
<选择一条证据最强且杠杆最高的发现及理由；若没有则写“无受支持的建议”。>
```

严重度只表达用户影响，不替代置信度。证据列必须能定位到文件、组件、截图区域或浏览器行为。

## Handoff

用户选择修复项后，为实现者补齐：目标结果、受影响文件/路由、复用 owner、状态矩阵、响应式与无障碍要求、验收步骤。随后由 `skill:frontend-ui-engineering` 实现，并用 `skill:browser-qa-testing` 获取真实渲染证据。

## Red Flags

- 把通用阴影、圆角、字体或动效偏好当作强制规范
- 没有渲染证据就断言层级、密度或美感有问题
- 从重复代码直接推导应新增共用组件
- 审查过程中顺手修改源码
- 输出几十条同权重问题，没有唯一优先项
