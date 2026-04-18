# @zmice/platform-qoder

`@zmice/platform-qoder` 把 `@zmice/toolkit` 的结构化内容渲染成 Qoder 平台所需产物。

当前输出包括：

- `AGENTS.md`

## 边界

- 内容仍由 `@zmice/toolkit` 维护
- 本包只处理 Qoder 平台模板、安装计划和落盘策略
- 不负责 upstream 审阅、snapshot 或导入提案

## 常用用法

```bash
zc platform install qoder
zc platform install qoder --scope global
zc platform install qoder --plan --format json
```

省略 `-o` 时，CLI 会优先把最近项目根解析为安装目录。

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## 验证

```bash
pnpm --dir packages/platform-qoder test
pnpm --dir packages/platform-qoder build
pnpm --dir packages/platform-qoder verify
```
