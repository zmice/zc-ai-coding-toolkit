# zc AI Coding Toolkit

[![npm version](https://img.shields.io/npm/v/@zmice/zc)](https://www.npmjs.com/package/@zmice/zc)
[![license](https://img.shields.io/github/license/zmice/zc-ai-coding-toolkit)](LICENSE)
[![qwen extension](https://img.shields.io/badge/Qwen-extension_repo-blue)](https://github.com/zmice/zc-qwen-extension)
[![platforms](https://img.shields.io/badge/platforms-Codex%20%7C%20Claude%20%7C%20OpenCode%20%7C%20Qwen-2ea44f)](#支持的平台)

面向 AI 编码工作流的开源工具包。

它把一套可治理的 `commands / skills / agents` 内容系统、统一入口 CLI `zc`、以及不同 AI 平台的原生安装适配收在一个仓库里。目标不是堆 prompt，而是把 **任务入口、固定 workflow、平台安装、更新与状态检查** 做成可维护、可发布、可扩展的产品。

当前对外主产品只有：

- `@zmice/zc`

如果你只想使用它，不需要理解整个 monorepo。

## 适合谁

- 想用统一 CLI 给 Codex、Claude Code、OpenCode、Qwen 安装 AI 编码内容的人
- 想维护一套可治理的 AI workflow 内容，而不是零散 prompt 文件的人
- 想参考一个把内容层、CLI、平台适配和上游参考拆开的开源实现的人

## 三分钟上手

```bash
npm install -g @zmice/zc
zc platform install codex --global
zc platform status codex --global --json
```

如果你想装到别的平台，直接把 `codex` 换成：

- `claude`
- `opencode`
- `qwen`

更完整的安装和更新说明见：

- [apps/cli/README.md](apps/cli/README.md)
- [docs/usage-guide.md](docs/usage-guide.md)

## 这个项目解决什么问题

`zc` 主要解决 4 件事：

- **统一入口**
  - 用一套 `zc platform / zc toolkit` 命令处理平台安装、状态、更新和内容查询
- **结构化内容**
  - 用 `commands / skills / agents` 维护 AI 工作流内容，而不是散乱 prompt
- **平台原生安装**
  - 不同平台按官方支持的目录或扩展模型安装，不硬套一套假插件系统
- **可更新、可诊断**
  - 安装后可查看位置、状态、更新、修复、卸载，而不是“写完文件就结束”

## 支持的平台

| 平台 | 入口文件 | Commands | Skills | Agents | Extension / Plugin | 统一入口适配 |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` | Skill alias | Yes | zc-managed custom agents | zc-managed plugin / marketplace bundle | `zc:start -> $zc-start` |
| Claude Code | `CLAUDE.md` | Yes | - | Yes | - | `zc:start -> /zc-start` |
| OpenCode | `AGENTS.md` | Yes | Yes | Yes | - | `zc:start -> /zc-start` |
| Qwen | `QWEN.md` | Yes | Yes | Yes | Yes | `zc:start -> zc:start` |

补充说明：

- Codex 通过 `$zc-*` skill 别名承接统一语义
- Codex 的 agents / plugin / marketplace 是 `zc` 当前实现的打包与配置路径，不等同于给 Codex 发明通用 slash command 面
- Claude Code 和 OpenCode 通过 `/zc-*` 命令承接统一语义
- Qwen 通过 `zc:*` namespaced command 承接统一语义
- 这样做是为了避免和平台内置命令、社区插件或未来扩展冲突
- 更细的官方能力边界见 [docs/architecture/platform-capability-matrix.md](docs/architecture/platform-capability-matrix.md)

## 内容模型

这个仓库的内容不是一堆平铺文件，而是三层能力：

- `commands`
  - 任务入口和阶段入口
  - 例如：`start`、`product-analysis`、`spec`、`task-plan`、`build`、`quality-review`、`verify`
- `skills`
  - 完整 workflow 和专项方法
  - 例如：`sdd-tdd-workflow`、`debugging-and-error-recovery`、`documentation-and-adrs`
- `agents`
  - 常见协作角色模板
  - 例如：`architect`、`product-owner`、`code-reviewer`、`test-engineer`

当前固定 workflow 有 6 条：

- `product-analysis`
- `full-delivery`
- `bugfix`
- `review-closure`
- `docs-release`
- `investigation`

其中：

- `start` 是统一开始入口
- 它先做任务判型
- 再把任务引导到对应 workflow 的默认入口

完整内容清单见：

- [packages/toolkit/README.md](packages/toolkit/README.md)

## 常见操作

### 1. 看平台会装到哪里

```bash
zc platform where codex --global --json
zc platform where claude --global --json
zc platform where opencode --global --json
zc platform where qwen --global --json
```

### 2. 安装平台内容

```bash
zc platform install codex --global
zc platform install claude --global
zc platform install opencode --global
zc platform install qwen --global
```

### 3. 查看状态 / 更新 / 修复

```bash
zc platform status codex --global --json
zc platform update codex --global --plan --json
zc platform doctor codex --global --json
zc platform repair codex --global --plan --json
zc platform uninstall codex --global --plan --json
```

Qwen 用户级安装默认会优先走官方扩展链：

- 安装源：`https://github.com/zmice/zc-qwen-extension.git`
- 安装方式：`qwen extensions install`
- 更新方式：`qwen extensions update zc-toolkit`

### 4. 查询内容

```bash
zc toolkit lint --json
zc toolkit search review
zc toolkit show command:start
zc toolkit recommend build
```

## 如果你在维护这个仓库

常用命令：

```bash
pnpm install
pnpm build
pnpm audit:context
pnpm verify:mvp
pnpm verify
pnpm --dir apps/cli test
pnpm --dir packages/toolkit test
```

仓库分层：

- `apps/cli`
  - `zc` 统一入口 CLI
- `packages/toolkit`
  - `commands / skills / agents` 的唯一事实源
- `packages/platform-*`
  - 平台表达和安装实现
- `references`
  - 上游参考登记、快照和审阅记录
- `docs`
  - 长期架构、发布和使用文档

维护入口：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/README.md](docs/README.md)
- [docs/architecture/project-context.md](docs/architecture/project-context.md)

## 文档入口

如果你是普通使用者，优先看：

- [apps/cli/README.md](apps/cli/README.md)
- [docs/usage-guide.md](docs/usage-guide.md)

如果你是仓库维护者，再看：

- [packages/toolkit/README.md](packages/toolkit/README.md)
- [references/README.md](references/README.md)
- [docs/architecture/platform-capability-matrix.md](docs/architecture/platform-capability-matrix.md)
- [docs/release-guide.md](docs/release-guide.md)

## 参考项目与来源

这个仓库会参考公开项目和官方文档，但不会直接镜像或自动覆盖内容。

主要内容参考：

- [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills)
- [`obra/superpowers`](https://github.com/obra/superpowers)
- [`affaan-m/everything-claude-code`](https://github.com/affaan-m/everything-claude-code)
- [`garrytan/gstack`](https://github.com/garrytan/gstack)
- [`multica-ai/andrej-karpathy-skills`](https://github.com/multica-ai/andrej-karpathy-skills)

CLI 和安装语义还参考：

- [`Yeachan-Heo/oh-my-codex`](https://github.com/Yeachan-Heo/oh-my-codex)
- Codex / Claude Code / OpenCode / Qwen 官方文档

治理记录与上游登记清单见：

- [references/upstreams.yaml](references/upstreams.yaml)
- [references/README.md](references/README.md)

## 开发与验证

最低常用验证：

- 文档改动：`git diff --check`
- toolkit 内容改动：`zc toolkit lint --json` + 对应测试
- CLI 或平台逻辑改动：对应包测试 + `pnpm verify`
- 生成内容体量审计：`pnpm audit:context`

验证门禁分层：

- `pnpm verify:mvp`：发布态 smoke，覆盖构建、核心平台生成/安装和发布包可用性
- `pnpm verify`：全量本地门禁，覆盖 workspace 包 lint/test/build/generate
- `pnpm release:check`：发布门禁，叠加 changeset、全量验证和允许的 dirty path 检查

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
