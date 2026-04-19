# @zmice/toolkit

`@zmice/toolkit` 是整个仓库的内容事实源。

它维护三类资产：

- `skills`
- `commands`
- `agents`

任何面向 AI 的内容改动，默认都应先落到这里，而不是平台包或根目录入口文件。

## 内容模型

每个资产目录使用：

- `meta.yaml`
- `body.md`
- 可选 `assets/`

关键治理字段包括：

- `tier`
- `audience`
- `stability`
- `source`
- `requires / suggests / conflicts_with / supersedes`

## 命名模型

内容命名拆成三层：

- `source identity`
  - 对齐 upstream 原始对象
- `workspace identity`
  - 本仓库内部稳定 id
- `display title`
  - 面向用户展示的标题，当前默认中文优先

不要为了显示名去破坏 `source.origin_*` 与 upstream 的映射关系。

## 修改规则

- 内容源码只改 `src/content/`
- 不把平台产物回写成内容真相
- 内容改动默认配套更新治理字段和关系图
- 不要破坏 `source.upstream` 与 `references/upstreams.yaml` 的一致性

## 查询能力

当前 `zc toolkit` 支持：

- `lint`
- `show`
- `search`
- `recommend`

`<query>` 同时支持：

- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

当前 `toolkit recommend` 已能返回：

- workflow family
- workflow role
- 推荐起始入口

## 内容层入口模型

当前统一任务开始入口在内容层，不在 CLI 层：

- `command:start`
- `command:product-analysis`

需要注意：

- `command:start` 是 canonical command，不是现成的 `zc start`
- `command:product-analysis` 是 `product-analysis` workflow 的默认入口
- `command:sdd-tdd` 只负责 `full-delivery` workflow

## 与其他层的关系

- `apps/cli` 读取 toolkit，但不拥有内容
- `packages/platform-*` 消费 toolkit 生成平台产物
- `references` 只做上游治理，不作为运行时内容真相

## 常用命令

```bash
pnpm --dir packages/toolkit test
pnpm --dir packages/toolkit build

node ../../apps/cli/dist/cli/index.js toolkit lint --json
node ../../apps/cli/dist/cli/index.js toolkit show <query>
node ../../apps/cli/dist/cli/index.js toolkit search <keyword>
node ../../apps/cli/dist/cli/index.js toolkit recommend <query>
```

## 进一步阅读

- [../../docs/architecture/toolkit-content-optimization.md](../../docs/architecture/toolkit-content-optimization.md)
- [../../docs/architecture/toolkit-naming-and-source-identity.md](../../docs/architecture/toolkit-naming-and-source-identity.md)
- [../../docs/architecture/workflow-entry-routing.md](../../docs/architecture/workflow-entry-routing.md)
