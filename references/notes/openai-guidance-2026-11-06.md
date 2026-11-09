# OpenAI 官方建议与本项目映射

查询日期：2026-11-06（Asia/Shanghai）。已实际打开官方页面；以下区分官方事实与本地建议，不把 API、Codex SDK、桌面宿主能力混为一谈。

| 官方依据 | 核心建议/事实 | 本项目现状与建议 |
| --- | --- | --- |
| [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) | 描述短且触发边界明确；复杂 skill 用薄路由与按需资源；避免不必要的流程规定 | 现有 start 已按六条 workflow 分流。下一步验证 description 截短后是否仍可辨识，精简 Git/security 长示例；不要再新增万能入口 |
| [Build skills](https://learn.chatgpt.com/docs/build-skills) | 初始列表加载名称、描述及路径；默认预算最多为模型上下文的 2%，未知窗口时为 8,000 字符；过多时先缩短描述，可能省略技能。`skills.max_context_tokens` 可调整至最多 10,000 tokens | `audit:context` 目前度量生成文件 bytes/lines，缺少初始目录预算。增加描述前缀、路径开销和近似冲突报告；静态字节估计不能叫实际 token 使用量，也不自动修改用户配置 |
| [Testing Agent Skills Systematically with Evals](https://developers.openai.com/blog/eval-skills) | 先定义结果、过程、风格与效率成功条件；保存 trace 和 artifacts；小样本应覆盖显式、隐式、情境和负例 | 本地 skill 创作方法已具备 oracle 与 A/B 契约，缺口主要是可重复执行的真实用例。先落 review/debug/build/UI 的少量高价值样本 |
| [Harness-aware evaluation of plugins](https://developers.openai.com/cookbook/examples/partners/harness_aware_plugin_evals/harness_aware_plugin_evals) | 直接工具测试、独立模型循环、真实产品 harness 测试分别回答不同问题；模型/宿主变化需要重新验证 | 单元、生成 smoke 与真实插件调用分层；同数据/同 oracle 比较、重复运行，保存 CLI/模型/权限/技能清单。Codex SDK 结果仍不自动等于桌面验收 |
| [Get started with Promptfoo](https://developers.openai.com/api/docs/guides/promptfoo-codex) | 固定测试样本与断言比较 baseline/candidate，报告改善与回退，必要时观察成本和延迟 | 可作为按需 runner 候选；先定义本地 fixture 与结果 schema，再决定接入。真实模型调用有成本，本轮未安装或运行 |
| [Deprecations](https://developers.openai.com/api/docs/deprecations) | Evals 平台于 2026-10-31 转只读，计划 2026-11-30 关闭 dashboard/API，并指向 Promptfoo 迁移路径 | 不新建依赖旧 Evals API 的评测方案。评测方法本身并未被废弃 |

## 建议实施顺序

1. 冻结 10–20 个中英文请求和独立 oracle，优先覆盖真实误路由与越界问题。
2. 把静态结构、技能触发、行为正确性、成本/延迟分列；部分通过不合并成“全面优化成功”。
3. 扩展 `audit:context`：安装文件总量、初始 skill catalog 负担、被选择后正文体量分别报告。
4. 在隔离的实际宿主下运行 baseline/candidate，记录工具事件和文件变化；基础设施失败用 `inconclusive`。
5. 只对已观察到的失败收敛描述或正文；没有改善则保留原版。

## 不建议因此新增的复杂度

- 不因为官方提供 Agents API 就替换本地 `zc` 编排层。
- 不因某个官方 benchmark 的模型排名更换所有角色默认模型；任务分布、宿主和预算不同。
- 不把外部文档中的参数或预算值变成跨平台常量；具体运行应记录 host 版本。
- 不自动安装 Promptfoo、增加外部 API 调用、写用户级 MCP 配置或变更默认技能预算。

本轮完成的是官方资料核查与项目映射，尚未产生新的模型行为对照结果。
