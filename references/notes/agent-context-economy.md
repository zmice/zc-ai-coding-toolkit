# 子智能体上下文与执行检查点

## 失败基线与范围

2026-09-09 排查长任务时发现：主任务与 12 个子任务累计超过 1,200 次模型响应，单次输入最高超过 23 万 token。缓存输入占绝大多数，不能将累计输入量直接换算为套餐扣费，也不能将账号共享额度变化全部归因到单任务。

旧版已要求最小上下文和停止无效重试，但 Codex fork 规则位于深层参考文档，入口没有要求显式传参；返工轮数也没有约束单轮的持续工作。修改仅涉及 toolkit 内容，不改变模型、host 容量或计费配置。

## 行为对照

- Baseline：`e97b7c77300596532de9acf017bf76850dedf71e` 的 `start`、共享派发契约和 Codex lifecycle。
- Candidate：工作区同名资产，新增显式 fork、按收益选择批次、任务内检查点和协调消息约束。
- 预先确定的验收边界：独立任务只传必要上下文；无进展时收敛而不放弃用户目标；简单任务不增加无意义派发或重复验证；长任务有机会在扩大消耗前评估进展。
- 两个 `zc_code_reviewer` 使用 `fork_turns="none"`，分别只读 baseline 与 candidate；每个最多一次批量读取、不写文件、不继续派发。各自返回场景的下一步动作；不是执行完整开发任务的 A/B benchmark。

| 相同场景输入 | Baseline 首轮选择 | Candidate 首轮选择 | 判断 |
| --- | --- | --- | --- |
| 父历史 18 万 token，3 个自包含独立只读问题，3 个可用槽位 | 3 个 worker，显式 `none` | 3 个 worker，显式 `none` | 无行为差异；不能声称减少派发或继承量 |
| 80 次调用，最近两次检查无新证据且重复同一失败 | 停止分支，保留产物并由主线程调试 | 同样停止并收敛 | 保持无效重试防护 |
| 单文件文案，相关验证已通过且无新修改 | 不派审查，不重跑 | 不派审查，不重跑 | 保持简单任务路径 |
| 只读任务 12 次调用、6 分钟，持续有进展但未完成，未自定义检查点 | 继续读取；旧版无时间或调用次数触发 | 先返回进展、剩余问题与验证，由 controller 据新证据决定续跑 | 新增可观察的检查点行为 |

前 3 项仅作不回归检查，不作为改善证据；第 4 项证明检查点改变下一步动作。候选独立审阅未报告规则冲突。

## 验证与限制

- `pnpm --dir packages/toolkit test`：58/58 通过。
- `toolkit lint --json`：80 个资产，0 errors / 0 warnings。
- Codex generate plan：103 个产物，包含修改后的派发内容。
- `git diff --check`：通过。

检查点是可按范围调整的工作指导，不是运行时 token 硬限制。时间/调用数阈值尚未进行长任务实测，过于频繁的交接也可能增加协调成本；不得据此宣称具体节省比例。实际效果需要比较同类任务的去重请求量、缓存/未缓存输入、输出及验收完整性。源码修改不会自动更新已安装插件。

## 模型分配落地（2026-09-09）

用户随后确认实施模型分配优化：新增 `agent:lightweight-researcher`，固定 Luna/medium、只读；普通子任务默认 Terra/medium，现有 9 个专业角色档位保持不变。安装器增加默认字段合并与回执所有权，保留用户已有值及后续改写，旧回执兼容。

- 全量 `pnpm verify` 通过；CLI 边界补丁后重跑 CLI verify（251 passed / 1 skipped），最后 quoted dotted 防护再通过 98 项受影响测试并重建。
- 真实 CLI 在隔离目录验证全新配置和用户已有默认模型两种场景：同步、重复同步幂等、status、角色 hard pin 与卸载均通过。
- 独立审查发现 TOML 变体导致重复表的风险，修复后原 finding 已关闭；支持范围与拒绝策略见 `packages/platform-codex/README.md`。
- 本机通过 `platform agents codex --global --sync` 同步；独立 status 为 11/11 up-to-date，missing/drifted/stale/untracked 均为 0；`codex features list` 验证配置可解析。
- 同步前备份在 `C:\Users\zmice\.codex\platform-state\model-routing-backups\20260909-010053`。原有角色仅发生编码后的 CRLF/LF 差异，职责和模型保持一致。

这是本机 standalone agents 同步，不是插件发版。已启动的任务可能保留旧配置；新角色的运行时加载及实际额度节省仍需在后续新任务中核验，不将配置 status 当作模型调用或扣费证明。

## 开发服务器同步（2026-09-09）

经用户授权，将同一份已验证的本地 CLI 构建安装到 `dev-server` 的 `/home/zmice/.local`，并执行全局受管 agents 同步。构建仍标记 `0.11.0`，属于未发布本地构建，包 SHA256 为 `d48da391d805e07e73640b16167c0a6edbb2368482600a608e31daeb36bd56a7`。

- 同步后独立 SSH 进程复查：11/11 up-to-date，missing/drifted/stale/untracked 均为 0。
- 默认 Terra/medium；新增 Luna/medium 只读角色；原有 9 个角色语义与非受管配置保持一致。
- `codex features list` 配置解析通过，Codex 代理 wrapper 哈希保持一致。
- CLI、配置、角色及安装回执备份：`/home/zmice/.cache/zc-model-sync-jcTYFIP0/backup`；验证记录位于同级 `verification.json`。
- marketplace 插件继续使用正式版来源，未切换到本地构建。工作流源码随 CLI 包携带，不代表已安装插件的运行时规则已更新；新任务的角色加载和实际额度变化仍需后续核验。
