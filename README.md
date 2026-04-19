# zc AI Coding Toolkit

一个面向 AI 编码工作流的开源 monorepo。这个仓库把 **内容事实源**、**统一操作 CLI**、**平台适配层** 和 **上游治理层** 分开维护，用来持续沉淀并分发一套可治理的 `zc` AI 编码工具包。

当前对外主产品只有：

- `@zmice/zc`

仓库内部还包含：

- `packages/toolkit`：skills / commands / agents 的唯一事实源
- `packages/platform-*`：Qwen / Codex / Claude / OpenCode 平台适配层
- `references`：上游项目治理、快照、审阅记录

## 适合谁

- 想用 `zc` 管理 AI 平台内容安装、更新和状态的人
- 想维护一套可治理的 AI prompts / commands / skills / agents 的人
- 想参考一个把内容层、CLI、平台安装和上游同步拆开的 monorepo 结构的人

## 核心能力

- `zc` 统一入口 CLI
  - runtime
  - toolkit 查询
  - platform 生成 / 安装 / 更新 / 状态检查
- `toolkit` 内容层
  - 使用 `meta.yaml + body.md + assets/` 维护 skills、commands、agents
- 平台原生安装
  - Codex：`AGENTS.md` + `skills`
  - Claude Code：`CLAUDE.md` + `commands / agents`
  - OpenCode：`AGENTS.md` + `commands / skills`
  - Qwen：`QWEN.md` + extension 目录
- 上游治理
  - 记录、快照、比对、报告、导入提案

## 内容包含什么

当前 `toolkit` 主要维护三类内容：

- `commands`
  - 统一任务入口和阶段入口，例如：
    - `start`
    - `product-analysis`
    - `spec`
    - `task-plan`
    - `build`
    - `quality-review`
    - `verify`
- `skills`
  - 完整 workflow 和专项方法，例如：
    - `sdd-tdd-workflow`
    - `spec-driven-development`
    - `debugging-and-error-recovery`
    - `documentation-and-adrs`
    - `shipping-and-launch`
- `agents`
  - 常见协作角色，例如：
    - `architect`
    - `product-owner`
    - `code-reviewer`
    - `test-engineer`

当前内容组织方式以固定 workflow 为主：

- `product-analysis`
- `full-delivery`
- `bugfix`
- `review-closure`
- `docs-release`
- `investigation`

`start` 负责先做任务判型，再把任务引导到对应 workflow。

完整内容清单见：

- [packages/toolkit/README.md](packages/toolkit/README.md)

## 安装

### 普通使用

```bash
npm install -g @zmice/zc
zc --help
```

### 从源码运行

```bash
pnpm install
pnpm build
node apps/cli/dist/cli/index.js --help
```

### 本地开发态 link

```bash
pnpm setup
# 重新打开终端，或重新加载 shell
pnpm install
pnpm build
pnpm --dir apps/cli link --global
zc --help
```

如果你只是想验证最新仓库代码，不一定要全局 link，也可以直接运行：

```bash
node apps/cli/dist/cli/index.js --help
```

更完整的安装、更新和平台内容安装说明见：

- [docs/usage-guide.md](docs/usage-guide.md)

## 快速开始

```bash
# 查看 toolkit 状态
zc toolkit lint --json

# 查询内容
zc toolkit search review
zc toolkit show command:start
zc toolkit recommend build

# 查看平台安装位置
zc platform where codex --global --json
zc platform where qwen --global --json

# 生成或安装平台内容
zc platform install codex --global
zc platform install claude --global
zc platform install opencode --global
zc platform install qwen --global

# 查看已安装状态
zc platform status codex --global --json
zc platform status qwen --global --json
```

## 仓库结构

```text
.
├── apps/
│   └── cli/                    # @zmice/zc，统一 operator/runtime CLI
├── packages/
│   ├── toolkit/                # skills / commands / agents 的唯一事实源
│   ├── platform-core/          # 平台生成/安装共享 contract
│   ├── platform-qwen/
│   ├── platform-codex/
│   ├── platform-claude/
│   └── platform-opencode/
├── references/                 # 上游治理：upstreams、notes、snapshots
├── docs/
│   ├── adr/                    # 架构决策记录
│   └── architecture/           # 长期架构与治理文档
└── scripts/                    # workspace 验证、release preflight 等脚本
```

分层原则：

