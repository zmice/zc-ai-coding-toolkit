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
| `codex` | 传统安装为 `$zc-*` skill；插件安装为插件命名空间限定 skill | `zc:start -> $zc-start` / `zc:start -> $zc-toolkit:start` |
| `claude` | `/zc-*` command | `zc:start -> /zc-start` |
| `opencode` | `/zc-*` command | `zc:start -> /zc-start` |
| `qwen` | `zc:*` namespaced command | `zc:start -> zc:start` |

同时：

- 传统文件系统安装的 workflow / 专项 skill 会带 `zc-` 前缀
- Codex 插件安装不再给 skill 额外加 `zc-` 前缀，因为插件自身已经提供 `zc-toolkit` 命名空间
- 插件 Markdown agents 使用插件自己的命名空间；带明确 session settings 的 standalone TOML agents 继续保留 `zc-` / `zc_` 前缀

### 产物矩阵

| 平台 | 产物 |
| --- | --- |
| `codex` | 推荐通过官方 Git marketplace 从 `zmice/zc-codex-marketplace` 安装和更新 `zc-toolkit`；插件原生包含 `commands/`、`skills/`、`agents/`；传统安装仍生成 `AGENTS.md`、`config.toml`、`skills/zc-*/SKILL.md`、`agents/zc-*.toml` |
| `claude` | `CLAUDE.md`、`.claude/commands`、`.claude/agents` |
| `opencode` | `AGENTS.md`、`.opencode/commands`、`.opencode/skills`、`.opencode/agents` |
| `qwen` | 用户级优先通过官方 `qwen extensions` CLI 从 `https://github.com/zmice/zc-qwen-extension.git` 安装和更新 `zc-toolkit`；扩展目录位于 `.qwen/extensions/zc-toolkit/`，其中包含 `QWEN.md`、带 `version` 的 `qwen-extension.json`、`commands/`、`skills/`、`agents/` |

### 官方默认位置矩阵

| 平台 | 项目级默认位置 | 全局级默认位置 | 说明 |
| --- | --- | --- | --- |
| `codex` | `<project-root>/AGENTS.md` + `<project-root>/.codex/config.toml` + `<project-root>/.codex/skills/` + `<project-root>/.codex/agents/` | `~/.codex/AGENTS.md` + `~/.codex/config.toml` + `~/.codex/skills/` + `~/.codex/agents/` | OpenAI 官方文档将 Codex home（默认 `~/.codex`）作为全局级 `AGENTS.md` 位置；`.codex/config.toml`、`.codex/agents/` 和 plugin / marketplace bundle 是 `zc` 当前安装模型，按 zc-managed 配置维护 |
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
  - `<project>/.codex/config.toml`
  - `<project>/.codex/skills/zc-<command>/SKILL.md`
  - `<project>/.codex/skills/zc-<skill>/SKILL.md`
  - `<project>/.codex/agents/zc-<agent>.toml`
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
codex plugin marketplace add zmice/zc-codex-marketplace
codex plugin add zc-toolkit@zc-toolkit --json
codex plugin marketplace upgrade zc-toolkit
zc platform plugin codex --git
zc platform plugin codex --register
zc platform plugin codex --install
zc platform plugin codex --status
zc platform plugin codex --upgrade
zc platform plugin codex --install --with-agents
zc platform plugin codex --status --with-agents
zc platform plugin codex --upgrade --with-agents
zc platform plugin codex --uninstall --with-agents
zc platform plugin codex --git --uninstall --plan
zc platform plugin codex --global
zc platform plugin codex --global --uninstall --plan
zc platform plugin codex --global --uninstall --include-agents --plan
zc platform agents codex --global --sync --prune
zc platform agents codex --global --status
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

