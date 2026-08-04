# Vercel Web Interface Guidelines

Source: `https://github.com/vercel-labs/web-interface-guidelines`

## Status

Vercel Labs 维护的 Web 界面检查清单。当前登记为 `evaluating`，用于按需审查交互、表单、响应式、内容和性能候选问题，不作为项目视觉风格的强制来源。

## Latest Remote Evidence

- remote head: `4e799d45c17aec1498c269287a83b9dba22b966b`
- observed date: 2026-08-05
- evidence: shallow clone review of `README.md`, `AGENTS.md`, `command.md`, `install.sh`, and `LICENSE`

## Extractable Upgrades

- 键盘、焦点、点击目标、表单、认证、长文本和状态覆盖可作为框架无关的候选检查项
- Windows 常显滚动条、移动端输入与跨平台原生控件需要进入真实浏览器验证矩阵
- 主观视觉建议必须服从项目设计系统；阴影、圆角、大小写和品牌文案不能作为通用 MUST
- 清单用于发现候选，最终问题仍需运行路径、规范或渲染证据证明

## License Boundary

- repository license: MIT
- 改写内容旁保留 `LICENSE-vercel-web-interface-guidelines.txt`
- 本仓库不复制安装脚本，不引入运行时网络依赖

## Current Decision

- 保持 `evaluating`
- 将框架无关检查改写进 `ui-ux-review` 的渐进式 reference
- Vercel 品牌专属 copy 和设计偏好仅作上下文示例，不提升为工具包全局规则
