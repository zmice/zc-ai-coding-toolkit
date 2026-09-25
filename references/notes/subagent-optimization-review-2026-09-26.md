# 子智能体处理与模型评估

日期：2026-09-26。范围：当前 ai-coding 源码、本机已安装配置、本任务实际子代理记录与当前官方资料。仅评估；未修改模型、全局配置、插件缓存或开发服务器。

## 结论

推荐先让已有上下文预算规则进入实际安装版本，收紧资料读取和小任务重复审查，再以 GPT-6 Sol/Luna 做受控迁移验证。现有角色分工、最小上下文、owner/fan-in、两轮返工机制应保留，不需要重建编排器或增设一批同义角色。

主要缺口是规则交付不完整、执行中输入持续增长、review 深度措辞冲突，以及模型映射仍停留在 GPT-5.6。没有证据表明当前应该增加并发或统一改用 Astra。

## 当前实际状态

- 普通子任务默认 `gpt-5.6-terra / medium`。
- Architect、Security：`gpt-5.6-sol / high`。
- Backend、Frontend、Product、Test：`gpt-5.6-terra / medium`。
- Reviewer、Performance：`gpt-5.6-terra / high`。
- Context steward、Lightweight researcher：`gpt-5.6-luna / medium`。
- 主任务实际为 `gpt-6-astra / medium`。
- 10 个角色 TOML 与当前源码生成结果一致；`platform agents codex --global --status --json` 返回 10/11 产物 current、1 个 config drift、无 missing/stale/untracked。
- `config.toml` 中两个模型默认字段与受管回执一致。status 的 config drift 来自受管合并后的文本不相等；本轮未进一步归因，不能据此称模型配置损坏，也不应整份强制覆盖用户配置。

角色模型 canonical 来源是 `packages/toolkit/src/content/agents/*/meta.yaml` 的 `codexAgent`。`packages/platform-codex/src/index.ts:579` 渲染角色 TOML，`:674` 设置普通子任务默认值。不能只改全局 default：角色自己的 model/effort 会优先覆盖它。

## 真实调用证据

详细脱敏统计见 [runtime evidence](subagent-runtime-evidence-2026-09-26.json)。按唯一 `response_id` 累加 `token_usage_record.usage`，不叠加累计 token_count，也不把 reasoning 重复加到 output。

| 已完成任务 | 实际模型 | 响应记录 | 累计输入 | 其中缓存 | 未缓存输入 | 输出 | 首次→末次请求输入 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 上轮主任务，仅第一个用户 turn | Astra / medium | 44 | 4,646,731 | 4,492,416 | 154,315 | 17,891 | 29,142 → 157,010 |
| OCR 架构评估子任务 | 5.6 Sol / high | 22 | 2,050,360 | 1,907,968 | 142,392 | 10,026 | 32,773 → 138,855 |
| 本轮源码清单子任务 | 5.6 Luna / medium | 8 | 332,182 | 290,816 | 41,366 | 3,581 | 30,046 → 47,973 |

两次真实业务派发均显式 `fork_turns=none`；model 来自子任务自身 turn_context，而非 parent 推断。源码清单与 OCR 架构评估复杂度不同，不能用这两行证明 Luna 比 Sol 更经济或同质。

仍能确认：不继承聊天历史不能消除基础指令/工具/技能上下文；两个子任务首次输入已约 3 万 token。OCR 子任务后续读取使输入增长超过 10 万，四次较大的工具结果各约 3.3–3.5 万序列化字符。主线程也存在大 patch/长文输出，优化必须同时覆盖主线程与 worker。

另外存在 `codex-auto-review` 平台审批 agent，统计独立保存在 JSON。它不是 toolkit 派发的业务角色，不纳入角色性能对比；不建议为了省用量关闭安全审批。累计输入含反复读取的缓存上下文，不是账单；未验证底层 provider 映射、实际 Fast 结算或共享套餐归因。

## 处理流程的优先优化

### P0：把已写的规则交付到安装版本

源码的 `agent-opportunity-contract.md` 为 58 行，安装的 0.11.0 对应文件为 52 行，安装版缺少 10 次调用/5 分钟检查点及最小批次等新增条款。源码的 start、parallel-agent-dispatch、subagent-driven-development 已显式提及 `fork_turns`，安装版对应正文没有。

因此不要先继续堆规则。先审查并交付现有 dirty 改动，分别验证插件内容、standalone agents 和新任务实际运行。`agents --status` 正常不能证明插件内容同步；老任务也不能证明新配置已经加载。

### P0：限制每轮读入资料，而不仅是限制历史继承

- brief 明确结论问题、证据目录/文件、返回格式、完成条件；窄范围定位默认不外扩调研。
- 大页面先定位段落；大 diff 先选文件，再取局部 patch。完整响应可留在忽略缓存，只把相关段落和路径送回模型。
- 一个独立问题达到证据充分即停止；既有检查点输出“已证实、未决、下一步需要什么”，不能把 loop budget 理解为可无限延长单轮。
- 对窄范围只读任务试行简短结果上限，例如 5 个发现、每个一个证据位置；超出则把细节留文件。这是可按任务调整的试点限制，不是 host token 硬阈值。
- 定义无新增证据时的停止/交接；不为把角色槽位用满而派发，也不反复用主线程重读 worker 已完整核验的相同材料。