- `platform plugin codex`
  - 推荐使用 `--install` 注册 marketplace 并通过官方 `codex plugin add` 安装插件
  - `--git` 只输出官方 lifecycle 命令，不写本地文件
  - `--register` 会注册默认 Git 源 `zmice/zc-codex-marketplace`；旧 CLI 兼容顶层 `codex marketplace add`
  - `--status` 使用官方 JSON 输出检查 installed、available、version 和 enabled
  - `--upgrade` 先检查 marketplace 来源：Git 来源刷新后重新安装当前快照，缺失来源自动注册；非 Git 旧来源通过带回滚的迁移切换到 Git marketplace；旧 personal marketplace 条目会在备份后精确移除，失败时恢复
  - Windows npm `.cmd` shim 通过跨平台安全启动器调用；Codex Git source / ref 和 runtime spawn 参数不经过 shell 拼接
  - `--git --uninstall` 使用官方 `codex plugin remove` 移除插件 bundle；connector 授权需单独管理
  - `--with-agents` 只能与 `--install`、`--status`、`--upgrade`、`--uninstall` 一起使用，将官方插件和全局 companion agents 合并成一个 JSON/text 结果
  - 组合安装从官方 CLI 返回的 `installedPath` 或 `source.path` 定位插件根并加载 `assets/zc-agents/manifest.json`，把 Windows CRLF 文本归一化为 LF 后校验 plugin version、内容指纹和各文件哈希，再写入 companion agents
  - 组合 status 不写文件；官方输出同时缺少这两个路径字段时可由已有 agent 回执续接，首次安装缺少路径则返回 partial
  - 组合 upgrade 在 available version 尚未真正成为 installed version 时返回 `update-pending`，agents 保持不变
  - 组合 uninstall 只移除回执拥有的 agent 文件和受管 config 段，保留未跟踪的本地 agent
  - `--ref <ref>` 可用于 pin Git marketplace 分支或 tag
  - 不传 selector 时默认解析最近项目根，生成 repo-local marketplace
  - 项目级插件路线生成薄入口到 `<project>/AGENTS.md`
  - 显式 `--global` 时生成 Codex personal marketplace 到 `~/.agents/plugins/marketplace.json`
  - 显式 `--global` 时生成薄入口到 `~/.codex/AGENTS.md`
  - 显式 `--global` 时生成插件到 `~/.codex/plugins/zc-toolkit/`，插件 Markdown agents 位于插件自己的 `agents/`
  - 插件内 skill 使用无前缀目录和 frontmatter，例如 `skills/start/SKILL.md`、`skills/sdd-tdd-workflow/SKILL.md`
  - 插件同时生成 `commands/<command>.md` 和 `agents/<agent>.md`
  - 界面实现使用 `$zc-toolkit:ui`；只读界面审查使用 `$zc-toolkit:ui-ux-review`；`frontend-specialist` 会按任务意图在实现、审查和浏览器验证之间分流
  - UI/UX 清单、许可证和设计系统参考随 skill 生成到 `skills/<skill>/references/`，运行时不依赖联网下载
  - 插件路线的 `AGENTS.md` 只保留全局规则、入口映射和文件索引，入口写成 `$zc-toolkit:start` / `$zc-toolkit:sdd-tdd`；传统直装的 `AGENTS.md` 继续写成 `$zc-start` / `$zc-sdd-tdd`
  - 追加 `--force` 时会先清理目标插件的 `commands/`、`skills/`、`agents/` 受管目录，再写入当前版本，避免旧命名残留
  - `--uninstall` 删除 zc 生成的本地 plugin marketplace bundle，包括 `marketplace.json`、薄入口 `AGENTS.md` 和 `plugins/zc-toolkit/`
  - `--include-agents` 只用于清理传统直装或兼容流程留下的 TOML agents
  - 不加 `--force` 时，内容已经被用户改过的薄入口、marketplace 文件或插件目录内文件会跳过；插件目录内存在未知文件时也会跳过，避免误删手工维护内容
  - 当前 Codex CLI 缺少稳定 `plugin` 子命令时，只有注册动作会降级到旧 marketplace 命令；安装、状态、刷新和卸载会提示先升级 Codex
  - 也可以显式使用 `--project` 或 `--dir <marketplace-root>`；`platform plugin codex --dir` 指向 repo/personal marketplace bundle root，不是 Codex home。如果要直接维护 custom agents，使用 `platform agents codex --dir <codex-home-or-project-root>`
- `platform agents codex`
  - 独立维护官方 standalone custom-agent TOML roles；插件 Markdown agents 提供角色说明，TOML roles 提供逐角色 session settings
  - 默认动作是 `--sync`，会更新当前清单内的 `zc-*.toml` 和 `config.toml` 中的 `[agents.zc_*]`
  - `--status` 检查缺失、漂移和过期 `zc-*.toml`
  - `--prune` 在同步时删除当前清单外的过期 zc agent 文件
  - `--uninstall` 删除 zc-managed agent 文件，并只移除 `config.toml` 中的 `[agents.zc_*]`，保留用户自己的 agent 配置
