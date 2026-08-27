# Awesome DESIGN.md

Source: `https://github.com/VoltAgent/awesome-design-md`

## Status

面向 AI 编码代理的 `DESIGN.md` 视觉参考集合。当前登记为 `evaluating`，用于研究“视觉方向、语义 token、组件状态、布局与响应式”如何组成可消费的项目设计契约；它不是官方品牌设计系统，也不是 toolkit 的运行时依赖。

## Latest Remote Evidence

- remote head: `8147538b4226ae41e2487a9179e3bcc1f68e8554`
- observed date: 2026-08-27
- evidence: shallow clone review of `README.md`, `CONTRIBUTING.md`, `LICENSE`, the `design-md/` index, and representative `DESIGN.md` files
- repository claim: 73 design references; the root collection is grouped by product category

## Failure Baseline

在“用户提供外部品牌或 `DESIGN.md` 参考”的场景中，当前前端资产只说明外部偏好不能覆盖项目设计系统，但没有要求固定来源版本、区分可迁移原则与受限品牌资产，也没有把文档 token 与代码 owner、组件状态和真实渲染做一致性核对。可观察失败是 Agent 可能直接复刻品牌值，或在审查时把“与外部参考不相似”误报为项目缺陷。

## Extractable Upgrades

- 把外部视觉资料先转换为项目 brief，再映射到本地语义 token 和组件 owner
- 在设计契约中同时记录视觉气质、颜色角色、排版层级、组件状态、布局、响应式、深度、Do/Don't 和验证证据
- 固定来源 URL 与 commit/ref，明确适用 surface、采用项、拒绝项和许可边界
- 用“文档值 -> 代码 token -> 组件 owner -> 真实渲染”矩阵检查设计契约漂移

## License Boundary

- repository license: MIT, Copyright (c) 2026 VoltAgent
- 当前只吸收信息结构和治理机制，没有复制或实质改写任何品牌 `DESIGN.md`、preview HTML、logo、截图、字体或具体 token
- 若未来复制或实质改写上游内容，必须随对应附件保留 MIT notice，并单独核对商标、专有字体和品牌视觉识别权

## Snapshot Evidence

- `snapshot --with-remote` 在 JSON 中冻结治理元数据、notes、remote HEAD，以及 `LICENSE`、`README.md`、`CONTRIBUTING.md` 与 `design-md/**` 的 Git mode、object hash、路径、条目数和 manifest SHA-256
- baseline 加载会校验 HEAD、登记 scope、entry count 和 SHA-256；早期同名前缀 `.tree.md` companion 仅保留为 append-only 迁移审计证据
- 仓库内容不进入 runtime 或 toolkit；若远端历史对象不可获取，tree manifest 仍可证明文件身份，但不能替代原始字节归档

## Non-Adoption Boundary

- 不镜像 `design-md/` 品牌语料库，不把平台生成变成在线下载流程
- 不把 `version: alpha` front matter 当作稳定 schema
- 不把公开可观察的 CSS 值解释为官方品牌授权或可自由复刻的产品身份
- 不用营销站点参考替代业务后台的加载、空、错、权限、认证和无障碍契约
- 不因外部参考与当前界面不同就生成 UI/UX finding；仍需项目 contract、runtime 和 correction 证据

## Representative Evaluation Cases

1. 已有项目设计系统并提供 Linear 风格参考：只迁移信息密度和 surface hierarchy，保留本地字体、品牌色与组件 owner；输出固定来源、采用项和拒绝项。
2. 没有设计稿的新页面：先形成可验证的项目 brief，仍覆盖正常、加载、空、错、禁用、成功与权限态；不得复制品牌资产或虚构业务内容。
3. 只读审查引用外部 `DESIGN.md`：外部资料只能产生候选方向，不能单独满足 Contract 证据，也不能把风格差异报告成缺陷。

## Current Decision

- 保持 `evaluating`
- 将外部视觉参考接入协议收敛到现有 `frontend-ui-engineering` 的 design-system contract
- `ui-ux-review` 只消费项目契约，并明确外部参考不能单独构成 finding
- 完成结构 lint、代表性行为对照和跨平台生成验证前，不新增独立 design skill
