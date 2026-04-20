# Usage Guide

这份文档按两类人来组织：

1. 普通使用者：怎么安装 `zc`、怎么给平台安装内容、怎么更新和诊断
2. 仓库维护者：怎么在仓库里运行 `zc`、怎么导出 bundle、怎么对齐官方能力

如果你只是想使用 `zc`，优先看：

- `2. 把 zc 安装到本机`
- `4. 给不同 AI 平台安装内容`

如果你正在维护这个仓库，再看：

- `1. 在仓库内使用 zc`
- `3. AI 工具官方安装与更新`

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

## 2.1 普通使用者最短路径

```bash
npm install -g @zmice/zc
zc platform install codex --global
zc platform status codex --global --json
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

### Claude Code

官方来源：

- Claude Code memory
  https://docs.anthropic.com/en/docs/claude-code/memory
- Claude Code slash commands
  https://docs.anthropic.com/en/docs/claude-code/slash-commands
- Claude Code sub-agents
  https://docs.anthropic.com/en/docs/claude-code/sub-agents

说明：

- 这一节只记录自定义内容目录模型
- 安装 Claude Code CLI 本身应以 Anthropic 官方最新安装页为准

### OpenCode

官方来源：

- OpenCode intro / install
  https://opencode.ai/docs/
- OpenCode rules
  https://opencode.ai/docs/rules/
- OpenCode commands
  https://opencode.ai/docs/commands/
- OpenCode skills
  https://opencode.ai/docs/skills
- OpenCode agents
  https://opencode.ai/docs/agents/

安装：

```bash
curl -fsSL https://opencode.ai/install | bash
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

### 4.0 命名空间适配规则

`toolkit` 内部维护的是统一语义，例如：

- `zc:start`
- `zc:product-analysis`
- `zc:sdd-tdd`
- `zc:spec`
- `zc:task-plan`
- `zc:build`

安装到不同平台后，会按平台能力做适配，而不是原样暴露：

| 平台 | 安装后的入口形式 | 示例 |
| --- | --- | --- |
| `codex` | `$zc-*` skill | `zc:start -> $zc-start` |
| `claude` | `/zc-*` command | `zc:start -> /zc-start` |
| `opencode` | `/zc-*` command | `zc:start -> /zc-start` |
| `qwen` | `zc:*` namespaced command | `zc:start -> zc:start` |

同时：

- workflow / 专项 skill 也会带 `zc-` 前缀
- 不会直接把裸名字如 `start`、`spec`、`build` 安装到平台里
- 这样可以减少和平台内置命令、社区插件或后续扩展发生冲突的风险

### 产物矩阵

| 平台 | 产物 |
| --- | --- |
| `codex` | `AGENTS.md`、`skills/zc-<command>/SKILL.md`、`skills/zc-<skill>/SKILL.md` |
| `claude` | `CLAUDE.md`、`.claude/commands`、`.claude/agents` |
| `opencode` | `AGENTS.md`、`.opencode/commands`、`.opencode/skills`、`.opencode/agents` |
| `qwen` | 用户级优先通过官方 `qwen extensions` CLI 从 `https://github.com/zmice/zc-qwen-extension.git` 安装和更新 `zc-toolkit`；扩展目录位于 `.qwen/extensions/zc-toolkit/`，其中包含 `QWEN.md`、带 `version` 的 `qwen-extension.json`、`commands/`、`skills/`、`agents/` |

### 官方默认位置矩阵

| 平台 | 项目级默认位置 | 全局级默认位置 | 说明 |
| --- | --- | --- | --- |
| `codex` | `<project-root>/AGENTS.md` + `<project-root>/.codex/skills/` | `~/.codex/AGENTS.md` | OpenAI 官方文档将 Codex home（默认 `~/.codex`）作为全局级 `AGENTS.md` 位置；项目级 skills 使用 `.codex/skills/` |
| `claude` | `<project-root>/CLAUDE.md` | `~/.claude/CLAUDE.md` | Claude Code 官方文档明确给出 project/user memory 位置 |
| `opencode` | `<project-root>/AGENTS.md` | `~/.config/opencode/AGENTS.md` | OpenCode 官方文档明确给出 project/global rules 位置 |
| `qwen` | `<project-root>/QWEN.md` | `~/.qwen/QWEN.md` | 官方文档明确 `/init` 会在项目目录创建 `QWEN.md`，并明确用户级配置目录为 `~/.qwen`；阿里云官方帮助文档同时给出了 Qwen CLI 的用户级 `QWEN.md` 位置 |

### 4.1 项目安装

进入目标项目目录后直接运行：

