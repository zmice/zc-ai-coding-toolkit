# 优化执行方案

日期：2026-11-06。原方案编写时均未实施；2026-11-08 用户授权处理和升级 Codex 后已落地部分切片，当前结果见 [实施与验收记录](implementation-validation-2026-11-08.md)。以下保留原方案的依赖和验收要求。继承 [总审阅](upstream-review-2026-11-06.md)、[OpenAI 建议](openai-guidance-2026-11-06.md)、[Unslop 评估](unslop.md)，并纳入 [Codex 能力复核](codex-plugin-capability-review-2026-11-06.md)。此文件是本轮治理工作计划，不替代历史未完成计划或长期架构文档。

## 目标与顺序

2026-11-09 更新：[最新内容获取与吸纳总梳理](content-adoption-review-2026-11-09.md)补充了新的上游增量。用户同意处理后，已落实以下 D1/E1，并形成 C1/C2 具体候选；实际验证见 [11 月 9 日实施记录](implementation-validation-2026-11-09.md)。此文件继续作为统一执行方案。

| 切片 | 本次状态 | 落点和剩余验收 |
| --- | --- | --- |
| D1 分发身份核对 | 已实现，隔离 CLI 发现验证通过 | `scripts/skill-distribution-audit.mjs` 核对三集合、版本和采集完整性；71 个预期、清单和实际发现身份一致，缓存逐项哈希匹配。不代表模型加载 |
| E1 无被测技能对照 | 导入、判定和汇总已实现；真实 capture 已接通 | `scripts/skill-evals.mjs` 支持 controlledSkills；独立 `captureCodex` 与 `eval:review` 已实际运行。完整 16 例和真实 no-skill 三组对照仍未执行 |
| C1 Review 输入证据 | 已合入 canonical，生成验证通过 | V2 textconv 3/3 安全采集，仍找到权限回退；安全修改负例两组均无误报。最终补齐回执模板字段；版本、换行与样本限制见 [真实对照记录](review-behavior-validation-2026-11-09.md)。尚未发布到日常插件 |
| C2 Unslop 完整能力 | U1–U4 已进入实验性 canonical；U5 完成首轮微测，产品 A/B 未做 | [实现与验收](visual-refinement-implementation-2026-11-09.md)：四平台附件、最终发布态 smoke 与 CLI 包检查通过；全仓尚有 2 项 Review helper 受沙箱限制，未发布到日常插件 |

用户进一步要求落到当前项目后，已实现 U1–U4，完成三组隔离首轮行为对照和适配工具实跑。真实产品完整改造 A/B、所有宿主的隐式触发和日常插件发布仍未完成；保持实验性并区分实际证据，详见实现记录。C1 的既有交付保持，长正文裁剪、QA/复盘、hooks/MCP/npm 保留原采用条件。

D1 owner 为后端实现代理，E1 owner 为测试代理；两者文件独立，主线程负责脚本入口、集成和文档，审查代理只读检查。每个实现最多两轮定向修复，交回后由主线程运行全量验证。回退时分别移除 D1 脚本/测试/入口或 E1 可选协议扩展；保留历史研究与观察快照，不影响默认运行时安装。

先让工具准确报告证据状态，再建立技能行为基线，随后验证平台新契约，最后用失败样本驱动内容优化。保留 toolkit 唯一事实源、现有命名和 Git marketplace；不把插件能力增加等同于必须全部接入。

执行链：**T1 状态可信 → T2 行为基线 → T3 Codex 兼容 → T4 catalog 审计 → T5 内容优化 → T6 治理与发布验收**。

T1a/T1b 文件独立，可分别实施；T2 fixtures 与 T3 静态契约可在 T1 后并行。真实 host 升级、安装与模型对照串行执行，避免版本、配置和内容同时变化。每个切片独立提交并可单独回退。

## T1：先修正证据与状态报告（P1）

### T1a 上游远端报告严格模式

- 文件所有权：`apps/cli/src/cli/upstream.ts`、`apps/cli/src/cli/__tests__/upstream.test.ts`、`references/README.md`；必要时同步既有 upstream automation 文档。
- 提议接口：`report --with-remote --strict`。保留默认 best-effort；单独 `--strict` 而无 `--with-remote` 报参数错误，避免悄悄引入网络。
- 在现有 JSON 顶层增量添加 `collection_summary`，建议字段 `requested/succeeded/failed/status`，status 为 `complete/partial/failed/not-requested`；保留 `results` 和 `review_status`。采集成功不代表人工审阅通过。
- 先完整写出报告，再设置退出码；远端 HEAD 或必要 diff 失败时 strict 非 0。`source_paths_gap` 单列告警，不等同网络失败；无变化且有有效证据算成功。
- text/json/md 的所有输出分支共用退出策略，覆盖现有 md 提前 return；输出文件失败仍非 0。
- 验收：全成功、全失败、部分失败、HEAD 成功但 diff 失败、未请求网络、范围缺口、非法参数；默认失败仍兼容原行为，strict 保留报告并非 0。测试用固定 Git fixtures，不依赖实时远端。
- 验证：CLI 定向测试、`pnpm verify`、一份离线 JSON/Markdown smoke。
- 风险 owner：CLI owner。回滚只撤销此切片，不修改已追加的 observation snapshots。

