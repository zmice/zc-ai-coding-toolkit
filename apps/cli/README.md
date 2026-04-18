# @zmice/zc

`@zmice/zc` 是 AI Coding Toolkit 的统一入口 CLI，负责两类能力：

- runtime：多 AI CLI 协作运行时
- workspace-facing product commands：`toolkit` 与 `platform`

它不负责当前仓库的治理型事务。像 upstream 审阅、snapshot、report、导入提案这类仓库自管理能力，统一通过根级脚本：

```bash
pnpm upstream -- <subcommand>
```

## 命令面

当前公开命令主要包括：

- `zc team ...`
- `zc task ...`
- `zc msg ...`
- `zc doctor ...`
- `zc run ...`
- `zc toolkit ...`
- `zc platform ...`

## 高频命令

```bash
# toolkit
zc toolkit lint --json
zc toolkit show build
zc toolkit search review
zc toolkit recommend build

# platform
zc platform generate qwen --plan --json
zc platform install codex --plan --json
zc platform install qoder
zc platform install codex --global
zc platform where qoder --global --json
```

## 安装与更新

在本仓库内：

```bash
pnpm install
pnpm --dir apps/cli build
node apps/cli/dist/cli/index.js --help
```

安装到本机全局命令：

```bash
pnpm install
pnpm --dir apps/cli build
pnpm --dir apps/cli link --global
zc --help
```

更新时重复执行：

```bash
pnpm install
pnpm --dir apps/cli build
pnpm --dir apps/cli link --global
```

平台内容按“项目安装 / 全局安装”的详细说明见：

- `docs/usage-guide.md`

## 设计边界

- `zc` 发现并消费 `packages/toolkit/src/content`，但不拥有 prompt 内容
- `zc` 调用 `packages/platform-*` 完成平台产物生成和安装
- `zc` 不承载仓库内 upstream 治理命令，避免产品 CLI 和仓库管理脚本混在一起

## 开发与验证

```bash
pnpm --dir apps/cli test
pnpm --dir apps/cli build
pnpm --dir apps/cli verify
```

修改 `apps/cli` 时，优先阅读：

- `apps/cli/src/cli/`
- `apps/cli/src/runtime/`
- `apps/cli/src/team/`
