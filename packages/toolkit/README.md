# @zmice/toolkit

`@zmice/toolkit` 是整个仓库的内容事实源，负责维护：

- `skills`
- `commands`
- `agents`

任何面向 AI 的内容改动，默认都应先落到这里，而不是平台包或根目录。

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

仓库中的内容命名拆成三层：

- `source identity`
  - 对齐 upstream 原始对象
- `workspace identity`
  - 本仓库内部稳定 id
- `display title`
  - 面向用户展示的中文标题

不要为了显示名称去破坏 `source.origin_*` 与 upstream 的对应关系。

## 修改规则

- 内容源码只改 `src/content/`
- 不要把平台产物当成内容真相回写
- 不要跳过 lint 直接改大量正文
- 优先保持关系图、来源映射和正文结构同步更新

## 常用命令

```bash
pnpm --dir packages/toolkit test
pnpm --dir packages/toolkit build

node ../../apps/cli/dist/cli/index.js toolkit lint --json
node ../../apps/cli/dist/cli/index.js toolkit show <id>
node ../../apps/cli/dist/cli/index.js toolkit search <keyword>
node ../../apps/cli/dist/cli/index.js toolkit recommend <id>
```

## 与其他层的关系

- `apps/cli` 读取 toolkit，但不拥有内容
- `packages/platform-*` 消费 toolkit 生成平台产物
- `references` 记录上游治理信息，但不是运行时输入

## 进一步阅读

- `docs/architecture/toolkit-content-optimization.md`
- `docs/architecture/toolkit-naming-and-source-identity.md`
- `references/upstreams.yaml`