### P1：统一 review 深度与收敛责任

`subagent-driven-development/body.md:32-38` 要求独立 task reviewer，而 `:60` 允许机械小修改自审加 controller 检查，存在适用范围歧义。建议 quick path 明确先按 review-depth 表分流，低风险机械修改不强制启动独立 reviewer。

多文件/接口/安全风险保留独立审查，review package 绑定 diff/测试证据。修复同一个 finding 复用 owner，最终整体验证重点查跨任务边界，避免重新无差别审查所有文件。

独立 reviewer 应给覆盖状态、证据和未审范围；不要把“又派一次 reviewer”当作质量改善本身。与本轮 OCR 评估的覆盖回执提案合并，避免新建平行流程。

### P1：职责与模型分层，减少重复维护

具体 model/effort 只在角色 meta 与默认生成层维护；流程正文描述任务复杂度和升级条件，不复制多份易过期的模型名单。dispatch 示例应包含 lightweight researcher，使窄范围定位不习惯性派给 architect/reviewer。

“缺资料”先补资料，“工具不可用”先解决工具，“需求不清”先收敛边界；只有明确推理失败或重要风险超出能力，才考虑提高 effort/模型。升级重试要传失败证据和最小交接，不再灌入全部历史。

## 模型候选方案

以下是建议配置，尚未迁移或做同题 A/B；当前 host 列表已暴露 GPT-6 Sol/Luna，但本次自定义角色的实际调用仍是旧 pin。

| 角色/任务 | 当前 | 建议试点 |
| --- | --- | --- |
| 普通子任务默认 | 5.6 Terra / medium | **6 Sol / medium** |
| Backend、Frontend、Test、Product | 5.6 Terra / medium | **6 Sol / medium** |
| Reviewer、Performance | 5.6 Terra / high | **6 Sol / high**；通过真实样本后再评估普通任务 medium |
| Architect、Security | 5.6 Sol / high | **6 Sol / high**；复杂跨模块争议由主线程 Astra 复核 |
| Lightweight researcher、Context steward | 5.6 Luna / medium | **6 Luna / high** 起测；极简单清单再比较 medium |
| 主任务 | 6 Astra / medium | 本轮保留；另选常规任务对比 Sol，不与子角色迁移捆绑 |

保留原有 read-only/workspace-write 边界。Luna 的 high 是当前官方子代理建议起点，不代表一定比旧 medium 更省输出 token；必须衡量质量、总 token 与返工。

当前官方标准速度 token 费率（credits / 百万 token）：

| 模型 | 未缓存输入 | 缓存输入 | 输出 |
| --- | ---: | ---: | ---: |
| GPT-6 Astra | 250 | 25 | 1250 |
| GPT-6 Sol | 50 | 5 | 250 |
| GPT-6 Luna | 2.5 | 0.25 | 12.5 |
| GPT-5.6 Sol | 100 | 10 | 500 |
| GPT-5.6 Terra | 50 | 5 | 300 |
| GPT-5.6 Luna | 5 | 0.5 | 30 |

等量 token 下：旧 Sol→6 Sol 单价减半；旧 Terra→6 Sol 输入/缓存相同、输出单价约低 16.7%；旧 Luna→6 Luna 输入/缓存减半、输出约低 58.3%。这不是套餐可用次数、总任务成本或质量提高的实测结论。

本机存在 `service_tier="priority"`，host 展示的模型选项也标为 priority，但日志没有有效计费 tier。不能把它直接解释为已按 Codex Fast 2.5 倍扣费；官方区分 ChatGPT Fast 与 API Priority。后续先核对账户/实际 speed 状态，再判断非交互任务是否用 Standard，不能为省费贸然改动。

## 实施与验收建议

1. 先清理上述一处审查深度歧义，补资料读取/输出预算，完成现有源码变更的审查与必要验证。
2. 角色 meta、默认生成、相关断言和唯一映射说明一起迁移；按回执合并，保留用户自定义值。原 config drift 要查看精确差异，不能全量 force。
3. 至少覆盖定位、文档事实核查、小修复、一般实现、真实 review、安全/架构共六类固定样本；每类 baseline/candidate 保持输入、工具、fork、预算一致，使用独立验收标准。
4. 记录通过率、漏掉的重要缺陷、误报、返工轮次、总输入/缓存/未缓存/输出、墙钟时间。新模型不可用、工具失败或证据缺失记为 inconclusive，不算质量下降或通过。
5. 验证具体新子任务 turn_context 的 model/effort，再决定受管本机同步。开发服务器是另一个同步目标，本轮未检查或修改；不能从本机状态推断它已同步。

## 第一方依据与验证

- [官方子代理选择、reasoning 与配置优先级](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [标准速度 credit 费率及订阅额度边界](https://learn.chatgpt.com/docs/pricing)
- [Fast 与 API Priority 区别](https://learn.chatgpt.com/docs/agent-configuration/speed)
- [同输入选择满足质量线的轻量配置](https://developers.openai.com/api/docs/guides/model-selection)

只读源码证据由 `agent_source_audit`（`zc_lightweight_researcher`，`fork_turns=none`）提供；主线程核验安装、运行日志、review 深度和官方资料。没有修改运行代码或配置；本报告不声称通过任何新模型效果验证。
