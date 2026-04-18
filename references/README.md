# References Governance Layer

`references/` 是仓库的上游治理层，用来回答三件事：

- 内容从哪里来
- 观察到了什么变化
- 哪些变化已经被人工审阅

它不是 runtime 输入，也不是 `zc` 的产品能力。

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

## 规则

- 先把变化记录到 `references`，再决定是否吸收到 `packages/toolkit`
- `notes` 可以修改，`snapshots` 只追加不改写
- 对 `toolkit`、平台产物或发布面有影响的变化必须走人工审阅
