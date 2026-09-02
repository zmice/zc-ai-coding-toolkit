# Accessibility Checklist (WCAG 2.2 AA)

面向前端实现的快速检查表，以 [WCAG 2.2](https://www.w3.org/TR/WCAG22/) AA 为基线，并配合 [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/) 使用。自动化扫描不能替代键盘、缩放和辅助技术实测。

## Keyboard and Focus

- [ ] 所有操作都能用键盘完成，焦点顺序与视觉和任务顺序一致
- [ ] 焦点样式清晰；不要移除轮廓，优先用 `:focus-visible`
- [ ] 聚焦控件不会被 sticky header、footer、cookie banner 或弹层完全遮挡
- [ ] 模态框打开时移动并约束焦点，关闭后将焦点返回触发点
- [ ] 不存在键盘陷阱；自定义控件遵循对应 APG 键盘模式
- [ ] 页面提供可聚焦的跳到主内容入口

## Semantics and Names

- [ ] 优先使用原生 `button`、`a`、`label`、`dialog`、`table` 等语义元素
- [ ] 图片有准确 `alt`，纯装饰图片使用空 `alt`
- [ ] 表单控件有可见标签，图标按钮有可计算名称
- [ ] 页面主标题可识别，标题层级表达结构且不无故跳级
- [ ] 状态更新使用合适的 `role="status"`、`role="alert"` 或 `aria-live`
- [ ] 表格表头与数据单元关系可被辅助技术识别

## Visual and Responsive

- [ ] 普通文本对比度至少 4.5:1，大文本至少 3:1
- [ ] 控件边界和必要图形对比度至少 3:1
- [ ] 信息不只依赖颜色、位置、形状或声音表达
- [ ] 文本放大至 200% 后内容与操作仍可用
- [ ] 窄屏、长文本和本地化内容不会产生二维滚动或遮挡，必要数据表除外
- [ ] 内容不会每秒闪烁 3 次以上
- [ ] 尊重 `prefers-reduced-motion`，停止非必要动画

## Pointer, Dragging, and Targets

- [ ] 需要拖拽完成的功能同时提供不依赖拖动的简单指针操作
- [ ] 指针目标至少 24 × 24 CSS px，或满足 WCAG 2.2 的目标间距/例外条件
- [ ] 移动端优先采用不小于 44 × 44 CSS px 的舒适触控目标
- [ ] 控件可点击区域与视觉区域一致，不出现看似可点但无响应的死区

## Forms and Authentication

- [ ] 自定义 Enter 提交不会在中文、日文、韩文 IME 候选确认期间误提交；检查 composition 状态，保留显式提交控件并进行真实输入验证
- [ ] 必填、格式和错误信息不只靠颜色提示，并与字段程序化关联
- [ ] 提交失败后提供错误摘要，并将焦点移到首个可修复错误
- [ ] 已知用户信息使用正确 `autocomplete`、`name`、`type` 和 `inputmode`
- [ ] 登录、密码和一次性验证码兼容密码管理器与粘贴
- [ ] 认证不只依赖记忆题、识别题或抄写；提供符合 WCAG 2.2 的替代或辅助机制
- [ ] 多步骤流程避免重复录入已提供的信息，或允许用户确认和修改

## Help, Content, and States

- [ ] 重复出现的帮助入口在同一流程中保持相对一致的位置
- [ ] 页面 `<title>`、语言和当前上下文准确
- [ ] 链接和按钮使用描述结果的文本，避免“点击这里”“提交”等模糊词
- [ ] 空、加载、错误、离线、禁用和成功状态均有可理解的下一步
- [ ] 自动播放媒体提供暂停、停止和音量控制

## Common Patterns

```html
<!-- 行为用 button，导航用 a -->
<button type="button" aria-label="关闭对话框">…</button>
<a href="/tasks/123">查看任务</a>

<!-- 标签与输入关联 -->
<label for="email">邮箱</label>
<input id="email" name="email" type="email" autocomplete="email" />

<!-- 非打断式状态与错误 -->
<p role="status" aria-live="polite">已保存</p>
<p role="alert">标题不能为空</p>
```

## Testing Tools

```bash
# 自动化初筛；将 URL 替换为待测页面
npx @axe-core/cli http://127.0.0.1:3000
npx pa11y http://127.0.0.1:3000
```

还应执行：

- 仅用键盘走完主流程和异常恢复流程
- 浏览器缩放至 200%，检查窄屏、横屏与长文本
- 在 Chrome/Edge Accessibility Tree 中核对名称、角色与状态
- macOS 使用 VoiceOver；Windows 至少使用 NVDA 进行代表性流程测试

## Common Anti-Patterns

| Anti-pattern | Problem | Correction |
|---|---|---|
| `div` 模拟按钮 | 缺少原生语义和键盘行为 | 使用 `<button>` |
| 移除 focus outline | 键盘用户失去当前位置 | 设计可见的 `:focus-visible` 样式 |
| 只支持拖拽 | 部分用户无法完成操作 | 增加按钮、菜单或点击式替代 |
| 禁止粘贴或密码管理器 | 阻碍可访问认证 | 保留粘贴和自动填充能力 |
| `tabindex` 大于 0 | 破坏自然焦点顺序 | 只使用 `0` 或 `-1` |
| 仅显示颜色错误态 | 色觉或非视觉用户无法识别 | 同时提供文本、图标和程序化状态 |
