# Vercel Web Interface Guidelines

Source: `https://github.com/vercel-labs/web-interface-guidelines`

## Status

Vercel Labs 维护的 Web 界面检查清单。当前登记为 `evaluating`，用于按需审查交互、表单、响应式、内容和性能候选问题，不作为项目视觉风格的强制来源。

## Latest Remote Evidence

- remote head: `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`
- observed date: 2026-08-27
- evidence: exact diff from the previous baseline across `README.md`, `AGENTS.md`, and `command.md`; `install.sh` and `LICENSE` were unchanged

## Extractable Upgrades

- 键盘、焦点、点击目标、表单、认证、长文本和状态覆盖可作为框架无关的候选检查项
- Windows 常显滚动条、移动端输入与跨平台原生控件需要进入真实浏览器验证矩阵
- 主观视觉建议必须服从项目设计系统；阴影、圆角、大小写和品牌文案不能作为通用 MUST
- 清单用于发现候选，最终问题仍需运行路径、规范或渲染证据证明
- sticky/fixed surface 不得遮挡焦点；拖拽、滑动、捏合和路径手势需要非手势与键盘替代，除非手势本身是任务本质
- 有意义媒体需要字幕、转录或描述及键盘可操作控件；长时间自动播放动效必须可暂停、停止或隐藏，并尊重 reduced motion
- 动画 GIF 优先评估更小的视频与静态 fallback，但媒体选择仍取决于语义、浏览器支持和项目性能证据

## License Boundary

- repository license: MIT
- 改写内容旁保留 `LICENSE-vercel-web-interface-guidelines.txt`
- 本仓库不复制安装脚本，不引入运行时网络依赖

## Current Decision

- 保持 `evaluating`
- 将本轮框架无关的焦点、手势、媒体和动效检查吸收到前端实现与 `ui-ux-review` 的渐进式 reference
- 2026-08-27 继续吸收 overlay 滚动与层级生命周期、SSR / hydration 首帧稳定性、动态 viewport 与 safe area 的行为验收；不复制框架或 CSS 工具类写法
- Vercel 品牌专属 copy 和设计偏好仅作上下文示例，不提升为工具包全局规则
