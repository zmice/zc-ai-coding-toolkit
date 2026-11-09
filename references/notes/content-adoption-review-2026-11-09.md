# 最新内容获取与吸纳总梳理

最新落地：Unslop 已实现为实验性 `visual-refinement`，包含完整专项流程、按需资料、snapshot/story 适配工具和四平台附件分发；实际结果与未完成门禁见 [实现与验收](visual-refinement-implementation-2026-11-09.md)。下面的“尚未实现”等描述属于早间研究阶段。

核查日期：2026-11-09，Asia/Shanghai。承接 [11 月 6 日审阅](upstream-review-2026-11-06.md)、[原处理方案](optimization-execution-plan-2026-11-06.md) 与 [11 月 8 日实施记录](implementation-validation-2026-11-08.md)。本轮交付是更新证据、完整列账和细化吸纳方案；没有修改 canonical skills、安装上游工具、发布或改变日常配置。

同日后续处理：分发身份审计和可选 no-skill 协议已实现，隔离 CLI 中 71 个插件身份与缓存核对通过；Review 已完成窄范围真实对照并合入，见[行为验收](review-behavior-validation-2026-11-09.md)。Unslop 按用户最新要求完成[完整工作流深研与原始脚本实验](unslop.md)，登记为 evaluating，采用目标扩展为 U1–U5，不再限于两条文案。下文的早间观察保留原采集时间；当前执行状态以专项记录和统一方案为准。

## 结论和当前状态

本记录最初整理时，落地的是严格上游采集、准确插件状态、禁用升级保护、portable 可选清单、离线评测基础设施和 catalog 体量审计，新方法尚未进入正文。此后 Review 已完成局部吸纳，Unslop 仍处于深入评估与适配准备，不能把原始工具运行成功列作新技能行为验收。

本次确认的主要新增信息：

1. Unslop 前进 17 个提交，完善表格检查、快照输入和脚本测试；续审确认专项视觉重塑编排、素材方法和过程展示值得完整评估，脚本原始能力已本地实测，正式采用前仍需工程适配。
2. gstack 删除 `investigate`，其文档给出的理由是未测得足够收益且成本增加。应补无技能对照与内容退役条件，不能默认“规则越多越好”。
3. Awesome Copilot 的 skill-distribution-audit 提供源集合、分发清单、宿主发现结果三方身份核对；这是现有体量审计未覆盖的缺口。
4. Anthropic 将四类 Office/document skills 的许可证调整为 Apache 2.0；这是采用条件变化，不是本项目必须增加四套文档工具的理由。
5. OpenAI 插件目录新增 AWS Core。Codex 官方 CLI 最新日志和 npm stable 仍为 0.167.0；当前官方契约没有提供必须再次迁移本项目的依据。

