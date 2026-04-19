# AI Coding Toolkit

一个面向 AI 编码工作流的 monorepo。这个仓库把 **内容事实源**、**统一操作 CLI**、**平台适配层** 和 **上游治理层** 分开维护，用来持续沉淀并分发一套可治理的 AI 编码工具包。

当前主线能力包括：
- `zc` 统一入口 CLI：运行 runtime、查询 toolkit、生成/安装平台产物
- `toolkit` 内容层：以 `meta.yaml + body.md + assets/` 维护 skills、commands、agents
- `platform-*` 适配层：从 toolkit 生成 Qwen / Codex / Qoder 所需产物
- `references` 治理层：追踪上游项目、baseline snapshot、diff、report 和导入提案

发布模型：
- 对外只发布 `@zmice/zc`
- `packages/toolkit` 和 `packages/platform-*` 是仓库内部包
- `zc` 构建时会把内部运行时内容 vendoring 到自身包里

## 快速开始

### 环境要求

- Node.js `>= 20`
- `pnpm@10.13.1`

### 安装依赖

```bash
pnpm install
```

### 首次构建

```bash
pnpm build
```

### 最小验证

```bash
pnpm verify
```

### 常用入口

```bash
# 查看 toolkit 治理状态
node apps/cli/dist/cli/index.js toolkit lint --json

# 搜索或查看内容
node apps/cli/dist/cli/index.js toolkit search review
node apps/cli/dist/cli/index.js toolkit show spec
node apps/cli/dist/cli/index.js toolkit recommend build

# 生成 / 安装平台产物
node apps/cli/dist/cli/index.js platform generate qwen --plan --json
node apps/cli/dist/cli/index.js platform install codex --plan --json
node apps/cli/dist/cli/index.js platform install codex --global
node apps/cli/dist/cli/index.js platform status codex --global --json
node apps/cli/dist/cli/index.js platform update codex --global --plan --json
node apps/cli/dist/cli/index.js platform where qoder --global --json

# 查看上游治理状态
pnpm upstream -- list
pnpm upstream -- report all --format md
```

更完整的安装、更新和平台内容安装说明见：

- [docs/usage-guide.md](docs/usage-guide.md)

安装建议：

- 普通使用者优先 `npm install -g @zmice/zc`
- 只有在仓库开发态调试 CLI 时，才建议使用 `pnpm --dir apps/cli link --global`
- 如果使用 `pnpm link --global`，第一次需要先执行一次 `pnpm setup`

## 仓库结构

```text
.
├── apps/
│   └── cli/                    # @zmice/zc，统一 operator/runtime CLI
├── packages/
│   ├── toolkit/                # skills / commands / agents 的唯一事实源
│   ├── platform-core/          # 平台安装/生成共享 contract
│   ├── platform-qwen/
│   ├── platform-codex/
│   └── platform-qoder/
├── references/                 # 上游治理：upstreams、notes、snapshots
├── docs/
│   ├── adr/                    # 架构决策记录
│   └── architecture/           # 长期架构与治理文档
├── scripts/                    # workspace 验证、release preflight 等脚本
└── tests/                      # 跨包级验证
```

### 分层原则

- `apps/cli` 负责命令编排和用户入口，不维护 prompt 内容
- `packages/toolkit` 是内容真相，平台包和 CLI 都消费它
- `packages/platform-*` 只负责平台表达和安装，不维护第二份内容
- `references` 只做上游治理，不作为运行时依赖
- `packages/*` 仍然保留独立边界用于开发，但不作为公网发布单元

## 常用工作流

### 1. 调整 toolkit 内容

内容修改默认发生在：

- `packages/toolkit/src/content/`

每个资产目录使用：

- `meta.yaml`
- `body.md`
- 可选 `assets/`

关键治理字段包括：

- `tier`
- `audience`
- `stability`
- `source`
- `requires / suggests / conflicts_with / supersedes`

常用命令：

```bash
pnpm --dir packages/toolkit test
node apps/cli/dist/cli/index.js toolkit lint --json
node apps/cli/dist/cli/index.js toolkit show <query>
node apps/cli/dist/cli/index.js toolkit search <keyword>
node apps/cli/dist/cli/index.js toolkit recommend <query>
```

### 2. 生成或安装平台产物

平台包消费 toolkit，而不是自己维护源码内容。

```bash
node apps/cli/dist/cli/index.js platform generate qwen --dir /tmp/qwen-out
node apps/cli/dist/cli/index.js platform install codex --dir /tmp/codex-out
node apps/cli/dist/cli/index.js platform install codex --global
node apps/cli/dist/cli/index.js platform install qwen --global
node apps/cli/dist/cli/index.js platform status codex --global --json
node apps/cli/dist/cli/index.js platform update codex --global --plan --json
node apps/cli/dist/cli/index.js platform where qoder --global --json
node apps/cli/dist/cli/index.js platform where qwen --global --json
node apps/cli/dist/cli/index.js platform install qoder --plan --json
```

