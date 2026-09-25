# 子代理优化实施与验收

## 已实施

- 10 个角色迁移到 GPT-6：普通角色和默认子任务 Sol/medium；审查、架构、安全、性能 Sol/high；轻量研究与上下文维护 Luna/high。主任务模型、service tier 与 sandbox 边界未改。
- 收敛机械小任务的 review 深度；明确父子读取范围、可调整输出预算、任务内检查点、两次无进展停线与完成即返回。
- 审查增加固定 diff identity、工作树 patch/文件哈希、untracked 与二进制记账、逐文件回执、零选中文件阻断及 finding 证伪。完整记账不等于完整审查。
- 计划增加隐含风险到 owner、验证和 stop gate 的映射。
- 修复锁文件在存在检查与 realpath 之间消失的竞态。确定性复现先失败，修复后 27 项 worktree 测试通过；仅 ENOENT 回退，不吞权限错误。

源码唯一事实源仍为 `packages/toolkit/src/content/`。模型矩阵与生成器测试保留了旧模型 fixture，确保用户自定义模型仍原样生成。

## 验证证据

- `pnpm verify` 退出码 0：包含全部包测试与构建；CLI 253 passed / 1 skipped。
- 最后内容调整后重跑 toolkit：58/58；lint：81 assets / 0 warnings / 0 errors；CLI 重建成功。
- `git diff --check` 通过。
- 独立只读 reviewer 检查竞态修复、路径边界和默认值所有权，无运行正确性或安全阻断。其“卸载残留空 [agents]”建议经 controller 复核降为非阻断：空表合法且不改变语义，现有 receipt 未拥有表头；不为清理空表扩大用户配置删除范围。
- 本轮不是对全部历史 dirty 文件的发布审查，没有提交、发布或宣称可直接合并。

## 固定模型小样本

相同六项合成材料覆盖定位、文档核查、竞态伪代码修复、配置合并、审查漏覆盖和租户授权。无文件修改、工具或独立实现验收，因此只属于推理/动作选择 smoke。实际 prompt、回答、线程、`turn_context` 模型和用量见 `subagent-model-pilot-2026-09-26.json`。

| 模型 | effort | 输入 | 缓存输入 | 输出（含 reasoning） | 总墙钟秒 | 人工评分 |
|---|---|---:|---:|---:|---:|---|
| 5.6 Terra | high | 27,146 | 0 | 368 | 52.791 | 6/6 主要求满足 |
| 6 Sol | high | 26,814 | 7,296 | 552 | 60.992 | 6/6 主要求满足 |
| 5.6 Luna | medium | 24,267 | 0 | 594 | 51.729 | 6/6 主要求满足 |
| 6 Luna | high | 26,243 | 0 | 356 | 51.755 | 6/6 主要求满足 |

只有一次同题调用，评分非盲，缓存、模型元数据和启动网络存在差异，不能推出总任务质量、额度或普遍速度收益。没有通过静态费率替代账户实际扣费。还缺实际修改任务的修复正确性、返工和安全/架构深度回归样本。

## 指导语对照与边界

baseline 固定为 HEAD `e97b7c77300596532de9acf017bf76850dedf71e`，不把已有 dirty 当作无修改基线。完整 guidance 的 CLI A/B 被自动审批拒绝：未明确授权这批内部文档向外部 Codex 服务发送。未绕过或重发；下表是本地人工规则核对，不是运行时行为提升证据。

| 场景 | 验收动作 | 对照结果 |
|---|---|---|
| review 正例：全部覆盖、阻断项修复且回归通过 | 可给有证据的 Approve | 保持；候选增加可追溯回执 |
| review 边界：changed 文件遗漏、测试默认排除 | 阻断整体通过、补清单和补审 | 候选给出明确记账/零选中门禁 |
| review 负例：仅文案修正已验收 | 不以全面审查扩展全仓读取 | 保持低风险路径 |
| build 正例：互斥中等复杂度任务 | 明确所有权、派发和独立 review | 保持 |
| build 边界：机械单文件无风险变化 | 自审加 controller，不强制 reviewer | 消除正文与深度表的矛盾 |
| build 负例：连续两检查点无进展 | 停分支、保留产物、改变输入/接手 | 保持并明确停线 |
| debug 正例：复现与边界已确认 | 最小修复和回归 | 未改 debug，保持 |
| debug 边界：未复现、只有假设 | 不宣称已定位或修复 | 未改 debug，保持 |
| debug 负例：仅询问函数含义 | 不擅自修改或启动修复 | 未改 debug，保持 |

新任务角色探针第一次自报“不支持 fork_turns”，没有派发；第二次日志实际记录 `spawn_agent` 使用 `zc_lightweight_researcher` 和 `fork_turns=none`，返回 `/root/role_probe`。第一条自报不能证明平台能力缺失。未取到子任务自身 `turn_context`，角色实际模型验收仍为 inconclusive；不以父任务模型或角色配置代替。指导语据此要求核对实际 schema，不传未知参数、不虚报隔离。

## 本机与开发服务器

- 本机受管 agents：11/11 up-to-date，missing/drifted/stale/untracked 均 0，配置解析通过。非受管配置内容对比一致。
- 本机备份：`C:\Users\zmice\.codex\platform-state\model-routing-backups\20260926-implementation`。
- `dev-server` 使用相同本地构建更新 `/home/zmice/.local`；独立 status 11/11 一致，非受管配置一致，Codex wrapper SHA-256 未变，配置解析通过。
- 服务端备份和回执：`/home/zmice/.cache/zc-model-sync-20260926/`，旧 CLI、配置、角色和回执位于 `backup/`。
- 最终 CLI 包 SHA-256：`ad6513326aa0cc0d63b4f7e87f4c873e6d6ea40b8f957505cf6014a6c3b926bc`；两端一致。仍为未发布的 0.11.0 本地构建。
- 新插件完整 marketplace 已生成至 `.cache/agent-pilot/marketplace-final`，共 119 产物。没有将正式 Git marketplace 切到工作区开发来源，也没有手工改缓存；**已安装插件仍是正式版本，新的 workflow 指导尚未随正式插件生效**。后续发布并通过官方插件升级链验收。

## 仍需处理

1. 发布流程获授权后交付正式插件，再核对新任务实际加载的 skill 路径/内容与 child model 日志。
2. 增加真实修改任务的固定样本与可采集的原生子任务运行记录；完整 guidance A/B 尚未运行。
3. OCR 的覆盖/证伪机制已吸收；固定版本 delegate 的可选适配和本项目 PR 对照尚未接入，不作为默认 CI 门禁。
