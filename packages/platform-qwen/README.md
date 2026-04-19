# @zmice/platform-qwen

`@zmice/platform-qwen` 把 `@zmice/toolkit` 的结构化内容渲染成 Qwen 平台可安装的产物。

它是 **仓库内部包**，公开分发入口统一由 `@zmice/zc` 提供。

当前输出包括：

- `QWEN.md`
- `qwen-extension.json`
- `commands/zc/<command>.md`
- `skills/zc-<skill>/SKILL.md`
- `agents/zc-<agent>.md`

## 边界

- 内容真相仍在 `@zmice/toolkit`
- 本包只负责 Qwen 平台表达、模板渲染和安装计划
- 不直接参与 upstream 治理

## 常用用法

```bash
zc platform generate qwen --dir /tmp/qwen-out
zc platform generate qwen --plan --json
zc platform install qwen
zc platform install qwen --global
zc platform install qwen --dir <dir>
zc platform where qwen --global --json
```

项目安装 / 全局安装的详细步骤见：

- `docs/usage-guide.md`

当前安装模型：

- `--project`
  - 安装 `<project>/.qwen/extensions/zc-toolkit/QWEN.md`
  - 安装 `<project>/.qwen/extensions/zc-toolkit/qwen-extension.json`
  - 安装 `<project>/.qwen/extensions/zc-toolkit/commands/zc/<command>.md`
  - 安装 `<project>/.qwen/extensions/zc-toolkit/skills/zc-<skill>/SKILL.md`
  - 安装 `<project>/.qwen/extensions/zc-toolkit/agents/zc-<agent>.md`
- `--global`
  - 优先通过官方 `qwen extensions` CLI 管理 `zc-toolkit`
  - CLI 会先生成发布态 bundle：
    - `~/.qwen/.zc/platform-bundles/qwen/zc-toolkit/`
  - 再通过官方命令接入该 bundle
  - 实际扩展目录仍位于 `~/.qwen/extensions/zc-toolkit/`
  - 其中包含 `QWEN.md`、带 `version` 的 `qwen-extension.json`、`commands/zc/<command>.md`、`skills/zc-<skill>/SKILL.md`、`agents/zc-<agent>.md`
  - 如需导出独立发布态 bundle：
    - `zc platform generate qwen --bundle release-bundle --dir /tmp/zc-toolkit`
- `--dir <path>`
  - 安装 `<path>/extensions/zc-toolkit/...`

如果本机没有 `qwen` 命令，CLI 会明确提示并回退为直接写入官方扩展目录。

命名空间规则：

- 统一语义通过 `zc:*` namespaced command 承接
- workflow / 专项 skill 使用 `zc-<skill>` 目录名
- 不会把裸名字如 `start`、`spec`、`build` 直接暴露给 Qwen
- 例如：
  - `zc:start -> zc:start`
  - `zc:product-analysis -> zc:product-analysis`
  - `zc:sdd-tdd -> zc:sdd-tdd`

## 验证

```bash
pnpm --dir packages/platform-qwen test
pnpm --dir packages/platform-qwen build
pnpm --dir packages/platform-qwen verify
```