说明：

- `platform generate/install --plan` 只输出计划，不落盘
- `--json` 适合脚本消费
- `platform install` 未传 `--dir` 时，会优先向上解析最近项目根，找不到再回退到当前目录
- `platform install` 成功后会写入 `.zc/platform-state/<platform>.install-receipt.json`
- `platform status` 只读检查安装状态，返回 `not-installed / up-to-date / update-available / drifted`
- `platform update` 复用 install 逻辑；`update-available` 会安全覆盖受管产物，`drifted` 需要显式 `--force`
- `platform where` 只解析目录，不执行写入

### 3. 审阅上游更新

活跃上游清单在：

- `references/upstreams.yaml`

常用命令：

```bash
pnpm upstream -- list
pnpm upstream -- show agent-skills
pnpm upstream -- diff agent-skills
pnpm upstream -- snapshot agent-skills --label baseline
pnpm upstream -- report agent-skills --format md --output /tmp/upstream-report.md
pnpm upstream -- import agent-skills --dry-run --output /tmp/import-plan.txt
```

治理规则：

- 先记录 `references`，再决定是否吸收到 `packages/toolkit`
- `notes` 可变，`snapshots` 不可变
- 影响内容真相或平台产物的同步必须走人工审阅
- 上游治理是仓库级脚本能力，不属于 `zc` 的产品命令面

## 常用命令总览

| 命令 | 用途 |
| --- | --- |
| `pnpm install` | 安装 workspace 依赖 |
| `pnpm lint` | 跑各包静态检查 |
| `pnpm test` | 跑各包测试 |
| `pnpm build` | 编译各包 |
| `pnpm generate` | 生成各平台产物 |
| `pnpm verify` | workspace 全量验证 |
| `pnpm verify:mvp` | 最小闭环验证 |
| `pnpm upstream -- <subcommand>` | 运行仓库级 upstream 治理命令 |
| `pnpm release:check` | 发布前 preflight |
| `pnpm release` | 通过 changeset 发布 |

## 文档入口

项目级长期上下文与项目地图：

- [AGENTS.md](AGENTS.md)
- [docs/README.md](docs/README.md)
- [docs/usage-guide.md](docs/usage-guide.md)
- [docs/architecture/project-context.md](docs/architecture/project-context.md)

按任务类型进入：

- 改 CLI：`apps/cli/README.md`
- 改内容：`packages/toolkit/README.md`
- 改平台：`packages/platform-*/README.md`
- 看上游治理：`references/README.md`

高频长期文档：

- [monorepo-layers.md](docs/architecture/monorepo-layers.md)
- [toolkit-content-optimization.md](docs/architecture/toolkit-content-optimization.md)
- [toolkit-naming-and-source-identity.md](docs/architecture/toolkit-naming-and-source-identity.md)
- [platform-deepening.md](docs/architecture/platform-deepening.md)
- [upstream-automation.md](docs/architecture/upstream-automation.md)
- [release-versioning.md](docs/architecture/release-versioning.md)

## 内容与命名规则

### 内容真相

- 不要把 prompt 内容源码放回仓库根目录
- 内容修改默认发生在 `packages/toolkit/src/content/`
- 不要手工编辑 generated/dist 产物作为真相

### 命名模型

仓库采用三层命名：

- `source identity`：对齐 upstream
- `workspace identity`：仓库内部稳定 id
- `display title`：用户可见中文标题

`toolkit show` / `toolkit recommend` 的 `<query>` 同时支持：

- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

### 中文化

- 默认优先中文输出
- 命令名、参数名、文件名、JSON 键、平台产物名保持原样
- 详细规则见 [docs/architecture/chinese-localization.md](docs/architecture/chinese-localization.md)

## 贡献与验证

提交前至少满足对应层级的最小验证：

- 文档改动：`git diff --check`
- toolkit 内容改动：`toolkit lint` + 相关测试
- CLI / 平台逻辑改动：对应包测试 + `pnpm verify`

仓库当前遵循：

- 手工编辑用 `apply_patch`
- 搜索优先用 `rg`
- 不破坏 `source.origin_*` 与 `references/upstreams.yaml` 的一致性

## 历史说明

仓库已经完成从旧根目录 source model 到 monorepo source model 的迁移：

- 旧根目录 `skills/`、`commands/`、`agents/` 已移除
- 平台入口文件不再作为手工源码维护
- 根目录 `AGENTS.md` 现在是项目级上下文入口，不是平台产物

历史背景见：

- [legacy-root-retirement.md](docs/architecture/legacy-root-retirement.md)