### T1b Codex 状态规范化与升级说明

- 文件所有权：`apps/cli/src/cli/platform.ts` 及既有 `platform.test.ts`、`packages/platform-codex/README.md`、`apps/cli/README.md`。
- 保持原字段，新增明确的安装/启用状态（true/false/unknown）及 `updateStatus`，建议枚举 `up-to-date/update-available/unknown/not-installed`；附机器可读 reason。字段名称在实现前与现有 JSON 测试定稿。
- `available: []` 不等于最新；插件没安装、被禁用、结构不识别、官方命令失败分别报告。正常 status 可报告未安装而退出 0；解析/命令失败非 0，不能伪装健康。
- 按具体操作探测官方命令能力；保留已支持的旧 register 模式，缺失能力时给准确诊断。不要只用版本号猜 CLI 形状。
- 升级文档明确当前会执行 marketplace upgrade + plugin add。静态测试覆盖步骤失败与停止边界，真实 host 测试确认不会无意启用被禁用的插件。
- 验收 fixtures：installed+enabled、installed+disabled、记录缺失、未知字段、无 available、同版本/新版本、legacy、子命令不支持和 malformed JSON。
- 验证：CLI 定向测试、`pnpm verify`、当前 host 只读 `--status --json`；安装升级另走 T3 隔离验证。
- 风险 owner：CLI owner。现有 companion ownership/hash/rollback 测试必须保持；不覆盖用户修改或未跟踪入口。

## T2：让现有技能评测方法可重复执行（P1）

- 文件所有权：拟新增 `tests/skill-evals/` 和窄范围 runner；先确认目录与仓库 test runner 的集成边界，fixtures 不进入平台安装包。
- 首批冻结 16 例：review/debug/build/UI 各 2 个正例 + 1 个相邻负例 + 1 个边界例。全套覆盖中英文、显式调用、隐式路由、保持 no-op、缺外部依赖、压缩后恢复；一例可覆盖多个维度。
- fixture 最少包括：`id`、输入、workspace seed、期望/禁止的 skill、允许文件范围、独立 oracle、必需证据、最大轮次/时长。oracle 置于 runner 侧，不能供被测模型改写或以其自述代替。
- 结果最少包括：fixture/源码/内容 hash、host surface/version、模型/effort、权限、有效技能清单、工具事件、文件 diff、耗时、可取得的 usage、`pass/fail/inconclusive` 与原因。认证/网络失败记 inconclusive，不混入行为 fail/pass。
- 三层分别输出：静态结构；真实选择/加载；真实任务行为。确定性 `toolkit search/recommend` 只验证查询层，不代替模型触发。
- 先 baseline，再 candidate；同 fixture/oracle/模型/权限各重复 3 次，呈现每例结果与方差；新内容不得带来关键越界、误写或权限回退。没有可靠事件时，触发层标 inconclusive。
- 默认 CI 仅做 fixtures/schema/静态检查；真实模型 runner 显式启用并设成本/时间上限，不接已停用的旧 Evals API。先不引入 Promptfoo 依赖，runner 接口稳定后再选择。
- 风险 owner：测试 owner；主线程 fan-in 复核模型结果与实际产物。回滚 runner 不影响运行时包。

## T3：Codex 新旧能力兼容（P1/P2）

### T3a 生成契约与 standalone agent 试验

- 文件所有权：`packages/platform-codex/src/index.ts`、既有 `index.test.ts`、README；若涉及新 CLI 参数，由 CLI owner 串行接入。
- 先在生成计划中增加显式可选 portable 模式，默认仍输出现有兼容布局。根清单与兼容 overlay 来自同一 metadata；无身份分叉、双份技能或 overlay 隐式合并假设。
- 用小插件验证 schema、`skills/` 发现、引用路径、namespace、旧格式 fallback、`extensions.com.openai` 优先级。schema 校验与真实加载分别记录。
- custom agent 对照：仅 standalone TOML vs 现有注册+TOML；覆盖名称唯一、项目/用户冲突、默认/角色模型优先级、父权限继承。生成的 `sandbox_mode` 不能声称独立沙箱；是否去除要由支持范围决定。
- 只有新旧 host 均证明不再需要注册时，才另提交 companion 简化；保留回执、用户修改冲突检测和可逆迁移。Markdown agents 不直接当作 TOML 替代品。
- `onboardingSkill` 先验证路径与首次 setup，指向薄介绍；不默认触发 companion 安装或全局写入。

### T3b 实际宿主验证矩阵

