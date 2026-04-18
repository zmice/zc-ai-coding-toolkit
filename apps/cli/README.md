# @zmice/zc

`@zmice/zc` 是 AI Coding Toolkit 的统一入口 CLI。

它负责两类稳定能力：
- runtime：启动单工人或团队协作运行时
- product commands：查询 `toolkit` 内容、生成/安装 `platform` 产物

它**不负责**仓库治理型事务。像 upstream 审阅、snapshot、report、导入提案这类能力，统一通过根级脚本：

```bash
pnpm upstream -- <subcommand>
```

## 适用场景

你通常会在下面几种情况下使用 `zc`：
- 想直接启动一个 AI CLI 工人执行任务：`zc run`
- 想启动一组 worker 并做任务编排：`zc team ...`
- 想查询 toolkit 里的 skills / commands / agents：`zc toolkit ...`
- 想把内容安装到 Codex / Qoder / Qwen：`zc platform ...`

## 快速开始

在仓库内开发：

```bash
pnpm install
pnpm build
node apps/cli/dist/cli/index.js --help
```

本地开发态安装到本机全局命令：

```bash
pnpm install
pnpm build
pnpm --dir apps/cli link --global
zc --help
```

安装公开发布包：

```bash
npm install -g @zmice/zc
zc --help
```

更新时重复执行：

```bash
pnpm install
pnpm build
pnpm --dir apps/cli link --global
```

如果使用 registry 安装：

```bash
npm install -g @zmice/zc@latest
```

完整安装、更新、平台内容安装说明见：

- [`docs/usage-guide.md`](../docs/usage-guide.md)

## 命令分层

### Runtime

- `zc run`
- `zc team ...`
- `zc task ...`
- `zc msg ...`
- `zc doctor`

### Toolkit

- `zc toolkit lint`
- `zc toolkit show <query>`
- `zc toolkit search <keyword>`
- `zc toolkit recommend <query>`

`<query>` 同时支持：
- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

`toolkit recommend` 现在会返回 route-aware 信息：
- workflow 家族
- workflow 角色
- 推荐起始入口

### Platform

- `zc platform generate <qwen|codex|qoder>`
- `zc platform install <qwen|codex|qoder>`
- `zc platform status <qwen|codex|qoder>`
- `zc platform update <qwen|codex|qoder>`
- `zc platform where <qwen|codex|qoder>`

常用安装目标参数：
- `--project`
- `--global`
- `--dir <path>`

常用输出参数：
- `--plan`
- `--json`
- `--force`

## 高频用法

```bash
# toolkit
zc toolkit lint --json
zc toolkit show build
zc toolkit search review
zc toolkit recommend build
zc toolkit recommend start

# platform
zc platform generate qwen --plan --json
zc platform install codex --plan --json
zc platform install qoder
zc platform install codex --global
zc platform install qwen --global
zc platform status codex --global --json
zc platform update codex --global --plan --json
zc platform where qoder --global --json
zc platform where qwen --global --json
```

## 设计边界

- `zc` 发现并消费 `packages/toolkit/src/content`，但不拥有 prompt 内容
- `zc` 调用 `packages/platform-*` 完成平台产物生成和安装
- `zc` 不承载仓库内 upstream 治理命令
- `zc` 的公开命令面只保留实际产品能力，不保留历史重复入口
- 公开发布时只发布 `@zmice/zc`；内部 `toolkit/platform-*` 能力会随 `zc` 一起打包

## 开发者入口

如果你要修改 `zc` 本身，优先看：
- `apps/cli/src/cli/`
- `apps/cli/src/runtime/`
- `apps/cli/src/team/`

尤其常改的命令文件：
- `apps/cli/src/cli/index.ts`
- `apps/cli/src/cli/toolkit.ts`
- `apps/cli/src/cli/platform.ts`
- `apps/cli/src/cli/team.ts`
- `apps/cli/src/cli/run.ts`

## 开发与验证

```bash
pnpm --dir apps/cli test
pnpm --dir apps/cli build
pnpm --dir apps/cli verify
```
