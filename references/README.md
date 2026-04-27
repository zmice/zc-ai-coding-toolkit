# References Governance Layer

`references/` 是仓库的上游治理层，用来回答三件事：

- 内容从哪里来
- 上游发生了什么变化
- 哪些变化已经被人工审阅

它不是：

- runtime 输入
- `zc` 的产品命令面
- 内容事实源

## 目录结构

- `references/upstreams.yaml`
  - 已登记 upstream 的权威清单
- `references/notes/`
  - 可编辑的审阅记录、同步说明、开放问题
- `references/snapshots/`
  - 不可变的 baseline 和观察快照

## 操作入口

上游治理通过仓库级脚本运行：

```bash
pnpm upstream -- list
pnpm upstream -- diff agent-skills
pnpm upstream -- snapshot agent-skills --label baseline
pnpm upstream -- report all --format md
pnpm upstream -- import agent-skills --dry-run
```

需要把当前远端 HEAD 纳入审阅证据时，显式追加 `--with-remote`：

```bash
pnpm upstream -- report all --format md --with-remote
pnpm upstream -- snapshot agent-skills --label remote-review --with-remote
```

默认不访问网络，以保证本地审阅、CI 和快照生成可重复。

## 规则

- 先把变化记录到 `references`，再决定是否吸收到 `packages/toolkit`
- `notes` 可以修改，`snapshots` 只追加不改写
- 影响 `toolkit`、平台产物或发布面的变化必须走人工审阅

## 进一步阅读

- [../docs/architecture/upstream-automation.md](../docs/architecture/upstream-automation.md)
- [../docs/architecture/toolkit-naming-and-source-identity.md](../docs/architecture/toolkit-naming-and-source-identity.md)
