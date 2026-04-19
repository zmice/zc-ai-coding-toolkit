# @zmice/platform-core

`@zmice/platform-core` 提供平台生成与安装的共享 contract，避免 `platform-qwen`、`platform-codex`、`platform-claude`、`platform-opencode` 各自重复实现。

它是 **仓库内部包**，用于保持平台逻辑分层，不作为公开安装入口单独发布。

当前主要负责：

- artifact plan
- install plan
- overwrite / conflict policy
- 平台共享 helper

## 设计边界

- 不维护任何 prompt 内容
- 不感知具体 upstream 治理逻辑
- 只定义平台包共享的生成/安装语义

## 适用场景

当你在处理下面这些问题时，应优先看这个包：

- 多个平台共享的安装冲突处理
- `--plan` / `--json` 的统一输出模型
- artifact 写入策略

## 验证

```bash
pnpm --dir packages/platform-core test
pnpm --dir packages/platform-core build
```
