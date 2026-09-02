# Modern Web Guidance

Source: `https://github.com/GoogleChrome/modern-web-guidance`

## Status

Google Chrome 团队支持的现代 Web 平台知识库，当前处于 preview。登记为 `evaluating`，仅作为按需检索和浏览器能力事实来源，不作为默认常驻上下文。

## Latest Remote Evidence

- remote head: `684ab9d7c6b78fc2cd5677912d874397cb2e5dfa`
- observed date: 2026-08-05
- release: `v0.0.179`
- evidence: shallow clone review of `README.md`, `policies`, and `skills/modern-web-guidance`

## Extractable Upgrades

- 先按用户意图搜索 use case，再只加载命中的现代 Web 指南，避免把完整浏览器知识库注入上下文
- 对 Baseline Widely Available、Newly Available 和自定义浏览器支持策略做显式区分
- 优先使用原生浏览器能力、渐进增强和轻量 fallback，避免不必要的 polyfill 或大型依赖
- 在 JSON/机器输出场景保持 stdout 纯净，把进度与诊断写入 stderr

## License Boundary

- repository license: Apache-2.0
- 允许在保留许可证与变更声明的前提下改写或分发
- 本仓库优先吸收检索协议和兼容性决策框架，不复制完整 guide 数据集

## Non-Adoption Boundary

- 不把 `npx ...@latest` 变成所有前端任务的强制网络依赖
- 不在没有项目浏览器支持策略时默认采用尚未广泛可用的 API
- 不把 preview 状态的全部指南并入 `frontend-ui-engineering` 正文

## Current Decision

- 保持 `evaluating`
- 先作为 `ui-ux-review` 和前端实现的可选参考来源
- 等离线缓存、版本固定和跨平台调用边界明确后，再评估独立 optional skill

## Review Update 2026-08-27

- remote head: `457c381def89ce6213a171238f92eea63e9eaeb2`
- `source_paths` 扩展为完整 `skills` 树，使新增 `chrome-extensions` 与后续 guide 变化进入人工审阅范围
- 已吸收的机制：在使用新 Web API、复杂 CSS 或非项目基线能力时，记录项目浏览器策略、权威兼容性证据与核对日期、能力检测、渐进增强、核心流程 fallback、无障碍影响和代表性浏览器验证
- 未吸收：`npx ...@latest` 强制网络调用、完整 guide 数据集、telemetry、Chrome 专属默认策略与大型 polyfill

## Review Update 2026-09-01

- remote head: `56c61c9ee79a8df1a98822309c04847a57f56000` (`v0.0.186`)
- registered change: 75 paths; most guide edits update exact Baseline and browser-version evidence
- absorbed: custom Enter-submit behavior must check IME composition and be verified with Chinese, Japanese, and Korean input so candidate confirmation does not submit the form
- retained boundary: keep an explicit submit control; do not copy the upstream Safari timing/key-code workaround as a universal implementation
- not adopted: online CLI allowlists, plugin manifests and complete guide/runtime distribution
