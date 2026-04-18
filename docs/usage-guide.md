# Usage Guide

这份文档回答 3 类高频问题：

1. 如何在本仓库内使用 `zc`
2. 如何把 `zc` 安装到本机并更新
3. 如何把 toolkit 内容安装到不同 AI 平台的项目目录或全局目录

## 1. 在仓库内使用 `zc`

第一次使用前：

```bash
pnpm install
pnpm build
```

之后可直接运行：

```bash
node apps/cli/dist/cli/index.js --help
node apps/cli/dist/cli/index.js toolkit lint --json
node apps/cli/dist/cli/index.js platform install codex --plan --format json
```

适用场景：

- 正在开发本仓库
- 不想污染本机全局命令
- 需要和当前源码保持完全一致

## 2. 把 `zc` 安装到本机

当前仓库内最稳的做法是使用本地 global link，而不是依赖外部 registry。

### 安装到本机

```bash
pnpm install
pnpm --dir apps/cli build
pnpm --dir apps/cli link --global
zc --help
```

说明：

- `apps/cli` 会生成 `dist/cli/index.js`
- `pnpm --dir apps/cli link --global` 会把本地构建好的 `zc` 挂到全局命令

### 更新本机安装

仓库更新后，重新执行：

```bash
pnpm install
pnpm --dir apps/cli build
pnpm --dir apps/cli link --global
```

如果只是想确认更新后的命令是否可用：

```bash
zc --version
zc --help
```

### 不走全局命令时的替代方式

如果不想全局 link，可以继续用仓库内入口：

```bash
node apps/cli/dist/cli/index.js <subcommand>
```

## 3. 给不同 AI 平台安装内容

`zc platform install <target>` 支持两种模式：

- 项目安装
  - 不传 `-o`
  - 默认自动解析最近项目根
- 全局安装
  - 显式传 `-o <dir>`
  - 由你指定目标 AI 工具的全局配置目录

### 产物矩阵

| 平台 | 产物 |
| --- | --- |
| `codex` | `AGENTS.md` |
| `qoder` | `instructions.md` |
| `qwen` | `QWEN.md`、`qwen-extension.json` |

### 3.1 项目安装

进入目标项目目录后直接运行：

```bash
cd /path/to/project
zc platform install codex
zc platform install qoder
zc platform install qwen
```

说明：

- 不传 `-o` 时，CLI 会优先向上寻找最近项目根标记：
  - `.git`
  - `pnpm-workspace.yaml`
  - `package.json`
- 找不到项目根时，才回退到当前工作目录

适合：

- 给某个单独项目安装平台说明
- 不希望影响同一台机器上的其他项目

### 3.2 全局安装

全局安装时，显式指定对应工具的全局配置目录：

```bash
zc platform install codex -o <codex-global-root>
zc platform install qoder -o <qoder-global-root>
zc platform install qwen -o <qwen-global-root>
```

说明：

- 仓库不会替你猜测各工具的全局目录
- 全局目录由你根据本机工具实际配置决定
- 安装行为本质上是把平台产物写入你指定的目录

适合：

- 希望多个项目复用同一套平台入口文件
- 已经明确知道目标工具的全局配置目录

## 4. 安装前先预演

推荐先看计划，再决定是否真的落盘：

```bash
zc platform install codex --plan
zc platform install qoder --plan --format json
zc platform install qwen -o /tmp/qwen-global --plan --format json
```

说明：

- `--plan` 只输出计划，不写文件
- `--format json` 适合脚本消费

## 5. 冲突与覆盖

默认策略是安全模式：

- 目标文件不存在：直接创建
- 目标文件相同：记为未变更
- 目标文件不同：报冲突并停止

如果确认需要覆盖，显式追加：

```bash
zc platform install codex -o <target-dir> --force
```

## 6. 上游治理入口

上游治理不是 `zc` 的公开产品能力，而是仓库级脚本入口：

```bash
pnpm upstream -- list
pnpm upstream -- diff agent-skills
pnpm upstream -- report all --format md
```

如果脚本提示缺少 `dist`，先运行：

```bash
pnpm build
```

## 7. 常见验证

### 验证 CLI 自身

```bash
pnpm --dir apps/cli test
pnpm --dir apps/cli build
```

### 验证 workspace

```bash
pnpm verify
```

### 验证平台安装计划

```bash
zc platform install codex --plan
zc platform install qoder --plan
zc platform install qwen --plan
```
