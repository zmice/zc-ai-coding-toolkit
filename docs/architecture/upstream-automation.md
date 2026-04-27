# Upstream Automation Spec

## Objective

Stage 1 的目标不是“自动同步上游”，而是把仓库级 upstream 治理命令扩展成一套可审阅、可追踪、可回放的工作流。

这套工作流需要支持四类能力：

- `diff`：比较当前上游状态与已登记快照/基线之间的差异
- `snapshot`：冻结一次可审阅的上游状态
- `report`：把差异、影响和审阅结论整理成稳定输出
- `import --dry-run`：生成导入提案，但不写入任何目标目录

成功标准不是“机器自动完成同步”，而是：

- 人工审阅始终是最终决策
- 每次变更都有可追溯的快照或报告依据
- `references` 继续作为治理层，而不是运行时输入
- `toolkit` 和 `platform` 只作为下游影响面被引用，不被 upstream automation 直接改写

## Current Baseline

当前仓库级 upstream 治理入口提供：

- `list`
- `show <id>`
- `review [id]`

这意味着 Stage 1 的规格必须向后兼容已有治理入口，不能把现有命令语义改成自动执行。

## Contract

### `diff`

`diff` 用于回答一个问题：当前观察到的上游状态，相对于某个已登记快照或基线，变了什么。

最小 contract：

- 输入必须明确一个 upstream id
- 对比目标必须可追溯，默认是该 upstream 最新可用 snapshot
- 输出必须区分：
  - 结构性变化
  - 文本变化
  - 元数据变化
  - 对下游的潜在影响
- `diff` 只产生结果，不修改任何文件

`diff` 的输出必须足够支持人工审阅，不要求一次性决定是否导入。

### `snapshot`

`snapshot` 用于把某次观察到的 upstream 状态冻结下来，作为后续 diff 和 review 的证据。

最小 contract：

- snapshot 必须是不可变记录
- snapshot 必须有可识别的 upstream id、时间戳和标签
- snapshot 只能追加，不能原地编辑
- snapshot 内容必须稳定到可用于后续 diff
- snapshot 只记录观察结果，不自动发布到 toolkit 或 platform

### `report`

`report` 用于把一次 upstream 审阅整理成标准化输出，供人看、供工具归档、供后续追踪。

最小 contract：

- report 必须说明比较对象、发现的差异和建议动作
- report 必须包含人工审阅入口信息
- report 必须明确哪些变化会影响 `toolkit`，哪些只影响 `platform`，哪些只是治理元数据
- report 本身不等于批准，也不等于执行

report 的角色是“审阅材料”，不是“自动执行指令”。

### `import --dry-run`

`import --dry-run` 用于把候选导入转换成提案，但不允许写入 `references` 之外的任何目标。

最小 contract：

- dry-run 必须列出计划中的动作
- dry-run 必须列出会被影响的路径或目标类别
- dry-run 必须列出阻止执行的条件，尤其是需要人工确认的条件
- dry-run 不能创建、修改或删除 toolkit / platform 产物
- dry-run 不能把“建议执行”伪装成“已经执行”

如果未来引入真实 `import`，它必须在另一个明确的审批步骤之后再进入写入阶段。Stage 1 只定义 dry-run 提案，不定义自动写入。

## Output Model

### Text output

文本输出面向人工审阅，必须按固定顺序展示：

1. 上下文
2. 差异摘要
3. 影响范围
4. 风险与阻断条件
5. 人工决策入口

示例结构：

```text
Upstream: agent-skills
Mode: report
Decision: pending-manual-review

Summary:
- 2 files changed in notes
- 1 snapshot newer than baseline
- platform generation impact: possible

Impact:
- references/notes: updated
- references/snapshots: append-only only
- toolkit: no direct write
- platform: no direct write

Next step:
- human review required before publish
```

### JSON output

JSON 输出面向脚本和后续自动化，不面向最终决策。

必须包含的字段类别：

- `upstream`
- `mode`
- `baseline`
- `changes`
- `impacts`
- `recommendation`
- `review_status`

JSON 不是“机器盖章通过”的依据。它只是结构化表达，最终决策仍然依赖人工审阅。

### Markdown report

当 report 需要落盘时，优先使用 Markdown 作为审阅格式，因为它对人类和版本控制都足够友好。

Markdown report 应该保留：

- 可读摘要
- 证据链接
- 风险说明
- 审阅结论占位

## References Boundary

`references` 是上游治理层，职责是记录“从哪里来、看到了什么、谁审过、当前状态是什么”。

`references` 负责：

- `references/upstreams.yaml` 中的上游登记
- `references/notes/` 中的审阅记录、同步说明和未决问题
- `references/snapshots/` 中的不可变快照

`references` 不负责：

- 作为 runtime source 被 `toolkit` 或 `platform` 直接消费
- 保存已经被默认当作真相的运行时内容
- 替代 toolkit 资产源或 platform 生成面

治理层和产物层的分界必须清晰：

- `references` 记录事实和审阅
- `toolkit` 定义 canonical content
- `platform` 生成 downstream artifact

Upstream automation 可以引用 toolkit/platform 影响，但不能把 references 变成“偷偷写产物”的入口。

## Toolkit / Platform Boundary

### Toolkit boundary