- `codex --global`
  - 默认安装到 `~/.codex/AGENTS.md`
  - 安装回执位于 `~/.codex/platform-state/codex.install-receipt.json`；旧版重复 `.codex/.codex` 路径仍可被识别并在下次写入时清理
  - 同时安装 `~/.codex/config.toml` 作为 `zc` 管理的 custom agent role 注册配置
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

### 4.4 用 GitHub Actions 同步 Codex marketplace 仓库

当前仓库已经内置：

- `.github/workflows/publish-codex-marketplace-repo.yml`

用途：

- 从主仓库导出 Codex marketplace bundle
- 同步到一个单独的 GitHub marketplace 仓库根目录
- 同步结果会包含：
  - `README.md`
  - `LICENSE`
  - `.agents/plugins/marketplace.json`
  - `AGENTS.md`
  - `plugins/zc-toolkit/`
  - `.codex/config.toml`
  - `.codex/agents/`

需要的 GitHub secret：

- `CODEX_MARKETPLACE_REPO_TOKEN`
  - 需要对目标 marketplace 仓库具备 `contents: write`

当前默认同步目标：

- `zmice/zc-codex-marketplace`

触发方式：

- 手动触发 `workflow_dispatch`
- 当主仓库 push `@zmice/zc@*` tag 时自动同步

可选输入：

- `target_branch`
  - 默认 `main`
- `commit_message`
  - 默认 `chore: sync codex marketplace bundle`

本地导出发布包：

```bash
pnpm --dir apps/cli build
node scripts/export-codex-marketplace-bundle.mjs --out /tmp/zc-codex-marketplace
```

### 4.5 用 GitHub Actions 同步 Qwen 独立发布仓库

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

### 4.6 安装前先预演

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
- `--dir <path>`、`--project`、`--global` 是统一 target selector，三者互斥；不传时默认项目级
- `generate --project/--global` 只用于带项目级或用户级布局语义的 bundle，目前是 `codex --bundle codex-marketplace`
- 常用短入口：
  - `platform p codex` 等价于 `platform plugin codex`
  - `platform i <target>` 等价于 `platform install <target>`
  - `platform s <target>` 等价于 `platform status <target>`
  - `platform u <target>` 等价于 `platform update <target>`
  - `platform w <target>` 等价于 `platform where <target>`
  - `platform check <target>` 等价于 `platform doctor <target>`
  - `platform fix <target>` 等价于 `platform repair <target>`
  - `platform remove <target>` 等价于 `platform uninstall <target>`
- install 成功后会写入平台状态回执：
  - Codex：`.codex/platform-state/codex.install-receipt.json`
  - 其他平台：`.zc/platform-state/<platform>.install-receipt.json`
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

### 4.7 Codex 原生子代理与临时 worktree

Codex agent 资产会把内容清单中的平台专属配置渲染到 standalone / companion TOML。插件 `agents/*.md` 只包含 `name`、`description` 和角色正文，不承载下列 session settings：

- `model`：按角色复杂度选择 `gpt-5.6-sol`、`gpt-5.6-terra` 或 `gpt-5.6-luna`
- `model_reasoning_effort`：按风险和任务类型分配 `medium` / `high`
- `sandbox_mode`：只读角色使用 `read-only`，实现型角色使用 `workspace-write`

需要明确档位时运行：

```bash
zc platform plugin codex --upgrade --with-agents --json
zc platform plugin codex --status --with-agents --json
```

第二条命令必须同时返回 `overallStatus=complete`、`roleConfiguration.explicitRuntimeConfigSurface=standalone-custom-agent-toml`、`agents.status=up-to-date`，并且 missing / drifted artifacts 都为 `0`。插件 `--status` 单独显示 installed / enabled / version，只能证明插件可用，不能证明模型档位已应用。同步完成后启动新的 Codex 任务以重新加载 custom agents。

`parallel-agent-dispatch` 会根据 host 当前 session limit、正在运行的 child threads 和 ready task 数决定派发数量。有两个互不依赖的问题即可派发；写入型子代理仍必须声明不重叠的文件所有权，并由主线程完成 fan-in 验证。

当 Codex 原生子代理需要隔离写入、但不需要 tmux 多 CLI 团队时，使用 `zc agent worktree`：

