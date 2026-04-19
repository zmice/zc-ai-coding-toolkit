# Project Context Map

这份文档是项目级上下文索引，用于在开始任务时快速装载相关上下文，而不是把整个仓库一次性塞进会话。

## 推荐读取顺序

1. 先读根目录 `AGENTS.md`
2. 再按任务类型读取一个局部入口
3. 最后只读本次会修改的源码和测试文件

## 任务入口

### CLI / Runtime / Operator

读取：

- `apps/cli/README.md`
- `apps/cli/src/cli/`
- `apps/cli/src/runtime/`
- `apps/cli/src/team/`

适用任务：

- `zc run`
- `zc team`
- `zc toolkit`
- `zc platform`

### Toolkit 内容与治理

读取：

- `packages/toolkit/README.md`
- `packages/toolkit/src/content/`
- `packages/toolkit/src/content-lint.ts`
- `packages/toolkit/src/query.ts`

适用任务：

- 调整 skills / commands / agents
- 补元数据、关系图、来源映射
- 优化 search / show / recommend
- 收口 workflow entry routing 文档与内容边界

额外边界：

- `command:start` 是 toolkit 内容入口，不是当前已实现的 `zc start`
- `command:start` 当前负责在 6 条固定 workflow 中做任务分流：
  - `product-analysis`
  - `full-delivery`
  - `bugfix`
  - `review-closure`
  - `docs-release`
  - `investigation`
- `command:product-analysis` 是 `product-analysis` 的独立 workflow-entry
- `sdd-tdd` 只是 `full-delivery` 的默认 workflow-entry，不是统一分诊入口
- Codex 按 `prompt-entry` / 自然语言入口理解
- Qwen / Claude / OpenCode 当前只按各自平台的命令式或目录化暴露理解，不假定完全同构

### Platform 适配与安装

读取：

- `packages/platform-core/README.md`
- `packages/platform-qwen/README.md`
- `packages/platform-codex/README.md`
- `packages/platform-claude/README.md`
- `packages/platform-opencode/README.md`

适用任务：

- 平台生成器
- 安装计划
- 平台模板

### Upstream 治理

读取：

- `references/README.md`
- `references/upstreams.yaml`
- `references/notes/<id>.md`
- `references/snapshots/<id>/`

适用任务：

- baseline snapshot
- diff / report / import --dry-run
- provenance 和上游映射检查
- 通过 `pnpm upstream -- <subcommand>` 运行仓库级治理命令

## 关键长期文档

- `docs/architecture/monorepo-layers.md`
  - 看分层和 ownership
- `docs/architecture/toolkit-content-optimization.md`
  - 看内容优化主线
- `docs/architecture/workflow-entry-routing.md`
  - 看 6 条固定 workflow、统一任务入口、canonical command 与平台暴露分离、以及当前没有 `zc start` CLI 的边界
- `docs/architecture/toolkit-naming-and-source-identity.md`
  - 看命名与上游身份映射规则
- `docs/architecture/platform-deepening.md`
  - 看平台能力边界
- `docs/architecture/platform-capability-matrix.md`
  - 看各平台官方支持的安装面，以及当前 entry-file install 与后续 directory / extension install 的边界
- `docs/architecture/release-versioning.md`
  - 看发布和版本策略
- `docs/architecture/upstream-automation.md`
  - 看上游治理自动化边界
- `docs/README.md`
  - 看 `docs/` 本身的职责边界

## 最小上下文包

### 改一个 CLI 子命令

只读：

- `AGENTS.md`
- `apps/cli/README.md`
- 目标命令文件
- 对应测试文件

### 改一个 toolkit 资产

只读：

- `AGENTS.md`
- `packages/toolkit/README.md`
- 目标资产目录下的 `meta.yaml` 和 `body.md`
- `packages/toolkit/src/content-lint.ts`
- 相关查询/测试文件

### 做上游同步分析

只读：

- `AGENTS.md`
- `references/README.md`
- `references/upstreams.yaml`
- 对应 `notes` 和最近 baseline snapshot

## 上下文装载反模式

- 不要先读整个 `docs/architecture`
- 不要一次性展开整个 `packages/toolkit/src/content`
- 不要把 `references/snapshots` 全量塞进会话
- 不要把 generated/dist 文件当作源码真相