- `apps/cli` 负责命令编排和用户入口，不维护 prompt 内容
- `packages/toolkit` 是内容真相，平台包和 CLI 都消费它
- `packages/platform-*` 只负责平台表达和安装，不维护第二份内容
- `references` 只做上游治理，不作为运行时依赖

## 常用工作流

### 1. 查询和选择内容

```bash
zc toolkit lint --json
zc toolkit search review
zc toolkit show command:start
zc toolkit recommend build
```

### 2. 给 AI 平台安装内容

```bash
zc platform install codex --global
zc platform install claude --global
zc platform install opencode --global
zc platform install qwen --global
```

安装后需要注意：

- `toolkit` 里的 canonical command / skill 名称不会原样暴露给平台
- 平台侧都会做命名空间适配，避免和平台内置命令或未来插件冲突
- 例如：
  - Codex：`zc:start` 会映射成 `$zc-start`
  - Claude Code：`zc:start` 会映射成 `/zc-start`
  - OpenCode：`zc:start` 会映射成 `/zc-start`
  - Qwen：`zc:start` 会映射成 `zc:start`
- 详细规则见 [docs/usage-guide.md](docs/usage-guide.md)

### 3. 查看安装位置和状态

```bash
zc platform where codex --global --json
zc platform where qwen --global --json
zc platform status codex --global --json
zc platform status qwen --global --json
```

其中 Qwen 用户级安装会额外暴露：

- 安装方式：`qwen extensions` 官方 CLI
- Bundle 类型：发布态扩展包
- Bundle 目录：`~/.qwen/.zc/platform-bundles/qwen/zc-toolkit/`

### 4. 预演更新或重装

```bash
zc platform update codex --global --plan --json
zc platform install claude --global --plan --json
zc platform install opencode --global --plan --json
zc platform install qwen --global --plan --json
```

### 5. 仓库开发者维护内容

内容源码默认位于：

- `packages/toolkit/src/content/`

开发者常用命令：

```bash
pnpm --dir packages/toolkit test
pnpm --dir apps/cli test
pnpm verify
```

## 参考项目

这个仓库会参考公开项目和官方文档，但不会直接镜像或自动覆盖内容。

主要内容参考：

- [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)
- [`obra/superpowers`](https://github.com/obra/superpowers)
- [`affaan-m/everything-claude-code`](https://github.com/affaan-m/everything-claude-code)
- [`garrytan/gstack`](https://github.com/garrytan/gstack)
- [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills)

CLI 和平台安装语义也参考了现成项目与官方文档：

- [`Yeachan-Heo/oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- Codex / Claude Code / OpenCode / Qwen 官方文档

如需查看治理记录和上游登记清单：

- [references/upstreams.yaml](references/upstreams.yaml)
- [references/README.md](references/README.md)

## 文档入口

先看这些：

- [docs/usage-guide.md](docs/usage-guide.md)：安装、更新、平台使用说明
- [CONTRIBUTING.md](CONTRIBUTING.md)：贡献方式、验证规则、提交边界
- [apps/cli/README.md](apps/cli/README.md)：CLI 入口与命令分层
- [packages/toolkit/README.md](packages/toolkit/README.md)：内容模型与治理规则
- [references/README.md](references/README.md)：上游治理层说明

长期技术文档：

- [docs/README.md](docs/README.md)
- [docs/architecture/project-context.md](docs/architecture/project-context.md)
- [docs/architecture/monorepo-layers.md](docs/architecture/monorepo-layers.md)
- [docs/architecture/platform-capability-matrix.md](docs/architecture/platform-capability-matrix.md)
- [docs/release-guide.md](docs/release-guide.md)

## 开发与验证

```bash
pnpm install
pnpm build
pnpm verify
```

按层级验证：

- 文档改动：`git diff --check`
- toolkit 内容改动：`zc toolkit lint --json` + 对应测试
- CLI 或平台逻辑改动：对应包测试 + `pnpm verify`

## 中文化

- 默认优先中文输出
- 命令名、参数名、文件名、JSON 键、平台产物名保持原样
- 详细规则见 [docs/architecture/chinese-localization.md](docs/architecture/chinese-localization.md)

## 贡献

欢迎 issue、讨论和 PR。

贡献前先看：

- [CONTRIBUTING.md](CONTRIBUTING.md)

## License

- [MIT](LICENSE)
