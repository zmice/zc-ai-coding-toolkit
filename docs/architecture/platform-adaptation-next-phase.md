# Platform Adaptation Next Phase

## 目标

在当前 `codex / claude / opencode / qwen` 平台适配已经成型的基础上，继续深化平台原生能力，但仍然坚持：

- 只实现官方文档明确支持的能力
- 不把所有平台强行抽象成同一种插件模型
- 先把发布态、目录能力和运维语义做稳，再考虑更深的平台分发

本阶段的优先级固定为：

1. `Qwen` 发布态扩展模型
2. `OpenCode` agents
3. `Claude` 能力再核查
4. `platform uninstall / repair / doctor`

## 当前基线

### Codex

- 已支持：
  - 项目级 `AGENTS.md`
  - 用户级 `~/.codex/AGENTS.md`
  - 用户级 `~/.codex/skills`
  - 统一命令语义通过 `$zc-*` skill alias 暴露
- 当前定位：
  - `AGENTS.md + skills`
  - 不发明没有官方依据的 `commands/` / `agents/`

### Claude Code

- 已支持：
  - `CLAUDE.md`
  - `.claude/commands/zc-*.md`
  - `.claude/agents/zc-*.md`
  - user / project / `--dir` 三种 scope
- 当前定位：
  - 官方目录化安装
  - 不抽象成插件模型

### OpenCode

- 已支持：
  - `AGENTS.md`
  - `.opencode/commands/zc-*.md`
  - `.opencode/skills/zc-*/SKILL.md`
  - user / project / `--dir` 三种 scope
- 当前定位：
  - 官方目录化安装
  - 第一版还未覆盖 `agents`

### Qwen

- 已支持：
  - 完整 extension 目录生成
  - 项目级 extension 目录安装
  - 用户级优先调用官方 `qwen extensions` CLI
  - `QWEN.md + qwen-extension.json + commands + skills + agents`
- 当前定位：
  - 内容模型已经是 extension
  - 安装链仍然偏开发态 `link/relink`

## 核心判断

### 1. Qwen 现在缺的不是内容，而是发布态扩展模型

当前 Qwen 已经能生成完整 extension bundle，但安装链主要围绕本地 source bundle 和 `link/relink` 工作。

这意味着：

- 开发态可用
- 用户级可管理
- 但还不是一个真正可发布、可分发、可独立识别版本的 extension 模型

本阶段最重要的收口点是：

- 区分开发态 source bundle 与发布态 extension bundle
- 让 Qwen extension 可以被当成独立产物看待
- 为后续仓库地址安装或 npm / marketplace 分发留出清晰边界

### 2. OpenCode agents 是已经有官方依据但当前未覆盖的缺口

OpenCode 官方文档已经明确支持 `agents` 目录。

当前仓库里：

- 能力矩阵已记录官方支持
- 平台包 README 仍写第一版不上 agents
- 实现和测试也显式忽略 `agent` 资产

因此这不是发明新模型，而是把实现追上已经记录的官方能力。

### 3. Claude 需要继续保守

Claude 现在已经覆盖了官方明确的：

- `CLAUDE.md`
- `.claude/commands`
- `.claude/agents`

下一步应当做的是：

- 再核一次官方文档
- 确认是否有新增且明确的 surface
- 在没有强依据前，不补 `skills`，也不补插件抽象

### 4. uninstall / repair / doctor 必须在前三项稳定后再做

当前 receipt / status / update 已经存在，但各平台的产物模型还在收敛期。

因此：

- 先稳定平台 surface
- 再做 `uninstall / repair / doctor`

这样可以避免在平台模型还在变时，把运维命令做成第二套易漂移的逻辑。

## 下一阶段目标

### Phase 1: Qwen 发布态扩展模型

最小目标：

- 明确“发布态 extension bundle”的目录 contract
- 让 bundle 可被稳定导出
- 让版本来源、bundle 名称、内容指纹、extension manifest 语义明确
- 文档中区分：
  - 开发态 source bundle
  - 发布态 extension bundle

本阶段不直接承诺：

- GitHub 仓库地址安装
- npm 扩展发布
- marketplace 发布

这些能力可以在发布态 bundle 稳定后再接。

当前新增的直接落地点：

- 仓库内可以直接导出独立 bundle：
  - `zc platform generate qwen --bundle release-bundle --dir <path>`
  - 或 `node scripts/export-qwen-extension-bundle.mjs --out <path>`
- GitHub Actions 已支持把该 bundle 同步到独立扩展仓库：
  - `.github/workflows/publish-qwen-extension-repo.yml`
  - 通过 `workflow_dispatch` 手动触发
  - 使用 `QWEN_EXTENSION_REPO_TOKEN` 把导出的 bundle 覆盖同步到目标仓库根目录

这意味着：

- 当前已经具备“主仓库生成 + 独立扩展仓库发布”的基础能力
- 但还没有直接实现：
  - `qwen extensions install <git-url>`
  - 针对扩展仓库的 tag/release/version 自动管理

后续如果要走仓库地址安装，建议直接把独立扩展仓库根目录保持为 release bundle 结构。

### Phase 2: OpenCode agents

最小目标：

- 项目级：`.opencode/agents/zc-<agent>.md`
- 用户级：`~/.config/opencode/agents/zc-<agent>.md`
- `--dir`：`agents/zc-<agent>.md`
- `where/install/status --json` 能正确暴露 `agents-dir`

本阶段不额外扩展：

- 自定义 OpenCode agent 配置语义
- 更深的运行时行为

### Phase 3: Claude 能力再核查

最小目标：

- 基于官方文档重新核一轮 Claude 能力边界
- 若没有新增明确 surface，则只做：
  - 入口文案深化
  - command / agent 投影收紧
- 保持“目录化原生安装，不发明插件模型”

### Phase 4: platform uninstall / repair / doctor

最小目标：

- `uninstall`
- `repair`
- `doctor`

原则：

- 基于 receipt 和 capability 工作
- 先做跨平台一致的 contract
- 平台特化只补诊断信息，不维护第二套安装逻辑

## 设计原则

### 平台优先于抽象

不同平台应按自己的官方模型处理：

- `Codex`：`AGENTS.md + skills`
- `Claude`：entry file + native directories
- `OpenCode`：entry file + native directories
- `Qwen`：extension lifecycle

### 发布态与开发态分离

尤其对 Qwen：

- 开发态可以使用本地 source bundle 和 `link`
- 发布态必须有独立 bundle contract

### capability 先于实现

新增或深化任何平台能力前，先在 capability matrix 和长期文档中固定边界。

### 先补官方明确能力，再做运维命令

`uninstall / repair / doctor` 不应跑在平台能力矩阵前面。

## 成功标准

完成这一轮后，应满足：

1. Qwen 有清晰的发布态 extension bundle 模型
2. OpenCode 已支持官方 `agents` 目录
3. Claude 的能力边界再次核实，并保持保守实现
4. 新平台能力与 `where/install/status --json` 输出一致
5. 文档、README、capability matrix 与实现不再分裂
