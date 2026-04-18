# Platform Install Versioning Spec

## Objective

为 `zc platform install` 增加可追踪、可查询、可更新的安装模型，解决当前“只能重新覆盖安装，但无法判断是否需要更新”的问题。

本次只覆盖：

- 安装回执（install receipt）
- 安装状态查询（status）
- 基于状态的更新（update）
- 生成产物的最小版本元数据

本次不覆盖：

- 远端版本检查
- 平台级自动升级策略
- toolkit 内容 diff 可视化
- 非 `zc` 安装方式的兼容迁移

## Current Gaps

当前 `zc platform install` 的行为是：

- 从 toolkit manifest 读取内容
- 生成平台产物
- 直接写入目标目录
- 输出写入结果

当前缺少：

- 已安装内容的本地回执
- 可比较的内容版本标识
- `status` 命令
- `update` 命令
- “当前是否落后”的判断依据

因此现在的“更新”只能依赖再次执行：

```bash
zc platform install codex --project --force
```

这本质上是重装，不是可追踪升级。

## Assumptions

1. 对外发布仍然只围绕 `@zmice/zc`。
2. 版本追踪应基于本地已安装元数据，不依赖联网。
3. project/global/dir 三种安装模式都需要统一的回执模型。
4. `status` 必须是只读命令，不允许写入目标目录。
5. `update` 应复用现有 install/generate 逻辑，而不是维护第二套写入实现。

## User-Facing Commands

新增命令：

```bash
zc platform status <qwen|codex|qoder>
zc platform update <qwen|codex|qoder>
```

命令参数保持与 `install/where` 一致：

- `--project`
- `--global`
- `--dir <path>`
- `--json`
- `--force` 仅用于 `update`
- `--plan` 仅用于 `update`

行为约束：

- `status`
  - 解析目标目录
  - 读取 install receipt
  - 比较当前 `zc` 生成指纹与已安装指纹
  - 输出 `up-to-date / drifted / not-installed`
- `update`
  - 先执行与 `status` 同样的比较
  - 若已是最新，默认不写入
  - 若落后或漂移，生成更新计划并执行写入
  - `--plan` 时只输出更新计划，不落盘

## Install Receipt Model

新增安装回执文件：

- project/dir/global 安装统一写到：
  - `<target-root>/.zc/platform-state/<platform>.install-receipt.json`

说明：

- receipt 固定放在目标根目录下的 `.zc/platform-state/`
- 每个平台一份 receipt，避免同一目录下不同平台互相覆盖
- status/update 只认该路径，不扫描其他历史位置

建议结构：

```json
{
  "schemaVersion": 1,
  "platform": "codex",
  "destinationRoot": "/repo",
  "manifestSource": "packages/toolkit/src/content#generatedAt=2026-04-19T00:00:00.000Z",
  "overwrite": "error",
  "installedAt": "2026-04-19T00:00:00.000Z",
  "zcVersion": "0.1.2",
  "contentFingerprint": "<sha256>",
  "artifacts": [
    {
      "path": "/repo/AGENTS.md",
      "sha256": "<sha256>",
      "bytes": 1234
    }
  ]
}
```

## Version Identity

本次不引入独立“内容版本号”，而采用两层标识：

- `zcVersion`
- `contentFingerprint`

其中：

- `zcVersion`
  - 来自 CLI 包版本
  - 面向用户解释“当前内容由哪个 zc 版本安装”
- `contentFingerprint`
  - 基于平台 generation plan 稳定计算
  - 真正用于比较“内容是否变化”

原因：

- `zc` 版本本身不能精确代表内容是否变化
- 仅靠 toolkit `generatedAt` 也不够稳，因为会受构建时刻影响
- 用产物计划计算指纹最直接，且与用户实际安装结果一致

## Artifact Metadata

本次不在产物正文里注入额外版本头信息。

原因：

- 指纹需要稳定，直接写进正文会形成自引用问题
- 版本追踪以 install receipt 为唯一真相更简单
- 平台产物仍保持平台可消费的最小形态

## Platform Core Contract Changes

`packages/platform-core` 需要扩展：

- `GenerationPlan`
  - 增加稳定 fingerprint 输入能力，或提供生成 fingerprint 的 helper
- `InstallPlan`
  - 继续只负责产物写入计划
  - 不直接耦合 receipt 写入

设计原则：

- receipt 由 `apps/cli` 负责
- platform-core 负责生成“可被指纹化”的稳定 plan
- platform 包不各自实现一套 receipt 逻辑

## Toolkit Inputs

`toolkit` 本次不需要新增独立版本字段，但应允许 CLI 读取：

- manifest `generatedAt`
- asset 列表与内容

如后续需要更稳定的内容身份，可再考虑补：

- manifest-level hash

但本次优先使用 platform generation plan 计算 fingerprint，不强依赖 toolkit schema 变更。

## Status Algorithm

`zc platform status <target>`：

1. 解析目标目录
2. 读取 install receipt
3. 若无 receipt：
   - 输出 `not-installed`
4. 若有 receipt：
   - 重新加载 toolkit manifest
   - 重新生成该平台 generation plan
   - 计算当前 `contentFingerprint`
   - 比较 receipt 中的 fingerprint
5. 输出：
   - `up-to-date`
   - `update-available`
   - `drifted`

其中：

- `update-available`
  - receipt 存在
  - 当前 plan fingerprint 与 receipt 不同
  - 目标产物仍可识别
- `drifted`
  - receipt 存在
  - 但产物缺失或被手工修改到与 receipt 不一致

## Update Algorithm

`zc platform update <target>`：

1. 解析目标目录
2. 读取 status
3. 若 `not-installed`
   - 报错并提示先运行 `install`
4. 若 `up-to-date`
   - 直接输出“已是最新”
5. 若 `update-available` 或 `drifted`
   - 构建 install plan
   - `update-available` 视为受管内容升级，默认安全覆盖
   - `drifted` 需要显式 `--force`
   - 写入成功后更新 receipt

## Output Model

`--json` 输出需要稳定包含：

- `mode`
- `action`
- `target`
- `scope`
- `root`
- `status`
- `zcVersion`
- `installedZcVersion`
- `contentFingerprint`
- `installedContentFingerprint`
- `artifacts`
- `receiptPath`

## Testing Strategy

### Unit

- receipt 读写
- fingerprint 稳定性
- status 比较逻辑
- update 的 not-installed / up-to-date / drifted 分支

### CLI

- `platform status`
- `platform update --plan`
- `platform update --json`
- global/project/dir 三种解析

### Workspace Verify

新增 smoke：

- install 后存在 receipt
- status 在 fresh install 后返回 `up-to-date`
- update 在 fresh install 后默认 no-op
- 手工修改产物后 status 返回 `drifted`

## Boundaries

- Always:
  - 本地可判断是否需要更新
  - install/update 写入后必须更新 receipt
  - status 只读
- Ask first:
  - 引入独立内容版本号
  - 把 receipt 聚合回单文件
- Never:
  - 依赖联网判断更新
  - 仅靠产物正文判断状态
  - 为每个平台分别实现不同 receipt 协议

## Success Criteria

- 用户可执行 `zc platform status <target>` 判断是否已安装、是否最新
- 用户可执行 `zc platform update <target>` 完成真正的升级，而不是手工重装
- 安装状态在 project/global/dir 三种模式下都可追踪
- 输出可脚本化，且不影响现有 install/generate/where 行为