```bash
cd /path/to/project
zc platform install codex
zc platform install claude
zc platform install opencode
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
  - `<project>/.codex/skills/zc-<command>/SKILL.md`
  - `<project>/.codex/skills/zc-<skill>/SKILL.md`
- `claude`
  - `<project>/CLAUDE.md`
  - `<project>/.claude/commands/zc-<command>.md`
  - `<project>/.claude/agents/zc-<agent>.md`
- `opencode`
  - `<project>/AGENTS.md`
  - `<project>/.opencode/commands/zc-<command>.md`
  - `<project>/.opencode/skills/zc-<skill>/SKILL.md`
  - `<project>/.opencode/agents/zc-<agent>.md`
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
zc platform install claude --global
zc platform install opencode --global
zc platform install qwen --global
zc platform status codex --global --json
zc platform doctor codex --global --json
zc platform repair codex --global --plan --json
zc platform uninstall codex --global --plan --json
zc platform update codex --global --plan --json
zc platform where codex --global
zc platform where claude --global --json
zc platform where opencode --global --json
zc platform where qwen --global --json
```

当前行为：

- `codex --global`
  - 默认安装到 `~/.codex/AGENTS.md`
  - 同时安装 `~/.codex/skills/zc-<command>/SKILL.md`
  - 同时安装 `~/.codex/skills/zc-<skill>/SKILL.md`
- `claude --global`
  - 默认安装到 `~/.claude/CLAUDE.md`
  - 同时安装 `~/.claude/commands/zc-<command>.md`
  - 同时安装 `~/.claude/agents/zc-<agent>.md`
- `opencode --global`
  - 默认安装到 `~/.config/opencode/AGENTS.md`
  - 同时安装 `~/.config/opencode/commands/zc-<command>.md`
  - 同时安装 `~/.config/opencode/skills/zc-<skill>/SKILL.md`
  - 同时安装 `~/.config/opencode/agents/zc-<agent>.md`
- `qwen --global`
  - 默认优先通过官方 `qwen extensions` CLI 管理 `~/.qwen/extensions/zc-toolkit/`
  - 默认安装源：
    - `https://github.com/zmice/zc-qwen-extension.git`
  - 对应官方命令语义：
    - 首次安装：`qwen extensions install https://github.com/zmice/zc-qwen-extension.git`
    - 后续更新：`qwen extensions update zc-toolkit`
  - 其中包含 `QWEN.md`、带 `version` 的 `qwen-extension.json`、`commands/`、`skills/`、`agents/`
  - 如果本机没有 `qwen` 命令，会明确提示并回退为直接写入扩展目录
  - 如需独立导出发布态 bundle：
    - `zc platform generate qwen --bundle release-bundle --dir /tmp/zc-toolkit`
    - 或 `node scripts/export-qwen-extension-bundle.mjs --out /tmp/zc-toolkit`

### 4.4 用 GitHub Actions 同步 Qwen 独立发布仓库

当前仓库已经内置：

- `.github/workflows/publish-qwen-extension-repo.yml`

用途：

- 从主仓库导出 Qwen 发布态 bundle
- 同步到一个单独的 GitHub 扩展仓库根目录
- 同步结果会包含：
  - `README.md`
  - `LICENSE`
  - `QWEN.md`
  - `qwen-extension.json`
  - `commands/`
  - `skills/`
  - `agents/`

需要的 GitHub secret：

- `QWEN_EXTENSION_REPO_TOKEN`
  - 需要对目标扩展仓库具备 `contents: write`

当前默认同步目标：

- `zmice/zc-qwen-extension`

触发方式：

- 手动触发 `workflow_dispatch`
- 当主仓库 push `@zmice/zc@*` tag 时自动同步

可选输入：

- `target_branch`
  - 默认 `main`
- `commit_message`
  - 默认 `chore: sync qwen extension bundle`

如果你已经明确知道目标工具的自定义全局目录，也可以继续显式指定：

```bash
zc platform install codex --dir <codex-global-root>
zc platform install claude --dir <claude-global-root>
zc platform install opencode --dir <opencode-global-root>
zc platform install qwen --dir <qwen-global-root>
```

### 4.3 安装前先预演

推荐先看计划，再决定是否真的落盘：

```bash
zc platform install codex --plan
zc platform install codex --global --plan
zc platform install claude --plan --json
zc platform install opencode --plan --json
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
- `platform doctor` 是 `status` 的只读诊断层，会输出健康度、问题列表和下一步建议
- `platform repair` 会在 receipt 基础上恢复 drift / missing / qwen bundle 失配
- `platform uninstall` 只删除 receipt 跟踪的受管对象，不清理未受管文件
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
zc platform install claude --plan
zc platform install opencode --plan
zc platform install qwen --plan
```
