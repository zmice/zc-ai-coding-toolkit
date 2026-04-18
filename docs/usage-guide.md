# Usage Guide

这份文档回答 4 类高频问题：

1. 如何在本仓库内使用 `zc`
2. 如何把 `zc` 安装到本机并更新
3. 各 AI 工具官方推荐的安装 / 更新方式是什么
4. 如何把 toolkit 内容安装到不同 AI 平台的项目目录或全局目录

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
node apps/cli/dist/cli/index.js platform install codex --plan --json
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

## 3. AI 工具官方安装与更新

这一节只记录官方文档已经明确写出的安装 / 更新方式。

### Codex CLI

官方来源：

- OpenAI Help Center
  https://help.openai.com/en/articles/11096431-openai-codex-ligetting-started
- OpenAI Codex 仓库配置说明
  https://github.com/openai/codex/blob/main/docs/config.md
- OpenAI Introducing Codex
  https://openai.com/index/introducing-codex/

安装：

```bash
npm install -g @openai/codex
```

更新：

```bash
codex --upgrade
```

### Qoder CLI

官方来源：

- Qoder CLI Quick Start
  https://docs.qoder.com/cli/quick-start
- Qoder Using CLI
  https://docs.qoder.com/cli/using-cli

安装：

```bash
curl -fsSL https://qoder.com/install | bash
# 或
brew install qoderai/qoder/qodercli --cask
# 或
npm install -g @qoder-ai/qodercli
```

更新：

```bash
qodercli update
# 或重新执行官方安装命令
```

### Qwen Code

官方来源：

- 阿里云帮助中心：安装与配置 Qwen Code
  https://help.aliyun.com/zh/model-studio/qwen-code
- 阿里云帮助中心：Qwen Code Coding Plan
  https://help.aliyun.com/zh/model-studio/qwen-code-coding-plan

安装：

```bash
# macOS / Linux
bash -c "$(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh)" -s --source bailian
```

更新：

```bash
npm install -g @qwen-code/qwen-code@latest
```

## 4. 给不同 AI 平台安装内容

`zc platform install <target>` 支持三种安装目标声明方式：

- 项目安装
  - 不传参数，或显式传 `--project`
  - 默认自动解析最近项目根
- 全局安装
  - 显式传 `--global`
  - 仅在官方文档明确给出默认位置时自动解析
  - 若官方文档未明确，CLI 会拒绝猜测并要求你显式传 `--dir`
- 自定义目录安装
  - 显式传 `--dir <path>`
  - 直接安装到指定目录，不再做路径猜测

### 产物矩阵

| 平台 | 产物 |
| --- | --- |
| `codex` | `AGENTS.md` |
| `qoder` | `AGENTS.md` |
| `qwen` | `QWEN.md`、`qwen-extension.json` |

### 官方默认位置矩阵

| 平台 | 项目级默认位置 | 全局级默认位置 | 说明 |
| --- | --- | --- | --- |
| `codex` | `<project-root>/AGENTS.md` | `~/AGENTS.md` | OpenAI 官方说明将 `~` 和 Git 仓库都列为 `AGENTS.md` 的典型位置。这里的全局路径是基于官方说明做的直接映射 |
| `qoder` | `<project-root>/AGENTS.md` | `~/.qoder/AGENTS.md` | Qoder 官方文档明确给出 user-level 与 project-level memory 路径 |
| `qwen` | `<project-root>/QWEN.md` | 无官方默认全局 `QWEN.md` 路径 | 官方文档明确 `/init` 会在项目目录创建 `QWEN.md`，并明确用户级配置文件为 `~/.qwen/settings.json` |

### 4.1 项目安装

进入目标项目目录后直接运行：

```bash
cd /path/to/project
zc platform install codex
zc platform install qoder
zc platform install qwen
# 或显式声明
zc platform install codex --project
```

说明：

- 不传 `--dir` 时，CLI 会优先向上寻找最近项目根标记：
  - `.git`
  - `pnpm-workspace.yaml`
  - `package.json`
- 找不到项目根时，才回退到当前工作目录

适合：

- 给某个单独项目安装平台说明
- 不希望影响同一台机器上的其他项目

### 4.2 全局安装

对于已在官方文档中明确给出默认位置的平台，可以直接这样装：

```bash
zc platform install codex --global
zc platform install qoder --global
zc platform where codex --global
zc platform where qoder --global --json
```

当前行为：

- `codex --global`
  - 默认安装到 `~/AGENTS.md`
- `qoder --global`
  - 默认安装到 `~/.qoder/AGENTS.md`
- `qwen --global`
  - CLI 会报错并提示显式传 `--dir`
  - 原因是官方文档没有给出全局 `QWEN.md` 默认位置

如果你已经明确知道目标工具的自定义全局目录，也可以继续显式指定：

```bash
zc platform install codex --dir <codex-global-root>
zc platform install qoder --dir <qoder-global-root>
zc platform install qwen --dir <qwen-global-root>
```

### 4.3 安装前先预演

推荐先看计划，再决定是否真的落盘：

```bash
zc platform install codex --plan
zc platform install codex --global --plan
zc platform install qoder --plan --json
zc platform install qwen --dir /tmp/qwen-global --plan --json
zc platform where codex --global
```

说明：

- `--plan` 只输出计划，不写文件
- `--json` 输出结构化结果，适合脚本消费
- `platform where` 只解析目录和来源，不执行写入

## 5. 冲突与覆盖

默认策略是安全模式：

- 目标文件不存在：直接创建
- 目标文件相同：记为未变更
- 目标文件不同：报冲突并停止

如果确认需要覆盖，显式追加：

```bash
zc platform install codex --dir <target-dir> --force
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
zc platform install codex --global --plan
zc platform install qoder --plan
zc platform install qwen --plan
```
