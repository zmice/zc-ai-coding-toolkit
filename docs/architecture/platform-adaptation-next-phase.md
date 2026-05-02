# Platform Adaptation Current State

## 目标

记录 `codex / claude / opencode / qwen` 平台适配深化后的当前事实，并明确后续维护边界。

继续坚持：

- 只实现官方文档明确支持的能力，或明确标注为 `zc` 自己的打包 / 配置路径
- 不把所有平台强行抽象成同一种插件模型
- 让 capability、install/status/doctor 输出、README 和 usage 文档保持一致

上一阶段优先级是：

1. `Qwen` 发布态扩展模型
2. `OpenCode` agents
3. `Claude` 能力再核查
4. `platform uninstall / repair / doctor`

这些能力已经进入当前可用状态。后续重点是事实对齐、上下文预算控制和 platform-core 去重，而不是继续新增平台 surface。

## 当前基线

### Codex

已支持：

- 项目级 `AGENTS.md`
- 用户级 `~/.codex/AGENTS.md`
- 项目级 / 用户级 `skills`
- `.codex/config.toml` / `config.toml` 注册 custom agent role
- `.codex/agents/zc-<agent>.toml` / `agents/zc-<agent>.toml`
- `zc platform plugin codex` 生成 repo-local 或 personal marketplace bundle
- 统一命令语义通过 `$zc-*` skill alias 暴露

当前定位：

- official commands 面继续保守，不发明 Codex slash command
- agents / plugin / marketplace 是 `zc` 当前实现的打包与配置路径，不写成所有 Codex 安装面的官方承诺

### Claude Code

已支持：

- `CLAUDE.md`
- `.claude/commands/zc-*.md`
- `.claude/agents/zc-*.md`
- user / project / `--dir` 三种 scope

当前定位：

- 官方目录化安装
- 不补 `skills`
- 不抽象成插件模型

### OpenCode

已支持：

- `AGENTS.md`
- `.opencode/commands/zc-*.md`
- `.opencode/skills/zc-*/SKILL.md`
- `.opencode/agents/zc-*.md`
- user / project / `--dir` 三种 scope

当前定位：

- 官方目录化安装
- 覆盖 `commands + skills + agents`
- 不额外扩展更深的运行时 agent 配置语义

### Qwen

已支持：

- 完整 extension 目录生成
- 项目级 extension 目录安装
- 用户级优先调用官方 `qwen extensions` CLI
- `zc platform generate qwen --bundle release-bundle --dir <path>`
- `scripts/export-qwen-extension-bundle.mjs`
- GitHub Actions 同步独立 extension repo
- `QWEN.md + qwen-extension.json + commands + skills + agents`

当前定位：

- 内容模型已经是 extension
- 开发态 source bundle 与发布态 release bundle 已分开
- 仍未直接承诺 `qwen extensions install <git-url>`、扩展仓库 tag/release/version 自动管理或 marketplace 发布

## 运维能力

`platform status / update / uninstall / repair / doctor` 已经落地。

维护原则：

- receipt 是 status、repair、uninstall 的事实依据
- `repair` 基于当前 install plan 重写漂移或缺失 artifact
- `uninstall` 只删除受管 artifact；Qwen CLI 管理场景优先调用官方卸载
- `doctor` 只聚合健康度、问题列表和下一步建议，不维护第二套安装逻辑

## 后续重点

1. 用 `pnpm audit:context` 定期检查各平台生成内容体量
2. 如果默认安装继续膨胀，按 `tier / audience / platform_exposure` 收紧默认资产集
3. 把 platform 包重复的 frontmatter、slug、asset list、artifact 构建逻辑下沉到 `platform-core`
4. 若要扩大 Codex custom agents 或 marketplace 叙述，先重新核官方文档，再更新 capability matrix

## 成功标准

- Qwen 发布态 extension bundle 模型保持清晰
- OpenCode 持续支持官方 `agents` 目录
- Claude 保持保守，不发明插件或 skills 目录
- Codex 文档明确区分官方能力边界与 `zc` 打包路径
- `where/install/status/doctor --json` 与 capability 输出一致
- README、usage guide、capability matrix 与实现不再分裂
