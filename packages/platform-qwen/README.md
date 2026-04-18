# @zmice/platform-qwen

`@zmice/platform-qwen` 把 `@zmice/toolkit` 的结构化内容渲染成 Qwen 平台可安装的产物。

当前输出包括：

- `QWEN.md`
- `qwen-extension.json`

## 边界

- 内容真相仍在 `@zmice/toolkit`
- 本包只负责 Qwen 平台表达、模板渲染和安装计划
- 不直接参与 upstream 治理

## 常用用法

```bash
zc platform generate qwen -o /tmp/qwen-out
zc platform generate qwen --plan --format json
zc platform install qwen
zc platform install qwen -o <dir>
```

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

## 验证

```bash
pnpm --dir packages/platform-qwen test
pnpm --dir packages/platform-qwen build
pnpm --dir packages/platform-qwen verify
```
