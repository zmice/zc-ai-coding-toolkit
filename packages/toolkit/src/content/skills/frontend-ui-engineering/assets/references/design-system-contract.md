# Design System Contract

只有在目标页面的设计系统、状态或边界不清楚，或用户明确给出外部视觉参考时读取本文件。目标是形成当前项目真正消费、可以验证的设计契约，而不是把外部品牌风格直接搬进产品。

## Evidence Order

1. 用户明确给出的设计稿、品牌或验收目标
2. 当前应用的项目说明与正式设计文档
3. 目标路由实际导入的主题、token、组件和样式
4. 同一产品内已上线且承担相同任务的页面
5. 外部通用指南

草案、迁移计划、未启用主题和名称相似的组件不能自动视为有效契约。

## Choose a Mode

- `reconstruct`：项目已有设计系统，从运行路径恢复当前约束
- `author`：项目缺少明确方向，基于用户 brief、业务任务和经过登记的参考形成候选契约

`author` 不是自由复刻入口。即使用户提供品牌站点、截图或 `DESIGN.md`，也必须先执行下方的外部参考门禁。

## Capture the Local Contract

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
- Provenance and last verified evidence:
```

每项都附文件、组件或渲染证据。没有证据时写 `未确认`，不要补一个看似合理的值。

契约至少区分：

- 视觉气质、页面密度与内容层级
- 语义颜色角色，不只是十六进制值
- 排版角色与尺度，不默认复制专有字体
- 间距、圆角、边框、深度和动效语义
- 组件 default / hover / focus / pressed / disabled / loading / error 状态
- 布局、断点、触控与长文本行为
- 允许与禁止的模式，以及明确例外

## External Reference Gate

仅在用户明确提供参考，或项目没有可用视觉方向且当前任务需要建立 brief 时启用。先记录：

```markdown
## External visual reference
- Source URL:
- Fixed commit/ref or capture date:
- License and ownership caveats:
- Applicable surface and user task:
- Transferable principles:
- Local tokens/components that remain owners:
- Rejected brand assets or unsupported claims:
- Offline fallback if the source disappears:
```

允许迁移的是抽象原则，例如信息密度、语义颜色角色、排版层级、组件状态覆盖、空间关系和响应式策略。默认拒绝复制 logo、商标、品牌文案、专有字体、截图、插画、具体 token 值和来源站点的产品信息架构。

外部参考不能覆盖项目设计系统、用户明确目标、可访问性或真实业务契约。若用户要求“一模一样”，先区分其是否拥有相关资产和授权；无法证明时退化为抽象特征参考。

## Browser Capability Decision

仅在引入新的 Web API、复杂 CSS、View Transitions、Popover、Anchor Positioning 或其他不确定是否进入项目浏览器基线的能力时填写。普通且已被项目支持矩阵覆盖的能力不需要制造额外文档。

```markdown
## Browser capability decision
- Feature and user outcome:
- Project browser policy:
- Baseline / compatibility status:
- Authoritative evidence URL and checked date:
- Native implementation path:
- Feature detection:
- Progressive enhancement or lightweight fallback:
- Core task when unsupported:
- Accessibility and reduced-motion impact:
- Representative browser verification:
- Rejected polyfill or dependency and reason:
```

项目明确的企业浏览器策略优先于通用 Baseline 状态。支持信息会漂移，必须记录权威来源与核对日期；不把 `@latest` 网络查询、完整外部 guide 数据集或大型 polyfill 变成运行时依赖。fallback 必须保留核心任务，不要求在旧环境复制全部增强体验。

本决策门改写自 GoogleChrome `modern-web-guidance` 的兼容性与渐进增强机制（Apache-2.0），不复制其 guide 数据集或强制 CLI 调用。

## Drift Matrix

| Contract item | Document value | Code token/config | Component owner | Rendered evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Example: primary action | semantic role | token path | button variant | route/screenshot | confirmed / drift / unknown |

只有文档、代码 owner 和真实渲染能够互相对应，才能声明契约已生效。外部文件本身只能提供候选方向，不能替代本矩阵。

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
- 外部参考是否固定版本、说明许可，并排除受限品牌资产
- 替代方案为何不满足约束
- 窄屏、键盘、辅助技术和失败态是否仍成立
