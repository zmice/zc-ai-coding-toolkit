# zc AI Coding Toolkit

一个面向 AI 编码工作流的开源 monorepo。这个仓库把 **内容事实源**、**统一操作 CLI**、**平台适配层** 和 **上游治理层** 分开维护，用来持续沉淀并分发一套可治理的 `zc` AI 编码工具包。

当前对外主产品只有：

- `@zmice/zc`

仓库内部还包含：

- `packages/toolkit`：skills / commands / agents 的唯一事实源
- `packages/platform-*`：Qwen / Codex / Qoder 平台适配层
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
  - Qoder：`AGENTS.md` + `commands / skills / agents`
  - Qwen：`QWEN.md` + extension 目录
- 上游治理
  - 记录、快照、比对、报告、导入提案

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
zc platform install qoder --global
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
│   └── platform-qoder/
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

### 调整 toolkit 内容

内容修改默认发生在：

- `packages/toolkit/src/content/`

常用命令：

```bash
pnpm --dir packages/toolkit test
zc toolkit lint --json
zc toolkit show <query>
zc toolkit search <keyword>
zc toolkit recommend <query>
```

### 生成或安装平台产物

```bash
zc platform generate qwen --plan --json
zc platform install codex --global
zc platform install qoder --global
zc platform install qwen --global
zc platform status codex --global --json
zc platform update codex --global --plan --json
```

### 审阅上游变化

```bash
pnpm upstream -- list
pnpm upstream -- diff agent-skills
pnpm upstream -- report all --format md
```

## 上游参考与维护

这个仓库不是从零凭空设计出来的。内容层和 workflow 组织方式，会持续参考一组公开上游项目，再通过人工审阅吸收到 `toolkit`。

当前登记的内容参考上游包括：

- [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)
- [`obra/superpowers`](https://github.com/obra/superpowers)
- [`affaan-m/everything-claude-code`](https://github.com/affaan-m/everything-claude-code)
- [`garrytan/gstack`](https://github.com/garrytan/gstack)
- [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills)

对应治理入口：

- [references/upstreams.yaml](references/upstreams.yaml)
- [references/README.md](references/README.md)

维护规则：

- upstream 只提供参考，不直接覆盖本仓库内容
- 所有吸收都先进入 `references`
- 经过人工审阅后，才会落到 `packages/toolkit`

### CLI 的上游维护边界

`zc` 本身不承载 upstream 治理命令，但它的安装行为和平台适配会持续对齐官方平台文档。

当前重点跟踪：

- Codex 官方文档
- Qoder 官方 CLI / commands / skills / agents 文档
- Qwen 官方扩展、skills、extensions CLI 文档

相关入口说明见：

- [docs/usage-guide.md](docs/usage-guide.md)
- [docs/architecture/platform-capability-matrix.md](docs/architecture/platform-capability-matrix.md)
- [apps/cli/README.md](apps/cli/README.md)

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
