# Alibaba Open Code Review 评估

日期：2026-09-26（Asia/Shanghai）。状态：`evaluating`，未安装、未接入运行时、未调用其模型端点。

## 版本与证据边界

- 项目：[alibaba/open-code-review](https://github.com/alibaba/open-code-review)。
- 本次能力研究固定发布版 `v1.12.9`，annotated tag 对象 `2c30c7001d3d30a3fdf3ed5513eed4bd879442b0`，peeled commit `bccbc15f785269400735d5255540c231e6c02b6d`；已用 `git ls-remote` 核验。
- 本轮远端主干 HEAD：`486022daaf14f7142275eddb9b3cacc3cc5dadfa`。治理快照跟踪主干；以下能力判断来自发布版，不能当成两版本完全相同的证明。
- 第一方资料与源码静态研究，不是本仓库真实 review A/B，也不是 Windows CLI 运行验收。

## 推荐

先在现有审查流程补充覆盖记账和 finding 证伪，再小范围评估可选 `ocr delegate`。当前不替换 review skill，不作为默认依赖或 CI 阻塞门禁。

本项目已有五维审查、严重度、具体位置、验证证据、反馈闭环和 Codex agent 所有权/有界循环。OCR 真正可补强的是可机器核验的文件选择、排除原因、按路径解析规则，以及完整模式的评论锚定。

## 能力与限制

| 能力 | 发布版所具备的机制 | 需要保留的限制 |
| --- | --- | --- |
| 文件覆盖 | workspace/commit/range 输入，枚举 diff 后过滤，preview 可解释排除原因 | 默认排除测试、fixture、generated 等；大 diff 也可能被跳过。文件都被记账不等于文件都被审查 |
| 分组 | 完整模式由 LLM 根据文件元数据分组，未分组文件退回单文件，超限拆分 | 语义分组本身不是确定性算法；完整性守卫和 fallback 才是确定性部分 |
| 规则 | CLI、项目、全局、内置规则分层；层内首个匹配生效 | 规则选中不代表模型遵循；试点必须显式纳入测试文件 |
| 行定位 | `existing_code` 片段匹配到 diff，必要时模型 relocation 后再解析 | 失败可能留下 `0/0`；重复片段仍需验证，不能声称绝对精确 |
| 反思过滤 | 完整模式额外调用 LLM，删除可由当前 diff 直接证伪的评论 | 仍有误删/漏报风险；不是确定性正确性证明 |
| delegation | `ocr delegate preview --format json` 与 `ocr delegate rule --format json` 提供选择/规则；OCR 侧无需 API key | 推理由 host agent 完成，仍消耗 Codex 额度；没有完整模式的语义分组、自动行定位、relocation、反思过滤和 findings 聚合 |

OCR 内部并发、OCR 委托 host、Codex custom-agent 派发是三种不同机制。不得用 OCR 的并发宣称完成了本项目的原生 agent 派发、所有权或 fan-in 验证。

## 优先吸收的最小机制

1. 固定 review 的 base/head 或工作树快照，枚举 `changed / reviewable / excluded`。
2. 每个文件留下 `reviewed / skipped(reason) / failed` 回执；未知状态不得算完整。
3. finding 必须绑定代码证据、触发条件和影响；输出前检查反例、已有 guard、调用方约束与重复报告。
4. 单独记录未审范围、失败和待验证假设，不用“零 finding”代替完整审查。
5. 维持本项目 `Critical / Important / Suggestion`，通过适配层映射外部分类。

候选落点是现有 `code-review-and-quality`、`review-response-and-resolution` 和 `agent:code-reviewer`，详细 schema/示例放 supporting reference。这里只记录提案，尚未修改这些资产。

## 可选集成路线

- 第一阶段：原生 Git 文件清单和覆盖回执，不增加安装要求。
- 第二阶段：仅当存在已固定、经验证的 OCR CLI 时，调用 delegation 的 JSON 接口；不可用时回退原生 Git。不得隐式安装或更新。
- 第三阶段：如确需自动行定位、反思过滤与会话查看，再隔离试点完整模式；明确模型端点和代码发送范围后运行。

完整模式会向配置的模型端点发送 diff/读取上下文；本地 session JSONL 可含 prompt、response、工具调用与源码。路径级 secret 过滤不能保证普通源码没有秘密。Telemetry 与本地会话留存是不同边界。

平台文档列有 Windows/Linux/macOS 的 AMD64/ARM64；Git 要求 `>=2.41`。试点应固定二进制/包版本并检查摘要及更新行为，不能以 `latest` 运行得出可复现实验结论。

许可证为 Apache-2.0。若复制或改写其 skill/规则/源码，按实际文件保留适用许可证、NOTICE 与变更声明；本轮仅登记和总结机制。

## 验收实验（尚未执行）

选 8 个有可验证缺陷或人工结论的历史 PR：toolkit、CLI、platform、混合变更各 2 个。固定 base/head、host model/effort、输入与预算，对比当前流程、覆盖回执候选、可选 delegation 三组；单独核对全局插件是否影响基线。

- 文件记账率 100%，排除测试必须显式说明；secret 路径不得进入 review 内容。
- 人工核验有效 finding、误报、已知缺陷漏报和行号落点；失败/未审不得算通过。
- 记录总 token（含 host）、耗时、输入/输出口径；采集不到则标记不可测。
- 建议试点门槛：重要缺陷发现不少于基线、误报不增加、有效 diff 行定位至少 95%；成本增加超过 20% 时，需有新增重要缺陷证据才接受。门槛为本地实验提案，不是上游承诺。
- 结果仅代表这些样本。上游宣称的约 1/9 token、更高 Precision/F1、较低 Recall 不构成本项目收益证明。

## 第一方证据

- [固定发布 commit](https://github.com/alibaba/open-code-review/commit/bccbc15f785269400735d5255540c231e6c02b6d)
- [架构](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/pages/src/content/docs/en/architecture.md)
- [规则与过滤](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/pages/src/content/docs/en/review-rules.md)
- [delegation skill](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/skills/open-code-review-delegate/SKILL.md)
- [会话与 telemetry](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/pages/src/content/docs/en/telemetry.md)
- [安装](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/pages/src/content/docs/en/installation.md)
- [许可证](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/LICENSE)
- [上游 benchmark](https://github.com/alibaba/aacr-bench)

只读协作：`ocr_value_review`（`zc_architect`，`fork_turns=none`）提供发布版专项分析；主线程核验 release tag、远端 HEAD、实际目录与本地流程后合流。没有由该 agent 产生文件修改。
