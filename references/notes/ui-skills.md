# UI Skills

Source: `https://github.com/ibelick/ui-skills`

## Status

面向 Design Engineer 的社区 UI skill 集合。登记为 `evaluating`，用于研究窄技能路由、证据驱动审查和渐进式 UI 上下文加载。

## Latest Remote Evidence

- remote head: `2b3a114a3fcff079d73639a21710c595d4700a74`
- observed date: 2026-08-05
- evidence: shallow clone review of the root router, baseline UI, improve UI, accessibility, metadata, and motion-performance skills

## Extractable Upgrades

- UI 路由默认选择 1 个专项 skill，宽泛审查最多选择 3 个，避免上下文膨胀
- 设计审查先证明设计契约、运行时关联和确定性修正，再保留 finding
- 将 accessibility、motion performance、metadata 和快速 UI cleanup 分成窄能力，而不是堆在一个万能 prompt 中
- 审查和实现分离；只读审查不顺手修改产品源码

## License Boundary

- repository license: MIT
- 复制或实质改写时保留 MIT notice
- 本仓库以 adapted / inspired 方式吸收方法，不镜像其 CLI 和完整 skill catalog

## Non-Adoption Boundary

- 不强制 Tailwind、Motion、Base UI、React Aria 或 Radix 等具体技术选型
- 不把单一审美偏好升级为跨项目 MUST
- 不复制 `npx ui-skills` 运行时；当前 toolkit 继续使用 manifest 和 requires/suggests 路由

## Current Decision

- 保持 `evaluating`
- 吸收最小上下文路由和证据门禁到新的 `ui-ux-review`
- 通过 micro-eval 证明路由改善后，再决定是否升级为 active upstream

## Review Update 2026-09-01

- remote head: `f2dadf221a166a79606b337d08ce0b04d0d2bfd9`
- registered change: only `README.md`; `DESIGN.md` and `skills/**` are unchanged
- new CLI, remote MCP, Playbook and Astro/Cloudflare site runtime are distribution surfaces, not canonical UI guidance for this toolkit
- Playbook guidance is either already covered by local accessibility/design references or expresses product-specific visual preferences; no content sync or `source_paths` expansion is required
