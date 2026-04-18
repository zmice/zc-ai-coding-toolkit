# Spec: Platform 深化 Contract

## Objective

把 `platform` 相关能力收束成一个统一 contract，解决当前三类问题：

1. `platform` 共享逻辑分散在 `packages/platform-qwen`、`packages/platform-codex`、`packages/platform-qoder` 内部，重复实现太多。
2. `generate` / `install` 的语义不一致，尤其是写文件、覆盖文件、冲突处理的规则不够明确。
3. CLI 只能“能跑”，但缺少稳定的 UX contract，导致未来新增平台、模板或安装策略时容易漂移。

本阶段只定义规格，不改代码。

### Assumptions

- `zc platform` 仍然是平台相关能力的唯一 CLI 命名空间。
- `packages/toolkit` 继续作为内容真源，platform 只负责把 toolkit manifest 转成平台产物。
- `generate` 是产物生成/导出流程，`install` 是面向目标目录的落地流程。

## Tech Stack

- TypeScript
- Node.js `fs/promises`
- `commander` CLI
- 现有 workspace 包：
  - `apps/cli`
  - `packages/toolkit`
  - `packages/platform-qwen`
  - `packages/platform-codex`
  - `packages/platform-qoder`

## Commands

验证和查看 contract 的标准命令：

- `pnpm --dir apps/cli test`
- `pnpm --dir apps/cli build`
- `pnpm --dir packages/platform-qwen test`
- `pnpm --dir packages/platform-codex test`
- `pnpm --dir packages/platform-qoder test`
- `pnpm verify`

CLI contract 命令：

- `node apps/cli/dist/cli/index.js platform generate <target> [-o <dir>]`
- `node apps/cli/dist/cli/index.js platform install <target> -o <dir> [--force] [--dry-run]`

## Project Structure

规格所定义的目标结构如下：

- `apps/cli/src/cli/platform.ts`
  - 只做命令解析、参数校验、结果打印，不承载平台模板逻辑
- `packages/platform-core/src/**`
  - 新增的共享 contract 层，负责 plan、context、冲突检查、输出状态模型
- `packages/platform-*/src/**`
  - 平台适配层，只保留平台特化模板、文件名、额外产物和少量渲染差异
- `packages/platform-*/templates/**`
  - 平台特化模板资产
- `packages/toolkit/src/**`
  - 资产真源，platform 只读不写

## Core Contract

`platform core` 负责所有平台都必须一致的逻辑，平台包不应各自重复实现：

- toolkit manifest 的读取结果归一化
- 资产筛选规则：按 `asset.platforms` 过滤匹配目标平台
- plan 的纯函数构建
- artifact 顺序稳定化
- install 冲突检测
- 目标路径解析
- CLI 结果摘要字段

`platform core` 不负责的内容：

- 模板正文
- 文件名
- 平台专有 JSON/Markdown 结构
- 平台专有提示语
- 平台专有安装落点规则

### Normative Plan Shape

平台层必须以“plan”作为唯一中间契约，而不是直接拼文件写盘。

```ts
type PlatformName = "qwen" | "codex" | "qoder";

interface PlatformAsset {
  id: string;
  kind: "skill" | "command" | "agent";
  platforms: readonly PlatformName[];
  title?: string;
  summary?: string;
  body?: string;
}

interface PlatformArtifact {
  path: string;   // 相对路径，使用平台自身约定的文件名
  content: string; // UTF-8 文本
}

interface PlatformTemplateContext {
  platform: PlatformName;
  packageName: string;
  manifestSource: string;
  counts: {
    total: number;
    matched: number;
  };
  matchedAssets: readonly PlatformAsset[];
  artifactNames: readonly string[];
}

interface GenerationPlan {
  platform: PlatformName;
  packageName: string;
  manifestSource: string;
  templateContext: PlatformTemplateContext;
  matchedAssets: readonly PlatformAsset[];
  artifacts: readonly PlatformArtifact[];
}

interface InstallPlan extends GenerationPlan {
  destinationRoot: string;
  overwritePolicy: "error" | "force" | "skip";
  conflicts: readonly string[];
}

interface InstallResult {
  plan: InstallPlan;
  writtenPaths: readonly string[];
  skippedPaths: readonly string[];
  overwrittenPaths: readonly string[];
}
```

## Artifact Plan

artifact plan 的 contract 必须满足：

- `artifacts` 是 plan 的唯一输出集合
- 每个 artifact 必须声明相对路径和文本内容
- artifact 顺序必须稳定，不能依赖对象枚举顺序
- 同一个输入 manifest + 同一组选项，必须得到字节级稳定输出
- `generate` 和 `install` 复用同一组 artifact 定义，只在目标根目录和覆盖策略上不同

### What is Shared

- asset 过滤与计数
- artifact 列表结构
- 输出摘要格式
- error model

### What is Platform-Specific

- 文件名
- artifact 数量
- 每个文件的正文结构
- 额外平台文件，例如 `qwen-extension.json`
- 模板中的引导语和标题

## Install Plan

`install` 的 contract 比 `generate` 更严格，因为它面向用户目录，必须显式处理冲突。

### Install Behavior

