# 上游更新与审查能力优化评估

日期：2026-09-26（Asia/Shanghai，采集 UTC 时间为 2026-09-25）。本轮是同步、调查和提案，不是功能吸收或发布。

## 项目同步

- `git fetch origin` 成功；`HEAD` 与 `origin/main` 都是 `e97b7c77300596532de9acf017bf76850dedf71e`，ahead/behind 为 `0/0`，无待拉取提交。
- 保留进入任务时已有的 agent 模型默认值、上下文预算、平台安装器等未提交改动及 `apps/cli/AGENTS.md`。
- `pnpm install --frozen-lockfile` 与 `pnpm build` 成功；本轮上游工具使用当前源码重建的 CLI。该构建包含已有 dirty worktree，不能当作 clean-commit 发布验证。
- 没有提交、发布、安装 OCR、更新全局插件或同步开发服务器。

## 上游更新结果

先保存 [更新前基线到远端的报告](upstream-refresh-2026-09-26.json)，再追加观察快照。原 14 个上游全部取得 HEAD 与路径差异证据：11 个登记路径发生变化、3 个 HEAD 未变；没有 `unknown` 或采集错误。

下表数量只指登记 `source_paths` 内的变化，不是整个仓库的变更数，也不代表已逐文件语义审查。

| 上游 | 本轮 HEAD（缩写） | 登记路径变化数 | 结论 |
| --- | --- | ---: | --- |
| agent-skills | `bcab6a1b8503` | 49 | 值得补真实触发正/负例、会话恢复证据、本地来源的信任边界 |
| superpowers | `8ca22dba9a94` | 68 | 优先研究审查遗漏清单、隐含输入风险、执行成本分流 |
| everything-claude-code | `e482e579415f` | 241 | 本轮目录级筛选，仍作大型目录/平台扩张参考；不整包吸收 |
| gstack | `2a113ae7e623` | 57 | 借鉴 finding 发布前证据校验、建议与缺陷分离；不引入大型运行时 |
| andrej-karpathy-skills | `2c606141936f` | 0 | HEAD 未变 |
| openai-plugins | `1dc195897af4` | 51 | 已解除归档，登记状态改为 `evaluating`；当前能力仍以官方文档为准 |
| anthropic-skills | `33375500bcea` | 1 | 仅登记的 frontend-design 变化；多数机制本地已有，补充视觉审查参考即可 |
| github-awesome-copilot | `6c4d33b9cfca` | 4 | 登记变化集中在 marketplace、外部插件清单、入口/说明；本轮不引入新目录 |
| vercel-agent-skills | `063bee94c3f4` | 0 | HEAD 未变 |
| vercel-web-interface-guidelines | `e3d624baaf29` | 0 | HEAD 未变 |
| modern-web-guidance | `22ab18dfb50a` | 25 | 新增 HTML 清洗参考及兼容性资料更新，按项目浏览器策略采用 |
| ui-skills | `fd0889bdf72a` | 2 | `DESIGN.md` 与 README 更新，登记 skill 路径没有变化 |
| awesome-design-md | `f6961238d5cd` | 1 | 仅 README 更新，设计样本未变 |
| ponytail | `e3ba2aa6f1e6` | 2 | README 与 portability 文档变化，登记核心 skill 未变 |

新增 `open-code-review` 为第 15 个候选上游，主干快照 HEAD 为 `486022daaf14f7142275eddb9b3cacc3cc5dadfa`。详细能力分析固定发布版 `v1.12.9`，见 [专项评估](open-code-review.md)。主干观察与发布版研究分开记录。

本轮追加 11 个变化上游的 `observation` 快照，以及 OCR 初始 `evaluation` 和 OpenAI Plugins 状态修正后的 `evaluation` 快照。旧快照未改写；`observation` 捕获的是当时已有 notes，不等于本报告的审查结论，也不等于批准吸收。

## 优先级与具体价值

### P0：可核验的审查覆盖和 finding 证据

当前本地已有维度、严重度、位置、验证与反馈闭环，但没有强制的逐文件完成回执。建议在现有 review skill 补充固定 diff 身份、文件清单、排除原因、`reviewed/skipped/failed` 状态与未审范围；输出 finding 前核对触发条件、影响、代码证据、已有保护和反例。

OCR 提供可工程化的筛选/规则接口；GStack 的 pre-emit gate 强调先核对实际符号及其生成来源，避免把“没搜索到字段”当成不存在。可选重构建议应与真实缺陷分开，不因建议被跳过就屏蔽同位置真实 bug。

落点：`code-review-and-quality`、`review-response-and-resolution`、`agent:code-reviewer` 及按需 reference。先加最小契约，再考虑 CLI schema 与行号验证，避免把长检查表塞入全局入口。