```bash
zc agent worktree prepare \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --json

zc agent worktree prepare ... --apply --json

zc agent worktree cleanup \
  --dir <repo> \
  --run-id <run> \
  --task-id <task> \
  --agent-state completed \
  --fan-in-collected \
  --json

zc agent worktree cleanup ... --apply --json
zc agent worktree recover --dir <repo> --run-id <run> --task-id <task> --json
zc agent worktree recover ... --apply --json
```

默认根目录是 OS temp 下的 `zc-codex-worktrees/`。该入口不使用项目 `.worktrees/`，也不会进入 `$CODEX_HOME/worktrees`；需要测试隔离时才显式传 `--temp-root`。三个动作默认只输出 plan，只有 `--apply` 才写入。

安全边界：

- source dirty 时默认阻止 prepare；确认未提交改动与子任务无关后才使用 `--allow-dirty-source`
- cleanup 要求 agent 已终态且 fan-in 已收集，不使用 force
- 未合入提交会保留恢复 branch 和 receipt，但清掉无用工作目录
- recover 只按精确 receipt 收敛中断状态，不扫描或删除无关 worktree
- worktree、receipt 和临时根的既有父级都拒绝 symlink，避免路径逃逸和遗留文件落入非受管目录

## 5. 团队并行工作流

`zc team` 是 tmux + git worktree 的多 CLI worker 编排入口。它默认采用保守并行策略：无法证明任务独立时，不盲目启动多个 worker。

先 dry-run：

```bash
zc team plan -w 2 \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts" \
  --json
```

确认 `canStart=true` 后再启动：

```bash
zc team start -w "w1:codex,w2:codex" \
  -t "API | files=src/api.ts,src/api.test.ts" \
  -t "UI | files=src/ui.ts,src/ui.test.ts"
```

任务描述支持轻量元数据：

- `files=a,b`：声明文件所有权；多 worker 并行时必填
- `deps=task-1`：声明依赖；存在依赖时需要 cascade，不会盲目并行启动
- `skills=zc-build,zc-verify`：给任务附加 skill 上下文
- `mode=worktree`：显式要求 worktree 隔离

worktree 目录选择规则：

- 优先使用 `<repo>/.worktrees/`
- 如果已有 `<repo>/worktrees/`，则作为兜底
- 项目内 worktree 目录必须被 git ignore；否则 `zc team start` 会拒绝创建，避免误提交 worktree 内容

关闭前先检查 fan-in 状态：

```bash
zc team shutdown <team-name> --plan
```

`--plan` 只输出每个 worker worktree 的 `clean/dirty/ahead/merged/unknown` 状态，不关闭 tmux、不删除 worktree。只有分支去向明确后，再运行不带 `--plan` 的 `shutdown`。

## 6. 冲突与覆盖

默认策略是安全模式：

- 目标文件不存在：直接创建
- 目标文件相同：记为未变更
- 目标文件不同：报冲突并停止

如果确认需要覆盖，显式追加：

```bash
zc platform install codex --dir <target-dir> --force
```

## 7. 上游治理入口

上游治理不是 `zc` 的公开产品能力，而是仓库级脚本入口：

```bash
pnpm upstream -- list
pnpm upstream -- diff agent-skills
pnpm upstream -- report all --format md
```

如需核对远端当前 HEAD，显式追加 `--with-remote`：

```bash
pnpm upstream -- report all --format md --with-remote
```

如果脚本提示缺少 `dist`，先运行：

```bash
pnpm build
```

## 8. 常见验证

### 验证 CLI 自身

```bash
pnpm --dir apps/cli test
pnpm --dir apps/cli build
```

### 验证 workspace

```bash
pnpm verify:mvp
pnpm verify
pnpm release:check
```

语义分层：

- `pnpm verify:mvp` 是发布态 smoke，等价于 `node scripts/verify-workspace.mjs`
- `pnpm verify` 是全量本地门禁，覆盖 workspace 包 lint/test/build/generate
- `pnpm release:check` 是发布门禁，叠加 changeset、全量验证和允许的 dirty path 检查

### 审计生成内容体量

```bash
pnpm audit:context
pnpm audit:context -- --json
```

体量增长时优先按 `tier`、`audience`、`platform_exposure` 调整默认暴露策略，不盲目删除 `packages/toolkit` 中的源内容。

### 验证平台安装计划

```bash
zc platform install codex --plan
zc platform install codex --global --plan
zc platform install claude --plan
zc platform install opencode --plan
zc platform install qwen --plan
```
