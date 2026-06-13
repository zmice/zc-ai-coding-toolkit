初始化 Codex 项目上下文索引，让项目根入口保持薄、稳定、可维护，并把详细项目事实放进按需读取的 `.codex/context/`。

## 何时使用

- 新项目第一次接入 zc-toolkit / Codex。
- 已有项目上下文不足，AI 经常需要重复摸底。
- 项目结构、验证命令、模块边界或根入口规则发生变化。
- 多 agent 或长任务开始前，需要先给 agent 准备稳定的最小上下文包。

不要把所有 skill、全部源码或临时探索记录塞进 `AGENTS.md`。项目根入口只放长期规则、路由和上下文索引。

## 默认命令

```bash
zc context init --plan
zc context init --write
zc context init --write --dir <project-root>
```

当前 CLI 默认是 dry-run；即使不写 `--plan`，也只输出将创建/更新的文件。只有 `--write` 才写入。

## 产物结构

```text
AGENTS.md
.codex/context/project.md
.codex/context/commands.md
.codex/context/modules/README.md
.codex/context/manifest.json
```

- `AGENTS.md`：项目根薄入口。只追加或替换 `zc-context:init` managed block，不覆盖用户已有内容。
- `.codex/context/project.md`：项目级上下文地图，包括读取顺序、项目事实、目录入口和维护触发器。
- `.codex/context/commands.md`：常用命令、测试和验证选择。
- `.codex/context/modules/README.md`：模块入口索引，帮助 AI 按任务渐进式读取。
- `.codex/context/manifest.json`：生成时间、产物列表、维护触发器和 provenance。

## 主动维护规则

AI 在以下情况必须主动提示或执行刷新：

- 新增、删除或移动模块目录。
- `package.json` scripts、验证命令、安装方式或平台入口发生变化。
- 根 `AGENTS.md` 路由、项目约定或冻结边界变化。
- 子代理报告 `NEEDS_CONTEXT`、上下文过旧、路径不存在或命令漂移。
- 长会话进入新阶段，需要把探索结论提升为稳定项目事实。

主动维护不等于自动写入用户级配置、跨项目记忆或跨机器同步。那些属于持久化行为，必须单独说明影响并获得授权。

## 子代理维护模式

长任务或多 agent 任务中，优先把上下文维护交给 `agent:context-steward`，避免打断主流程：

1. context steward 审计 `AGENTS.md`、`.codex/context/**`、package scripts、README 和模块入口。
2. 运行 `zc context init --plan --json` 获取候选变更和 provenance。
3. 如果候选变更只涉及 `.codex/context/**` 和 `AGENTS.md` 的 `zc-context:init` managed block，context steward 可直接执行 `zc context init --write --json`。
4. 返回 `Context stewardship` 报告，说明 `fresh / stale / missing / conflict / updated`、实际写入文件、命令输出和风险。
5. 只有出现同文件冲突、来源不明、需要修改用户手写规则或越过项目上下文边界时，才停在 fan-in 等主线程决策。

如果当前平台没有可用子代理，则主线程按同一边界执行 dry-run 或 scoped_write，并在继续主流程前只保留必要结论。

## 上下文装载策略

1. 先读根 `AGENTS.md`，拿长期规则和上下文索引。
2. 读取 `.codex/context/project.md`，确认项目边界和读取顺序。
3. 按任务选择 `.codex/context/commands.md` 或 `.codex/context/modules/README.md`。
4. 最后只读取本次要改的源码、测试、配置和错误输出。

如果上下文项没有 provenance、来源不明或疑似过期，要显式说明并优先刷新，不要把旧结论当事实。

## 安全边界

- 不覆盖用户手写 `AGENTS.md` 内容；只维护受标记保护的 managed block。
- 不默认写用户级 `~/.codex` 配置。
- 不把临时 worklog、agent transcript 或未验证推断写入长期上下文。
- 不承诺其他平台也支持同样命令；这一版只按 Codex 项目上下文处理。

## 验证

完成前至少给出：

- `zc context init --dir <project-root> --json` 的 dry-run 结果，或 `--write --json` 的写入结果。
- `git diff --check`。
- 如果改了 CLI：运行对应 `apps/cli` 测试。