证据：[OCR 固定版 delegation](https://github.com/alibaba/open-code-review/blob/bccbc15f785269400735d5255540c231e6c02b6d/skills/open-code-review-delegate/SKILL.md)、[GStack 固定版 review](https://github.com/garrytan/gstack/blob/2a113ae7e623f590095bcaaa0cc581c9a10a6632/review/SKILL.md)。

### P1：审查规格隐含风险，明确拒绝判断的范围

Superpowers 新版要求计划列出规格隐含、任务测试却未覆盖的输入/失败模式，并由相应任务负责验证；review 明确列出未判断范围。还修正了多提交 diff 的 merge-base 选择以及空/非后代范围的验证。

本地已有 acceptance criteria、open risks、stop gates 和 fan-in，但没有同样明确的“隐含输入 → owner → 验证”映射。建议补到现有 planning/review 契约，不复制上游一律再审批、固定五轮循环或指定高价模型。

证据：[Superpowers v6.4.1 说明所在固定版本](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/RELEASE-NOTES.md)。

### P1：少派发与会话诊断应以实际记录为依据

Superpowers 新增 Native 执行模式与 session diagnosis；Agent Skills 增加可恢复任务边界。值得借鉴的是在已完成切片处记录范围/决定、下一步、工作树状态、验证及未决项，以及用 transcript 解释重复工作或意外消耗。

本地未提交改动已经包含 `fork_turns=none`、角色分档和进展检查点，应优先验证这批已有改动，不再叠一套编排器。是否减少派发取决于任务独立性与实际收益；不能从上游成本比例推断我们的额度节省，也不采用不可测的统一上下文百分比阈值。

证据：[Superpowers 固定版说明](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/RELEASE-NOTES.md)、[Agent Skills context-engineering](https://github.com/addyosmani/agent-skills/blob/bcab6a1b8503100e8618c3b4e32cc78de43de769/skills/context-engineering/SKILL.md)。

### P1：把 skill 结构检查与真实触发验证分开

Agent Skills 新增 review 应触发和不应触发的样本：显式请求审查带缺陷的 diff，应触发并发现问题；只请求先写失败测试，应路由 TDD。它比仅验证 metadata 存在更能发现误路由。

本地 `skill-authoring-and-evaluation` 已有正/边界/负例、独立 oracle 和基线隔离规则；增量价值是给高频 review/debug/build 流程落真实可执行 fixtures。先做少量样本，不再新增一份同义 skill，不把 lint 成功当成行为改善。

证据：[正例](https://github.com/addyosmani/agent-skills/blob/bcab6a1b8503100e8618c3b4e32cc78de43de769/evals/plugin/code-review-fires/prompt.md)、[负例](https://github.com/addyosmani/agent-skills/blob/bcab6a1b8503100e8618c3b4e32cc78de43de769/evals/plugin/code-review-stays-quiet/prompt.md)。

### P2：按需安全与前端参考

- Agent Skills 强调信任取决于谁写入数据；本地进程命令行、环境、共享路径和 job payload 也可能不可信。这对 CLI/安装器审查有价值，应绑定具体边界，不泛化成所有任务强制安全审计。
- Anthropic frontend-design 继续扩展反模板化、文案和渲染后自审；本地已有设计契约、状态与截图证据要求，主要是补评审参考，不需要新流程。
- Modern Web Guidance 增加 `sanitize-untrusted-html` 等指南并调整兼容性资料。保留项目目标浏览器、能力检测和 fallback；本轮未独立认证其每条兼容性声明，不按上游文字直接更换现有实现。

证据：[本地来源信任边界](https://github.com/addyosmani/agent-skills/blob/bcab6a1b8503100e8618c3b4e32cc78de43de769/skills/security-and-hardening/SKILL.md)、[frontend-design](https://github.com/anthropics/skills/blob/33375500bcea98d610eb30ce10ac4e59b89c390d/skills/frontend-design/SKILL.md)、[HTML 清洗参考](https://github.com/GoogleChrome/modern-web-guidance/blob/22ab18dfb50a5d7e3bdcf471c14076a5534eae4e/skills/modern-web-guidance/guides/security/sanitize-untrusted-html.md)。

## 登记范围外的变化

报告会列出未登记 AI asset 候选。本轮保留现有范围：Agent Skills 的其他平台 manifests、Superpowers 的额外入口、ECC 的运行时与平台目录、GStack 的大量运行时、Anthropic Claude API catalog、Copilot 专用新目录、Modern Web manifests、UI Skills 网站和 Ponytail adapters 都不自动吸收。OpenAI Plugins 有 3,527 个范围外路径变化，另行维持 `evaluating`。

因此“登记路径无变化”仅是监控范围的结论，不能写成整个上游没有变化。范围外名单已保留在 JSON 中，后续有具体需求再扩登记，不以目录数量作为价值指标。

## 下一步建议

先做 P0 审查覆盖契约与少量触发/缺陷 fixtures，再用 [OCR 专项评估](open-code-review.md) 的固定样本比较原流程、候选流程和可选 delegation。只有真实发现质量与成本证据成立，才评估默认接入或 CI 门禁。

本轮所有优化都处于提案阶段，没有宣称审查准确率、漏报率或额度消耗已经改善。

## 验证记录

- 项目远端 fetch、ahead/behind、锁文件安装与全仓构建：通过。
- 14 个原上游远端 HEAD/登记路径差异采集：成功；新增候选单独建快照。
- 最终 registry 解析：15 个上游；本地 `report all` 成功加载新基线。
- 13 个新增快照逐一核验：tree 条目数、HEAD 绑定、SHA-256、与本轮远端报告的 HEAD 一致性全部通过。
- `toolkit lint --json`：81 assets，0 warnings，0 errors。
- 最终定向验证 `pnpm --dir apps/cli exec vitest run src/cli/__tests__/upstream.test.ts src/agent/__tests__/codex-worktree-manager.test.ts`：50/50 通过，其中上游治理 24 项、worktree 26 项。
- 首次 `pnpm --dir apps/cli test -- ...` 的参数没有限制测试文件，实际执行全 CLI：250 passed、2 failed、1 skipped。一个失败是新增上游后旧的 14 项数量断言，已同步为 15 并复验；另一个是未修改的 worktree 测试 `does not reclaim malformed lock metadata while its embedded owner PID is alive`，在 `canonicalizePotentialPath` 的 `realpath` 处出现临时 lock 路径 `ENOENT`。定向重跑通过，但未定位这个间歇性失败的根因，不能声称已修复或全量 CLI 全绿。
- `git diff --check`：通过。未执行发布门禁或真实 OCR A/B。