- `destinationRoot` 必须是显式输入
- install plan 必须在写盘前完成全部冲突检查
- 如果任一目标文件已存在且内容不同，默认不覆盖
- 如果存在冲突但用户显式要求覆盖，则允许覆盖
- 如果用户选择 dry run，则只返回计划和冲突结果，不写盘

### Overwrite Policy

默认策略是 `error`：

- 文件不存在：写入
- 文件存在且内容相同：视为 `skip`，不报错
- 文件存在且内容不同：报错并停止，除非 `--force`

扩展策略：

- `force`：覆盖所有冲突文件
- `skip`：保留已有文件，只写入不存在的文件

### Why this policy

- 降低误覆盖用户手写配置文件的风险
- 让 install 语义成为“可预测的落地动作”，而不是“盲写”
- 支持 CI、脚本和人工操作三种场景

## Template Context

template context 必须统一，平台渲染器只能在这个上下文上做特化，不允许自行重新读取或推断 toolkit 状态。

### Shared context fields

- `platform`
- `packageName`
- `manifestSource`
- `matchedAssets`
- `artifactNames`
- `counts`，至少包含总量和匹配量

### Asset normalization rules

- `title` 优先于 `summary`
- `summary` 优先于 `id`
- `body` 必须保留为原始文本，渲染器可读取但不可改写
- 资产顺序沿用 manifest 顺序，除非平台 spec 明确要求重排

### Platform-specific context

- `qwen`
  - `contextFileName`
  - `extensionManifestName`
  - `extensionManifest` 的字段结构
- `codex`
  - `agentsFileName`
- `qoder`
  - `instructionsFileName`

平台特化内容必须挂在命名清晰的子字段下，不能污染共享字段。

## CLI UX Contract

### `zc platform generate`

- 语义：根据 toolkit manifest 生成平台产物到输出目录
- 必需参数：`<target>`，取值只能是 `qwen | codex | qoder`
- 可选参数：`-o, --out <dir>`
- 默认输出目录：`.generated/<target>`
- 输出行为：
  - 成功时打印目标平台、输出目录、产物数量
  - 不要求安装到用户目录
  - 不应产生与平台无关的额外文件
- 错误行为：
  - 未知 target 直接失败
  - manifest 读取失败直接失败
  - 写盘失败直接失败

### `zc platform install`

- 语义：将平台产物安装到指定目标目录
- 必需参数：`<target>` 和 `-o, --out <dir>`
- 默认 overwrite policy：`error`
- 可选参数：
  - `--force`：覆盖冲突文件
  - `--dry-run`：只显示计划，不写盘
- 输出行为：
  - 成功时打印目标平台、安装根目录、写入/跳过/覆盖数量
  - 冲突时必须列出冲突路径
  - dry-run 必须显式标记为预览，不可让用户误以为已安装

### CLI Output Contract

用户可见输出必须满足：

- 中文优先，技术标识保留原文
- 错误信息必须包含可操作信息，不能只有“失败了”
- `generate` / `install` 的成功输出必须能让用户确认：
  - target 是什么
  - 输出/安装目录是什么
  - 影响了多少个 artifact
  - 是否发生覆盖或跳过

## Testing Strategy

规格对应的验证策略如下：

- 单元测试
  - plan 构建的纯函数行为
  - 资产筛选与稳定排序
  - overwrite policy 决策
- 集成测试
  - `apps/cli` 对 `platform generate/install` 的参数和输出
  - 平台包的 plan 输出与 artifact 文件名
- 约束测试
  - 同一 manifest 多次生成结果一致
  - install 冲突时默认拒绝覆盖
  - `--force` 行为可覆盖冲突文件

## Boundaries

- Always:
  - 平台相关逻辑先进入 plan，再进入写盘
  - 共享逻辑放到 shared core，平台包只保留特化部分
  - install 必须做冲突检查
  - CLI 必须保留稳定、可读、可测试的 UX contract
- Ask first:
  - 是否新增平台 target
  - 是否改变默认 overwrite policy
  - 是否引入新的 install flag
  - 是否变更现有平台文件名
- Never:
  - 让平台包各自私自定义 plan 结构
  - 让 CLI 直接拼接平台模板正文
  - 未经确认就把手写文件静默覆盖
  - 让 `packages/toolkit` 变成平台特化逻辑的容器

## Success Criteria

以下条件全部满足时，platform 深化 contract 才算完成：

- 对任意同一份 toolkit manifest，三个平台包的 generation plan 都是纯函数、可重复、稳定的
- 共享逻辑不再以三份不同实现散落在平台包内
- `generate` 和 `install` 使用同一套 plan contract，只在目标根目录和 overwrite policy 上不同
- install 默认不会静默覆盖已有不同内容的文件
- CLI 能明确表达 target、输出目录、冲突路径、覆盖行为和 dry-run 状态
- 三个平台的生成和安装路径都有对应的可执行测试
- 规格本身足够具体，后续实现者不需要再猜“什么算成功”

## Open Questions

- `platform-core` 的物理位置是独立 package，还是先以共享模块/内部库形式落地
- `generate` 是否只负责输出到临时/构建目录，还是继续允许用户指定任意输出目录
- install 冲突时是否只保留 `error / force / skip` 三态，还是需要更细的 per-file 策略
- 是否要把 `--dry-run` 同时开放给 `generate`
