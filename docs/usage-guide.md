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

对外只发布 `@zmice/zc`。`toolkit` 和 `platform-*` 是仓库内部包，安装 `zc` 时不需要单独安装它们。

### 从 registry 安装

```bash
npm install -g @zmice/zc
zc --help
```

更新：

```bash
npm install -g @zmice/zc@latest
```

### 仓库开发态安装到本机

```bash
pnpm setup
# 重新打开终端，或 source 你的 shell rc
pnpm install
pnpm build
pnpm --dir apps/cli link --global
zc --help
```

说明：

- `apps/cli` 会生成 `dist/cli/index.js` 和 `vendor/`
- `pnpm --dir apps/cli link --global` 会把本地构建好的 `zc` 挂到全局命令
- `pnpm --dir apps/cli link --global` 依赖 pnpm 的全局 bin 目录，因此第一次使用前要先执行一次 `pnpm setup`
- 如果报 `ERR_PNPM_NO_GLOBAL_BIN_DIR`，说明当前 shell 里还没有可用的 `PNPM_HOME`
- 这种情况下：
  - 先执行 `pnpm setup`
  - 重新打开终端，或重新加载 shell 配置
  - 再重新运行 `pnpm --dir apps/cli link --global`
- 如果你只是正常使用 `zc`，更推荐直接使用 `npm install -g @zmice/zc`

### 更新仓库开发态安装

仓库更新后，重新执行：

```bash
pnpm install
pnpm build
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

如果只是临时验证 CLI，也可以优先用这条方式，避免受本机 pnpm 全局配置影响。

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
| `codex` | `AGENTS.md`、`skills/zc-<skill>/SKILL.md` |
| `qoder` | `AGENTS.md`、`.qoder/commands`、`.qoder/skills`、`.qoder/agents` |
| `qwen` | `.qwen/extensions/zc-toolkit/` 下的 `QWEN.md`、`qwen-extension.json`、`commands/`、`skills/`、`agents/` |

### 官方默认位置矩阵

| 平台 | 项目级默认位置 | 全局级默认位置 | 说明 |
| --- | --- | --- | --- |
| `codex` | `<project-root>/AGENTS.md` | `~/.codex/AGENTS.md` | OpenAI 官方文档将 Codex home（默认 `~/.codex`）作为全局级 `AGENTS.md` 位置 |
| `qoder` | `<project-root>/AGENTS.md` | `~/.qoder/AGENTS.md` | Qoder 官方文档明确给出 user-level 与 project-level memory 路径 |
| `qwen` | `<project-root>/QWEN.md` | `~/.qwen/QWEN.md` | 官方文档明确 `/init` 会在项目目录创建 `QWEN.md`，并明确用户级配置目录为 `~/.qwen`；阿里云官方帮助文档同时给出了 Qwen CLI 的用户级 `QWEN.md` 位置 |

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

当前项目安装目录结构：

- `codex`
  - `<project>/AGENTS.md`
- `qoder`
  - `<project>/AGENTS.md`
  - `<project>/.qoder/commands/zc-<command>.md`
  - `<project>/.qoder/skills/zc-<skill>/SKILL.md`
  - `<project>/.qoder/agents/zc-<agent>.md`
- `qwen`
  - `<project>/.qwen/extensions/zc-toolkit/QWEN.md`
  - `<project>/.qwen/extensions/zc-toolkit/qwen-extension.json`
  - `<project>/.qwen/extensions/zc-toolkit/commands/zc/<command>.md`
  - `<project>/.qwen/extensions/zc-toolkit/skills/zc-<skill>/SKILL.md`
  - `<project>/.qwen/extensions/zc-toolkit/agents/zc-<agent>.md`

### 4.2 全局安装

对于已在官方文档中明确给出默认位置的平台，可以直接这样装：

```bash
zc platform install codex --global
zc platform install qoder --global
zc platform install qwen --global
zc platform status codex --global --json
zc platform update codex --global --plan --json
zc platform where codex --global
zc platform where qoder --global --json
zc platform where qwen --global --json
```

当前行为：

- `codex --global`
  - 默认安装到 `~/.codex/AGENTS.md`
  - 同时安装 `~/.codex/skills/zc-<skill>/SKILL.md`
- `qoder --global`
  - 默认安装到 `~/.qoder/AGENTS.md`
  - 同时安装 `~/.qoder/commands/zc-<command>.md`
  - 同时安装 `~/.qoder/skills/zc-<skill>/SKILL.md`
  - 同时安装 `~/.qoder/agents/zc-<agent>.md`
- `qwen --global`
  - 默认安装到 `~/.qwen/extensions/zc-toolkit/`
  - 其中包含 `QWEN.md`、`qwen-extension.json`、`commands/`、`skills/`、`agents/`

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
zc platform install qwen --global --plan --json
zc platform where codex --global
```

说明：

- `--plan` 只输出计划，不写文件
- `--json` 输出结构化结果，适合脚本消费
- install 成功后会在目标根目录写入 `.zc/platform-state/<platform>.install-receipt.json`
- `platform status` 只读取 receipt 和当前 plan，不写盘
- `platform update` 会基于 receipt 判断是否需要更新：
  - `not-installed`：提示先 install
  - `up-to-date`：直接返回无需更新
  - `update-available`：安全覆盖受 `zc` 管理的旧产物
  - `drifted`：要求显式追加 `--force`
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
