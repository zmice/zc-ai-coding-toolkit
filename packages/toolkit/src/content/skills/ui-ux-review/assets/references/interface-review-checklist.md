# Interface Review Checklist

本清单用于发现候选问题，不替代项目契约和渲染证据。内容改写自 Vercel Web Interface Guidelines，并将品牌专属偏好降级为上下文建议。

## Interaction and Focus

- 键盘能否完成所有流程，焦点是否清楚、按任务顺序移动并正确返回
- 可点击区域是否与视觉控件一致，是否存在死区或过小目标
- 返回、刷新和深链接是否保留筛选、分页、tab 和展开状态
- dialog、drawer、sheet 等 overlay 是否阻断背景滚动链，关闭后是否恢复原滚动位置；同屏 layer、backdrop、toast 与 sticky 区域是否保持正确层级和可操作性
- 删除等破坏性操作是否有确认、撤销或安全窗口
- 加载控件是否保留原动作标签，快速响应时是否避免闪烁
- 乐观更新失败时是否回滚或提供恢复动作

## Forms and Authentication

- 每个控件是否有标签；点击标签能否聚焦控件
- Enter、换行和快捷提交是否符合控件类型与平台习惯
- 错误是否靠近字段，提交后是否聚焦首个错误
- `name`、`autocomplete`、`type`、`inputmode` 和 spellcheck 是否符合数据含义
- 是否允许粘贴、密码管理器和一次性验证码自动填充
- 离开页面时，未保存内容是否有丢失保护

## Responsive and Content Resilience

- 使用 CSS intrinsic layout、flex 或 grid 处理流式布局，是否无必要地依赖 JS 测量
- 320px 级窄屏、200% 缩放、Windows 常显滚动条下是否仍可用
- SSR / hydration 场景的首帧与客户端结果是否稳定；延迟 hydration 是否保留用户输入，并避免 locale、时间或客户端专属值造成 mismatch 和闪烁
- 全高或 fixed 表面是否适配动态 viewport 与 safe area；地址栏伸缩、刘海和底部手势区下是否无双滚动、裁剪或不可达操作
- 短、平均和极长用户内容是否都能换行、截断或展开
- 日期、数字、货币和单位是否按 locale 格式化
- 图片和骨架是否预留尺寸，避免布局跳动
- 空、少量、密集、加载、错误和离线状态是否都有下一步

## Semantics and Content

- 行为使用 `button`，导航使用 `a`，语义优先于 ARIA
- 图标按钮是否有名称，装饰元素是否对辅助技术隐藏
- 页面标题、标题层级、skip link 和锚点偏移是否准确
- 状态不只依赖颜色；图表对色觉差异是否可辨识
- 文案是否使用用户认识的对象与动作，流程内同一动作是否保持同名
- 错误是否说明修复出口，而不是只描述失败

## Performance Signals

- 是否在真实设备、弱网或 CPU throttling 下检查交互
- 输入、滚动和动画是否触发多余布局、重绘或昂贵重渲染
- 大列表是否需要虚拟化或 `content-visibility`
- 首屏图片、字体和第三方资源是否被无差别预加载
- 交互延迟和布局偏移是否有测量证据，而非主观猜测

## Context-Dependent Choices

阴影层数、边框、圆角、标题大小、句式、大小写和品牌语气都依赖项目。只有项目契约或用户 brief 支持时，才能把这些选择提升为发现；否则只记录为探索方向。

原始来源与许可：

- https://github.com/vercel-labs/web-interface-guidelines
- `references/LICENSE-vercel-web-interface-guidelines.txt`