另核对 [openai/plugins 仓库](https://github.com/openai/plugins)当前元数据为 `archived=false`，修正平台 README 的“已归档”描述；不据此推断历史上何时改变状态。

## 一、项目与上游最新基线

`git fetch origin` 成功。本地 HEAD 和 origin/main 均为 `46defebca23c94fb8ef98fffcd06d3499243e9e8`，ahead/behind 为 0/0；没有待合并远端提交。保留上一轮全部未提交改动和用户已有 `apps/cli/AGENTS.md`。

运行 `node scripts/upstream-governance.mjs report all --with-remote --strict --format json --output references/notes/upstream-refresh-2026-11-09.json`，退出 0：**15/15 成功，0 失败，3 个 source_paths_gap**。[机器报告](upstream-refresh-2026-11-09.json)先于新增快照生成，保留相对旧观察基线的差异。

与 11 月 6 日取得的 HEAD 相比，7 个有更新、8 个未变。下表路径数是 `--no-renames` 统计，不是技能数量、提交数或已完成的语义审查量。

| 上游 | 最新 HEAD 前缀 | 登记内 / 范围外变化 | 内容判断 |
| --- | --- | ---: | --- |
| agent-skills | `301b02b12bff` | 0 / 0 | HEAD 未变；触发负例、执行事件、dialogue/execution 分层仍是既有候选 |
| superpowers | `22f0b463e7a5` | 0 / 0 | HEAD 未变；短正文保留关键限制、评测资料不进入安装包仍有效 |
| everything-claude-code | `d2ef2680594f` | 0 / 6 | gap：PR moderation 文档、工作流、脚本与测试；非本轮技能增量；仓库当前规范名称为 `affaan-m/ECC` |
| gstack | `e077053c3cbb` | 71 / 932 | investigate 退役、crew 重组、QA/计划/review/spec 变化；按主题筛选，不整体导入运行时 |
| andrej-karpathy-skills | `2c606141936f` | 0 / 0 | HEAD 未变；保留已采用工程原则，不重复增加同义规则 |
| openai-plugins | `d420d13051bf` | 1 / 0 | api_marketplace 新增 AWS Core git-subdir 条目；不是平台契约变化 |
| anthropic-skills | `2c5958ecac7c` | 1 / 8 | README 及 docx/pdf/pptx/xlsx 的 SKILL 许可声明和许可证变化；登记的 frontend-design 未变 |
| github-awesome-copilot | `b13e55f85ffd` | 2 / 78 | 分发目录与大量范围外内容；重点读了 skill-distribution-audit、incident-postmortem |
| vercel-agent-skills | `1a2c79d4e6c4` | 0 / 0 | HEAD 未变；React/Vercel 专项依具体技术栈需求采用 |
| vercel-web-interface-guidelines | `434b7f913646` | 0 / 0 | HEAD 未变；混合触控、翻译保护等上一轮候选仍待本地缺口验证 |
| modern-web-guidance | `341268561baa` | 0 / 0 | HEAD 未变；生成内容无障碍、字体缩放与响应式资料按需参考 |
| ui-skills | `97dea9e747ea` | 0 / 2 | gap：站点 registry/digest 更新；digest skillCount 647→721，不能称本项目新增 74 个 skill |
| awesome-design-md | `fcc702849322` | 0 / 0 | HEAD 未变；维持设计参考定位，不生成统一品牌规则 |
| open-code-review | `0d403392073b` | 0 / 2 | gap：Go CLI 测试文件变化；本轮没有审查技能正文增量，旧证据细节候选仍保留 |
| ponytail | `96608e078b2d` | 0 / 0 | HEAD 未变；不把上游 benchmark 宣传当作本地性能收益 |
| Unslop（采集时独立候选；续审已登记 evaluating） | `97daa3eb3656` | 独立 compare：6 文件 | 比旧 a6f121e 前进 17 个提交；续审固定 22 项内容树，详见 [专项记录](unslop.md) |

七个有更新的登记上游已追加 `2026-11-09-observation` 快照；对应采集报告项仍为 `pending-manual-review`，观察快照不等于采用批准。快照冻结登记路径下的 Git tree identity，不是原始字节归档，也不覆盖范围外所有资源。范围外证据另以固定 SHA compare/source 链接记录。

### 三个范围缺口如何处理

- ECC：实际读取了固定提交的 PR moderation 文档，描述 PR 数量/突发限制及关闭、锁定、通知、账号级阻止等操作。它属于该仓库治理，不能加入本工具包默认自动化。GitHub 连接器未跟随旧仓库重定向，使用官方 raw 固定提交读取；公开仓库元数据确认当前为 [affaan-m/ECC](https://github.com/affaan-m/ECC)。后续规范化 source_url 时，应一起审查 `source.origin_*`，保留 source identity，不能只改一个 URL。
- UI Skills：实际读取 registry/digest 的提交差异，确认是发布者索引扩张；现有 `skills/` 正文未变。若未来要跟踪发现目录，再纳入 `src/data/registry.ts`，不默认追踪全部第三方供应链。
- OCR：compare 确认仅 `cmd/opencodereview/main_test.go`、`testmain_test.go`。本轮按工具测试变更归档；没有据此添加新的 review 正文。

### gstack 的大差异如何解释

补充 Git 全范围重命名检测后为 936 条记录：194 A、65 D、610 M、67 R；未启用重命名识别时为 1003 条路径（71+932）。存在迁入 `crew/` 的文件，不能把删除/新增对全部算成新能力。`investigate/` 则在当前树确实删除，文档明确标为 cut，并非简单改名到 `debug/`。

[当前 docs/skills.md](https://github.com/garrytan/gstack/blob/e077053c3cbb9b3539d0e7801b7f5f904e88fed5/docs/skills.md)说明其 11 月 7 日退役决定来自上游自身评测。该模型、任务集与运行条件不同，本轮未复跑实验，不能外推本地 debug 无效。可吸收的是允许以评测证据删减无收益 guidance 的治理方式。

## 二、官方能力复核与本地落点

本机 `codex --version` 为 0.167.0；官方 [changelog](https://learn.chatgpt.com/docs/changelog)最新 CLI 条目为 2026-11-06 / 0.167.0。主线程通过 npm 官方 registry 查询 dist-tags，`latest=0.167.0`、`alpha=0.169.0-alpha.3`。本轮没有安装 alpha，也没有再次升级。桌面 build/runtime 未重新验收，不能由 PATH CLI 版本推断。

| 官方当前能力 | 本地状态 | 后续处理 |
| --- | --- | --- |
| portable 根 plugin.json、兼容 fallback | 上轮已增加可选格式；默认 compatibility | 保留默认，旧 CLI/桌面矩阵过关后再决定切换 |
| skills 固定发现目录及不同宿主 surface | 已生成 skills；只验证过隔离 CLI skills/list | 补真实源集合/清单/发现身份核对；调用成功另验 |
| hooks 的信任审阅与手工桌面安装边界 | 未生成 hooks | 没有具体场景不引入自动执行 |
| MCP portable/legacy 清单路径 | 未生成 MCP | 有明确工具需求后单独做权限、凭据和运行验证 |
| onboardingSkill | 未接入 | 若需要再设计薄介绍，不让 setup 暗中改全局配置 |
| npm 分发不运行 lifecycle scripts | 当前采用 Git marketplace | 不依赖 postinstall 做必要安装；不在同轮切换分发渠道 |
| standalone TOML agents | 仍保留 companion | 必须以实际 spawn 的模型/effort/父权限为证据，再决定简化注册 |

上述为当前官方契约确认，不能因页面今天可访问就断言它们都是 11 月 6 日之后新增。依据：[插件包装](https://developers.openai.com/plugins/build/plugins)、[技能构建](https://learn.chatgpt.com/docs/build-skills)、[提交字段](https://developers.openai.com/plugins/deploy/submission)、[子代理配置](https://learn.chatgpt.com/docs/agent-configuration/subagents)。

[官方 harness-aware 评测示例](https://developers.openai.com/cookbook/examples/partners/harness_aware_plugin_evals/harness_aware_plugin_evals)区分直接工具测试、独立 agent loop 和 Codex 产品 harness。适合用共享任务/oracle、实际事件和产物验证本地候选；SDK 结果仍不等于桌面行为。旧 [Evals 平台](https://developers.openai.com/api/docs/guides/evals)已于 10 月 31 日转只读，计划 11 月 30 日关闭，不把它作为新 runner 的依赖。没有可核实的 Cookbook 新发布日期，本轮不称其为本周新增。

## 三、吸纳清单：已有、缺口与取舍

下表“建议”均尚未写入 canonical content；脚本路径相对仓库根，`skills/` 和 `commands/` 路径均相对 `packages/toolkit/src/content/`。优先更新既有资产和 references，只有形成独立触发契约且评测证明需要时才新增 skill。

| 优先级 / 候选 | 本地已具备 | 本轮确认的缺口与落点 | 验收 |
| --- | --- | --- | --- |
| P1 分发身份核对 | manifest lint、生成/安装测试、catalog 字符预算 | `scripts/content-budget-audit.mjs` 不核对 intended/manifest/discovered 三集合；可单设 audit，再引用到 `skills/skill-authoring-and-evaluation/assets/references/quality-gates.md` | 同总数但一漏一多必须失败；重复名、模板泄露、分页/截断、历史版本不匹配单列 |
| P1 实际 host 评测与无 skill 对照 | 16 fixtures、独立 oracle、导入判定器、baseline/candidate 三重复汇总 | `scripts/skill-evals.mjs` 无执行 adapter，且只有两个 arm；需要可信事件采集与可比较的 no-skill 条件 | 隔离 home/workspace、固定版本/模型/权限；证明有效技能目录；原始事件和实际产物可核对；失败不可冒充 pass |
| P1 UI 改动程度分流 | 设计契约、无证据不建议、品牌/token/owner、浏览器证据 | Unslop heavy/light/no-op 与逐层前后记录进入 `skills/ui-ux-review/body.md`、`skills/frontend-ui-engineering/body.md` | 重度页、局部间距、良好页零差异、紫色品牌保留；同数据/路由/viewport 对照 |
| P1 审查证据细节 | diff identity、文件哈希、覆盖回执、finding 反证 | `(path,status)` 区分删除后同路径重建；`--no-ext-diff --no-textconv`；截断不能算完整审查。落 `skills/code-review-and-quality/assets/references/review-coverage-contract.md` | staged 删除+untracked 同路径、外部 diff/textconv、截断、二进制/重命名样本 |
| P2 UI 状态检查 | 既有 UI checklist、键盘/窄屏/reduced motion | 表头/数值/选中/focus 可辨识补 `skills/ui-ux-review/assets/references/interface-review-checklist.md` | 保留本地 token；不能仅凭圆角、颜色或字体偏好判错 |
| P2 长正文精简 | 渐进式披露规则、体量报告 | 对 `skills/git-workflow-and-versioning`、`skills/security-and-hardening` 先找重复例子，再拆按需 references | 安装后引用有效；压缩恢复后关键边界仍可读取；无收益则不接受候选 |
| P2 测试价值说明 | 行为验证与真实浏览器 QA | gstack 的“保护什么、旧覆盖为何未挡住、不能保证什么”可进入 `skills/browser-qa-testing` reference | 错误路径确实失败、修复后通过；浏览器/功能/环境缺失分列，不制造镜像测试 |
| P2 计划选项自检 | `skills/multi-perspective-review`、`commands/plan-review` | 选项不混合不同承诺；前置依赖先于采用；实现与验证在同一选项中说清 | 一个未满足的外部依赖案例、一个可独立实施案例；不把每个例行选择变成提问 |
| P2 事故复盘参考 | `skills/sprint-retrospective` 有 owner/deadline/metric；debug 有根因机制 | incident-postmortem 的已证实/怀疑/排除、trigger 与 cause 区分、Detect/Mitigate/Prevent 可做按需参考 | 缺失时间/指标留未知；行动项可追踪；不强制每次 bug 都写事故报告 |
| P3 工具与专项生态 | 宿主已有文档/设计/浏览器插件 | Unslop snapshot/story、Office、AWS、框架专项技能各自单立场景 | 有真实消费方、许可证和依赖清单、失败清理及宿主验证后才引入 |

### 来源与采用边界

- [Skill distribution audit](https://github.com/github/awesome-copilot/blob/b13e55f85ffdf451d40d09839cb1e337bf3eda98/skills/skill-distribution-audit/SKILL.md)：真正增量是身份集合核对与消费端版本证据；不是复制一段“发布前检查”文字。准确发现不证明模型已加载或任务完成。
- [Incident postmortem](https://github.com/github/awesome-copilot/blob/b13e55f85ffdf451d40d09839cb1e337bf3eda98/skills/incident-postmortem/SKILL.md)：只吸收有证据的原因分类和行动分类；保留本地中文流程、时区与输入优先规则，不照搬逐段阻塞提问或固定文档路径。
- gstack：[review](https://github.com/garrytan/gstack/blob/e077053c3cbb9b3539d0e7801b7f5f904e88fed5/review/sections/adversarial.md)、[计划](https://github.com/garrytan/gstack/blob/e077053c3cbb9b3539d0e7801b7f5f904e88fed5/plan-devex-review/SKILL.md)、[QA](https://github.com/garrytan/gstack/blob/e077053c3cbb9b3539d0e7801b7f5f904e88fed5/qa/SKILL.md)。主线程已有覆盖/降级规则，不叠加第二套审查；不采纳其宿主限定的强制流程和全部 runtime。
- [gstack spec](https://github.com/garrytan/gstack/blob/e077053c3cbb9b3539d0e7801b7f5f904e88fed5/spec/sections/gate-and-file.md)的语义复核和确定性扫描可参考，但若要自动发草稿给外部审阅者，必须单独定义数据边界，本轮不采用执行逻辑。
- [OCR 固定源码](https://github.com/alibaba/open-code-review/blob/0d403392073bcb0d3894c5364b0a85e7b6a47e0d/plugins/open-code-review/skills/open-code-review-delegate/SKILL.md)：旧候选未随最新测试提交消失；采用前把新的插件路径加入范围登记，保留已有覆盖门禁。
- [Unslop](unslop.md)：CC BY 4.0，复制/改写分发须保留作者、固定来源、许可和改写说明；固定审美、重画品牌、三次渲染上限、空素材槽不采纳。
- [Anthropic 许可变更](https://github.com/anthropics/skills/commit/2c5958ecac7cee2b583967a2c4981d0f4a75c579)：四类 document skills 当前为 Apache 2.0；若未来采用，以具体固定文件及依赖许可为准，不回写旧版本许可事实。当前无新增文档工具需求。
- [OpenAI marketplace 变化](https://github.com/openai/plugins/commit/d420d13051bffe4543ed39e30fa46b87148e47dd)：新增 AWS Core 是生态目录变化，未在本机安装/连接 AWS，不证明本项目插件已具备该能力。

## 四、下一轮实施顺序与完成标准

1. **先固定内容和发现基线**：保存当前资产/生成物哈希，核对 intended/manifest/discovered；把关键候选来源纳入治理范围。Copilot 的 distribution-audit 与 postmortem 保留建议；OCR plugin skill 路径已补，Unslop 已在续审登记 evaluating 并追加快照。不要把大型上游根目录全部加入默认吸纳范围。
2. **接通一个真实 host 的最小评测链**：先对单个 review 与 UI 用例采集完整事件、产物和边界，再扩到 16 例。无 skill 条件需真正隔离有效目录和指令，不能只给 arm 改名。3 次重复用于冒烟和观察方差，不足以自动证明统计显著。
3. **完成两个小内容切片**：先 review 证据 reference，再 UI heavy/light/no-op 与前后记录。各自保留旧内容和候选，固定 oracle 对照；不等于把 Unslop 整份主文搬入。
4. **有失败或冗余证据再精简长正文**：保留硬边界和恢复规则。候选可以被拒绝；平台或模型变化后允许重新评估，不从 gstack 的 Opus 结果直接删除本地 debug。
5. **分别验收并决定发布**：内容 lint/相关测试、各平台引用与生成物检查、真实 host 行为对照；涉及 CLI/平台再跑全仓 verify 和发行物 smoke。发布动作独立处理。

完成记录应分别列出：上游采集、语义审阅、代码/正文落地、宿主发现、模型行为、发布。只有对应层有证据才标完成。每项候选需记录固定来源、落点、保留/拒绝原因和验收样本，防止下一轮再次把“调研完成”当“吸纳完成”。

## 五、研究阶段验证与覆盖边界

- 最新项目远端检查、15 个上游严格采集已成功；新增 7 份观察快照保留待审阅状态。
- 重点语义读取包括 Unslop 当前 skill/scripts、gstack 的 review/plan/QA/spec 与删除说明、Copilot 的两个候选技能、Anthropic 许可变更、ECC PR moderation，以及官方能力页。未逐行审阅 gstack 的全部 1003 个变化路径或 Copilot 的全部 78 个范围外路径，不宣称全仓源码审计。
- 研究阶段没有修改 CLI/平台/技能正文，因此当时没有重复执行上一轮全仓构建和测试；同日后续脚本实现的验证另见实施记录。11 月 8 日验证仍只是那一版源码的历史证据。
- 本地 `upstream report all` 成功加载最新快照，loader 校验 tree hash、范围与 HEAD 绑定通过；7 份快照共 3077 个 tree entries，逐一与远端报告 HEAD/条目计数匹配。`git diff --check` 退出 0。
- 四份研究文档的 20 个本地链接与总表中 11 个内容路径检查通过；未以外部链接存在替代真实脚本或模型验收。
- 不安装上游依赖，不运行上游脚本，不触碰日常 companion 漂移，不切换模型、不重启桌面。