| 维度 | 最低证据 |
| --- | --- |
| 版本 | PATH CLI 0.156.0 基线、0.167.0 候选、桌面实际 build/runtime 各自记录；不假设桌面跟随 PATH |
| 环境 | 隔离 Codex home/测试项目、独立 marketplace、配置和产物 hash；证明 CLI/桌面实际使用测试 home，不能仅凭设置环境变量认定隔离；无用户日常配置迁移 |
| 生命周期 | 安装→状态→新会话发现→升级→禁用后升级→卸载；确认仅移除 owned files |
| 技能 | `$zc-toolkit:start` 等显式调用与自然语言隐式触发；引用资源可读、无 source-command 重复项 |
| agents | 实际 spawn 角色、记录生效模型/effort/权限；生成 TOML 通过不算模型设置生效 |
| 失败 | 目录不可访问、部分升级、配置被手改、离线、unsupported CLI；状态准确且已有安装可恢复 |

对同机无法隔离或无法读取有效配置的项标 `inconclusive`，不为补证据重启用户桌面或修改其日常环境。实际全局升级是独立后续操作，不属于本次方案交付。

### T3c 暂缓能力

hooks、MCP、npm 发布各自需要具体使用场景后再立切片。本轮不为“平台支持”新增自动执行逻辑。hooks 若采用须验证信任/重新审阅并区分手工桌面分发与公共目录；MCP 不包含凭据，保留宿主权限；npm 不与 manifest 迁移同时切换。

风险 owner：平台 owner；T3 涉及本地执行或权限时由安全审查复核。回滚保留既有兼容格式与 Git marketplace，候选仅在测试发行物中使用。

## T4：技能发现预算和体量（P1）

- 文件所有权：`scripts/content-budget-audit.mjs` 及其针对性 fixtures/test；内容 owner 决定描述修改。
- 保留现有 bytes/lines；增加 installed artifacts、initial catalog、selected body 三份统计。catalog 纳入 namespace/name/description/path 和宿主是否省略描述的配置。
- 采用显式预算参数或记录 host profile，不把某个版本的默认限制硬编码为跨平台标准。输出前缀碰撞/截短风险、超额项、排序假设及测量方式。
- 无 tokenizer 时只报告 chars/bytes 和估算方法；没有真实 host catalog 时不得声称遗漏名单已验证。
- 验收：中英文、多字节字符、路径长度、相同描述前缀、command alias 与专题 skill 冲突、零描述模式。用 T2 验证候选描述仍能路由。
- 风险 owner：内容/测试 owner。先 report-only；有稳定基线后才讨论 CI 阈值，不自动提高用户 skills 预算。

## T5：按失败样本优化内容（P2）

| 切片 | 文件所有权/来源 | 验收 |
| --- | --- | --- |
| Unslop 视觉重塑 | 可选专项编排和按需资源，复用既有 review/engineering/QA；snapshot/story 独立适配 | 按专项记录 U1–U5 验收，含真实功能保留、素材边界、目录隔离、临时文件和视频；不把固定审美作为通用规则 |
| 长正文裁剪 | `git-workflow-and-versioning`、`security-and-hardening` | 核心边界留正文；长示例按需引用；安装后路径可读；T2 压缩/恢复例无回退 |
| review 证据补细节 | 既有审查 skill/reference | `(path,status)` 区分删除后重建；diff 禁用 external diff/textconv；截断不能记已完整审阅 |

每次只改一类失败，先运行既有 toolkit lint 和相关测试，再跑同 oracle 的 T2 对照。没有净改善则保留原内容；“更短”不是唯一验收标准。引用上游原文时保留对应许可证、署名、固定提交和 source identity。

## T6：治理、文档与发布收口（P2/P3）

- `references/upstreams.yaml` 只扩展实际决定跟踪的范围；新 snapshot 继续追加，旧观察状态不自动改 approved；上游来源变化与 `source.origin_*` 一致。
- ADR0004 加日期修订，解释真实插件边界；更新项目地图失效源码路径。已有未跟踪 `apps/cli/AGENTS.md` 保留，不将其混入本轮修改。
- 文档路径和生成入口来自当前实现；发布说明列明兼容范围与迁移步骤，不写“全面验收”替代未测桌面行为。
- 最终先运行相关包测试与 `pnpm verify`；涉及发行物/安装再运行 `pnpm verify:mvp`，发布前执行 `pnpm release:check`。当前上一轮的 368 passed / 1 skipped 只作为旧基线，不能覆盖后续代码变更。
- 出具逐项 `verified/failed/inconclusive/not-run` 验收表。全局安装、桌面重启、模型变更、提交发布是各自独立执行范围，不因计划存在而自动开展。

## 协作和停止条件

每个实现 owner 最多两轮“实现→定向测试→修复”，之后把残余问题带证据交回主线程；写入型 agent 必须明确上述文件所有权，不能相互回退。平台与 CLI 共用接口先冻结，再分工；主线程负责集成 diff、行为回归和最终验收。

遇到既有用户配置修改冲突、host 无法提供真实加载证据、模型依赖不可用，停止相关迁移或将该测试标 inconclusive，继续独立任务。不得以 mock、成功退出码或报告文件存在替代结果证据。

原方案交付时的验收仅为本地链接、空白和内容一致性检查；2026-11-08 后续实现与实际宿主验证以链接的实施记录为准。
