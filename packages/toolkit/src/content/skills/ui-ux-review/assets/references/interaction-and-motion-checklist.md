# Interaction and Motion Checklist

在页面包含动画、拖拽、复杂状态切换或感知性能问题时读取本文件。原则来自 ui-skills 与现代 Web 平台实践；实现前仍需核对项目框架和浏览器支持。

## Purpose Before Motion

每个动效应至少服务一项任务：

- 解释对象从哪里来、到哪里去
- 表达状态变化或操作结果
- 保持空间关系和连续性
- 在等待时确认系统仍在工作

没有明确作用的环境动画、滚动揭示或多个散落微动效应删除。一个经过编排的关键时刻通常比处处动画更清楚，但这不是强制风格。

## Accessibility

- 尊重 `prefers-reduced-motion`，为非必要位移提供静态或淡化替代
- 不用 hover 作为唯一入口；触屏与键盘拥有等价路径
- 拖拽提供按钮、菜单或点击式替代，并保留操作顺序与结果
- 自动播放、循环或闪烁内容可暂停，且不触发危险频率
- 动效结束后的焦点、名称、状态和阅读顺序仍正确

## Runtime Quality

- 优先动画 `transform` 和 `opacity`，避免逐帧修改会触发布局的属性
- 不常驻滥用 `will-change`；只在测量证明需要时短期启用
- 骨架与最终内容尺寸一致，避免状态切换造成布局位移
- 快速请求避免一闪而过的 spinner；延迟和最短展示时间应以产品测试为准
- 加载、成功、失败和回滚不能只靠动效表达

## Browser and API Decisions

- 优先使用已达到项目浏览器基线的原生能力
- 新 API 先查兼容性、渐进增强路径和失败回退
- 需要 polyfill、第三方库或网络查询时，先说明成本；不要让审查能力依赖在线安装
- 用真实设备、低电量模式、弱网和 CPU throttling 验证感知结果

## Review Evidence

报告动效问题时记录：触发动作、开始/结束状态、持续期间用户能否操作、reduced-motion 结果、性能测量或视频/截图证据。仅看到动画代码不能证明体验有问题。

相关来源与许可：

- https://github.com/ibelick/ui-skills
- https://github.com/GoogleChrome/modern-web-guidance
- `references/LICENSE-ui-skills.txt`