`toolkit` 是技能、命令、agents 的唯一事实源。

Upstream automation 对 toolkit 的边界要求：

- 可以识别 upstream 变更是否“可能影响 toolkit”
- 可以在 report 中标记影响面
- 不能直接编辑 `packages/toolkit/src/content/**`
- 不能绕过 toolkit 的既有验证流程

### Platform boundary

`platform` 负责把 toolkit 内容适配成平台产物。

Upstream automation 对 platform 的边界要求：

- 可以识别 upstream 变更是否“可能影响 platform 生成结果”
- 可以在 report / dry-run 中标注平台影响
- 不能直接写入 `packages/platform-*` 的生成产物
- 不能替代 platform 自己的 generate/install contract

### Implication rule

如果一次 upstream 变更会影响 toolkit 或 platform，upstream automation 只能输出“建议和证据”，不能自动执行同步。

最终动作顺序必须是：

1. 观察
2. snapshot
3. report
4. 人工审阅
5. 决策
6. 之后才进入任何写入型流程

## Commands

Stage 1 的命令面应保持与当前仓库级 upstream 治理入口一致，并向下扩展为下列 contract。命令名是规范的一部分，参数可在实现阶段微调，但语义不能变。

### Existing commands

- `pnpm upstream -- list`
- `pnpm upstream -- show <id>`
- `pnpm upstream -- review [id]`

### Planned commands

- `pnpm upstream -- diff <id> [--against <baseline>] [--format text|json] [--with-remote]`
- `pnpm upstream -- snapshot <id> [--label <label>] [--format text|json|md] [--with-remote]`
- `pnpm upstream -- report <id|all> [--format text|json|md] [--output <path>] [--with-remote]`
- `pnpm upstream -- import <id> --dry-run [--format text|json] [--output <path>]`

`--with-remote` 通过 `git ls-remote <source_url> HEAD` 采集远端 HEAD 证据。默认不启用网络访问，避免 CI、离线审阅和不可变 snapshot 因网络状态产生漂移。

## Project Structure

本阶段只定义治理层文档和后续实现的边界，不要求新增代码目录。

建议结构保持如下职责划分：

- `references/upstreams.yaml`：上游登记表
- `references/notes/<upstream-id>.md`：审阅记录和同步说明
- `references/snapshots/<upstream-id>/...`：不可变快照
- `docs/architecture/upstream-automation.md`：本规格

如果未来需要持久化 report，应优先考虑放在 `references/notes/` 作为审阅记录的一部分，而不是新增一个会混淆职责的运行时目录。

## Code Style

本规格不约束实现代码风格，但约束治理文档和输出格式风格：

- 路径、命令名、ID 使用反引号包裹
- 面向人类的结论先于机器字段
- 机器字段必须稳定、可解析、可回放
- 审阅结论必须显式标记为 `pending`, `approved`, `rejected`, 或 `needs-info`

推荐的报告段落风格：

```markdown
## Summary

- upstream: `agent-skills`
- decision: `pending-manual-review`
- impact: toolkit generation may change

## Evidence

- baseline snapshot: `references/snapshots/agent-skills/...`
- current notes: `references/notes/agent-skills.md`

## Decision

Manual review remains the final gate.
```

## Testing Strategy

Stage 1 先验证规格和 contract，再验证实现。

### Spec-level checks

- 文档能清楚回答：做什么、不做什么、谁来决定
- `diff / snapshot / report / import --dry-run` 都有可审阅输出定义
- `references`、`toolkit`、`platform` 的边界没有重叠

### Future implementation checks

- `pnpm upstream -- diff` 在不同 baseline 上输出稳定
- `pnpm upstream -- snapshot` 只追加不改写
- `pnpm upstream -- report` 在 text / json / md 间保持字段一致
- `pnpm upstream -- import --dry-run` 不产生写入副作用
- 所有写入型动作都需要人工审阅后的显式入口

## Boundaries

- Always: 保持人工审阅为最终决策；把 `references` 视为治理层；把报告和快照做成可追踪证据；把 dry-run 设计成无副作用提案
- Ask first: 任何会写入 `toolkit`、`platform` 生成产物、或新增 `references` 结构目录的变更；任何会把 report 变成默认持久化文件的变更
- Never: 让 `upstream automation` 直接改写 `packages/toolkit/**` 或 `packages/platform-*/**`；把 snapshot 设计成可编辑文件；把 dry-run 做成隐式写入；绕过人工审阅自动发布

## Success Criteria

- 仓库级 upstream 治理入口的 Stage 1 规格明确支持 `diff / snapshot / report / import --dry-run`
- 每个命令的输出都能支持人工审阅，而不是只支持机器消费
- `report` 明确展示差异、影响和审阅入口
- `import --dry-run` 明确不写入任何 toolkit/platform 产物
- `references` 的职责只覆盖 provenance、notes 和 immutable snapshots
- `toolkit` 与 `platform` 的边界清晰，upstream automation 不成为第三种写入源

## Open Questions

- `report` 是否需要固定落盘目录，还是只在需要归档时写入 `references/notes/`？
- `diff` 的默认 baseline 是“最新 snapshot”还是“显式指定基线”？
- `import --dry-run` 的候选输入是否仅限 `references` 中已有 upstream，还是允许外部临时文件作为输入源？
