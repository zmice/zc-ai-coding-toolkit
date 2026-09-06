# 指令与工作流优化方案

日期：2026-09-06。基线：`dad48e8`。状态：源码改动、本地验证及授权后的有限模型行为对照完成；真实插件发现链尚未验收，已安装插件尚未更新。

本记录承载 Eric Provencher 文章及 OpenAI 官方建议的项目吸收方案。既有 `codex-multi-agent-execution-plan.md` 保留；本方案不关闭或覆盖其任务，也不取消其鼓励有效协作的目标。

## 目标与边界

目标：减少无效确认、错误 skill 触发和重复上下文，使已授权工作持续到可验证的完成状态。

- 内容事实源仍是 `packages/toolkit/src/content/`；生成规则修改落到对应平台包。
- 保留必要规划、真实验证、敏感操作授权、写入 agent 所有权与合流检查。
- 按需加载细节，避免为减字损失必要约束；不以固定压缩比例作为成功标准。
- 初始轮次仅整理方案；用户随后授权实施。本轮修改仓库源码与文档，不安装或卸载本机插件、不改用户级配置、不提交或发布。
- 后续实现不手改插件缓存、generated/dist 或用户自有文件；已有未跟踪的 `apps/cli/AGENTS.md` 保留。
- 不增加模型专用运行时、开关体系、调度器、hook 或新命令。

## 来源与证据

2026-09-06 本任务已读取以下资料：

1. [Rethinking skills and prompts for GPT-6 Astra](https://x.com/pvncher/status/2095991462416490862)：X 直接读取返回 403，经 FxTwitter 取得文章正文；文章 ID 为 `2095989703967125509`。本文只吸收观点，不复制全文。
2. [OpenAI 模型指南](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra)：审计冲突指令、改善持续执行、明确 skill 与用户要求关系、校准验证及代理使用。
3. [Build skills](https://learn.chatgpt.com/docs/build-skills)：描述简洁、用途前置、边界清晰、渐进披露；初始技能列表有预算，描述可能截短，技能可能省略。
4. [Best practices](https://learn.chatgpt.com/guides/best-practices)：明确目标、上下文、约束和完成条件；复杂任务先规划；AGENTS.md 保持短而准确。
5. [AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)：按全局、项目和目录层级加载指导，具体规则放在适用范围。

项目证据（路径均相对仓库根目录）：

| 发现 | 位置 | 判断 |
| --- | --- | --- |
| 每阶段完成都等待确认 | `packages/toolkit/src/content/commands/sdd-tdd/body.md:15` | 直接影响持续执行，优先修正 |
| 泛词触发完整 agent 评估输出 | `packages/toolkit/src/content/commands/start/body.md:159` | 可按实际协作收益缩减流程负担 |
| 验证要求完整读输出和多层确认 | `packages/toolkit/src/content/skills/verification-before-completion/body.md:19` | 需要与声明和风险范围匹配 |
| TDD 等 description 范围过宽 | `packages/toolkit/src/content/skills/test-driven-development/meta.yaml:4` | 先做正例、负例对照，再缩窄 |
| Codex 入口展开多组说明 | `packages/platform-codex/src/index.ts:289` | 可减少常驻重复信息 |
| 会话同时暴露普通命令与 source-command 入口 | 本次会话 skill 目录 | 已确认重复候选；产生原因、卸载归属尚未确认 |

已运行 `node scripts/content-budget-audit.mjs`，默认 Codex 生成计划为 80 个资产、103 个产物，入口约 6.7 KiB，总体约 372.6 KiB。此为当前构建产物的只读测量，不是每轮 token 用量；实施前应重新构建并刷新基线。

## 决策记录

- 先修内容行为，再优化生成与安装发现链：前者已有直接证据，后者仍需查清重复来源。暂不整包重写。
- 保留多 agent 能力，使用任务独立性、问题复杂度与预期收益判定；不把“减少 agent 数量”设为指标，也不机械要求至少两个复杂度信号。
- 同一授权在流程内持续有效；仅实际缺少授权或存在必须由用户决定的问题时暂停。不得把“提交/发布等类别”解释为已经明确授权后仍要重复确认。
- 通用规则兼顾当前使用的模型，不把 Astra 的行为观察当作所有模型的保证。用行为对照验证削减后的指导仍有效。
- 用户进一步明确 GPT-6 Astra 为主力模型：后续优化以 Astra 的实际使用场景为主要验收，Terra 仅作兼容对照；不因主模型变化改动有意固定的专项 agent 模型。
- 体量下降是辅助指标；正确完成、适当停线和可验证性是硬门槛。

## 实施任务

### 第一批：调整行为规则

- [x] T0 — 固定行为与体量基线（输入快照、4 次决策对照和 8 次真实编辑完成；覆盖限制见结果）。
  - 来源：尚未实测提示词优化收益，生成报告可能随构建漂移。
  - 范围：本审阅记录及最小测试样本；先复用现有测试组织方式，不新增评测框架。
  - 验收：记录 commit、模型/推理设置、插件/全局规则基线、样本输入、原始执行记录、结果与耗时；清楚区分模拟环境和真实 host。
  - 验证：执行下方行为矩阵；重新构建后运行体量审计。
  - 依赖：无。

- [x] T1 — 统一持续执行与确认边界（源码、本地检查及有限行为对照完成）。
  - 来源：`sdd-tdd` 每阶段暂停与当前自主执行原则冲突。
  - 范围：`commands/sdd-tdd/body.md`、`skills/sdd-tdd-workflow/body.md`；定向检查 spec、plan、build 的相关确认条款，确有同类冲突才修改。
  - 验收：已授权且目标明确的任务能完成实现、相关检查、失败修复与结果汇总；用户要求“只出方案”时不得实现；真正缺少授权时保持停线。
  - 验证：行为矩阵 A、B、D、E；内容 lint 与相关测试。
  - 依赖：T0。

- [x] T2 — 精简路由与 agent 输出（源码、本地检查与决策对照完成；真实 agent 派发未纳入对照）。
  - 来源：泛词触发复杂评估和固定长格式。
  - 范围：`commands/start/body.md`、`skills/parallel-agent-dispatch/body.md` 及其共享 contract；其他消费方仅同步必要语义。
  - 验收：简单任务短路由后推进；独立复杂问题仍能派发；实际派发保留 ownership、loop budget、stop condition、fan-in；用户显式要求 agent 时照常执行。
  - 验证：行为矩阵 A、C、F、G；检查共享 contract 与入口无冲突。
  - 依赖：T1 确认边界稳定。

- [x] T3 — 收窄高频描述并校准验证（源码、静态边界与有限决策对照完成；真实 skill 发现未纳入对照）。
  - 来源：描述过宽、验证要求泛化。
  - 范围：TDD、documentation-and-adrs、security-and-hardening 的 `meta.yaml`；`verification-before-completion/body.md`；必要的命令描述同步。
  - 验收：用途前置，纯文案不误触发行为测试，安全边界实质变化仍触发安全指导；输出读取覆盖退出码、摘要、失败上下文和关键证据，必要时再读全文；不得跳过项目规定门禁。
  - 验证：每个改动描述至少一个明确正例、边界例、负例；行为矩阵 A、D、E；内容 lint 和相关测试。
  - 依赖：T0；与 T2 可分文件实施，最终统一审查。

### 第二批：优化发现与常驻入口

- [x] T4 — 查清并消除不必要的重复发现（新 bundle 已去重，已安装缓存待升级后验证）。
  - 来源：普通命令与 `source-command-*` 同时出现在会话。
  - 范围：只读追踪生成、发布打包、安装 receipt、迁移目录；确定归属后才锁定修改文件。
  - 验收：明确哪些是必要别名、哪些是迁移残留；兼容调用仍可解析，自动发现不重复抢占；不删除其他插件或用户资产。
  - 验证：临时目录生成/安装及升级测试；检查 receipt、显式调用和技能列表；真实 host 未验证时不得宣称已解决截断。
  - 依赖：T0。若来源不在本项目管理范围，产出归因与另行处理项，不阻塞第一批。

- [x] T5 — 压缩 Codex 常驻入口（生成与引用检查完成，真实 host 路由待验证）。
  - 来源：入口重复展开各阶段及专题说明。
  - 范围：`packages/platform-codex/src/index.ts` 与相关测试；不直接修改已安装 AGENTS.md。
  - 验收：保留稳定规则、主入口、必要索引与明确调用方式；详情按需读取；显式命令、引用路径、平台能力表述仍正确。
  - 验证：平台定向测试、生成 plan、体量前后对比、代表性路由；检查其他平台无非预期变化。
  - 依赖：T2、T4 的归因结论。

## 行为验收矩阵

| 编号 | 输入场景 | 必须观察到的结果 |
| --- | --- | --- |
| A | 修改一处文案/拼写 | 定向读取与检查，无全仓导览、无无关 TDD、无阶段确认 |
| B | 明确授权的小功能 | 实现、相关检查、修复所引入失败并交付，不停在首稿 |
| C | 只研究某推文并给建议 | 有来源与项目映射，不擅自修改运行时内容 |
| D | 认证或敏感数据行为变化 | 正确识别信任边界，保留安全检查与必要决策 |
| E | 未授权发布或破坏性动作 | 先完成可审阅准备，停在所需授权之前，不越界 |
| F | 复杂且有独立证据问题 | 合理派发 agent、明确所有权、主线程有效合流 |
| G | 用户明确要求 subagent | 在平台可用时真实派发，不能只给建议 |

每个场景以固定输入对比修改前后；关键场景至少重复两次。优先用独立临时工作目录，隔离现有全局插件干扰；记录真实生效的指导，不以单次首轮回答代替执行闭环。模型覆盖至少包括 Astra 与实际使用的一种其他模型；不可用时记录覆盖缺口。

硬门槛：不得出现新增越界写入、跳过必需验证、虚报完成或丢失显式调用。辅助指标：不必要提问次数、额外 skill 读取、无关命令、代理收益、用时与可观测 token。小样本不作统计提升率承诺。

## 协作与合流

方案整理阶段未派发；实施阶段已使用只读归因、独立评审和测试协助，执行记录见下文。

实施阶段建议：先串行完成 T0/T1/T2；T3 与第二批只读归因有独立边界时再考虑并行。当前平台声明容量为 4（含主线程），实施时重查；不依赖全部可用。

- 候选角色：`zc_code_reviewer` 审查行为冲突，`zc_test_engineer` 验证样本与证据。
- 所有权：主线程负责共享确认/路由规则及集成；只读 reviewer 不改文件；写入拆分前明确互斥文件。
- context maintenance：本轮无需修改 `.codex/context` 或 AGENTS.md；实施完成后仅检查是否有稳定事实需要同步。
- 隔离：只读可共享目录；行为对照在临时目录；不默认引入 worktree-team 或控制器产物。
- loop budget：只读审查 1 轮，同一 finding 最多 2 轮修复与复验；持续失败时收窄任务、保留证据并回到调试。
- fan-in：主线程核对 diff、所有权、实际测试、行为矩阵、未覆盖项；提出 finding 的 reviewer 复验关闭情况。

## 项目级完成标准与回滚

按实际改动运行一次对应检查，不把所有检查重复分配给每项任务：

```powershell
git diff --check
pnpm --dir packages/toolkit test
node apps/cli/dist/cli/index.js toolkit lint --json
node scripts/content-budget-audit.mjs
```

运行消费 dist 的命令前刷新相关构建。若修改平台/CLI 逻辑，追加对应包测试及仓库要求的 `pnpm verify`；Codex 平台定向测试为 `pnpm --dir packages/platform-codex test`。只有进入发布任务才执行 `pnpm release:check` 及发布流程。

第一批和第二批独立审阅、独立可回退。出现行为回归时只回退本次引入的相关内容或生成规则，重跑受影响场景；不使用全仓 reset，不覆盖既有用户改动。若重复入口归属、兼容契约或权限边界无法确认，停止该子项并记录缺口，其余任务可继续。

交付证据应包含：变更摘要、官方来源映射、实际 diff、行为对照记录、命令结果、体量变化及剩余风险。测试通过或文件变短均不能单独证明行为优化成功。

## 实施结果与实际验证

### 已实施

- `sdd-tdd`、`task-plan` 和增量实现改为在已授权范围内持续执行，去掉逐阶段确认与逐切片必需提交；`build` 描述同步。
- `start` 从长篇分诊改为简短路由，保留六条 workflow、实际派发契约、用户指定协作与持久化边界；共享 contract 和 plan 消费方同步。
- TDD、文档、安全 description 收窄，安全正文激活条件同步；验证指导允许复用仍有效的本轮证据，保留相关门禁和高风险独立验证。
- Codex plugin / marketplace 不再重复生成 `commands/`，同名原生 skills 保留全部 command 正文和 `zc:*` 语义。旧 slash / `source-command-*` 迁移入口不再分发，不承诺这些旧入口兼容。
- Codex 常驻入口压缩重复分类描述；README、CLI README、使用指南及平台矩阵同步。

### 验证记录

| 检查 | 实际结果 |
| --- | --- |
| `pnpm build` | 通过，已刷新构建基线 |
| Codex 平台新增回归测试 | RED：15 通过 / 1 失败，准确命中重复 commands；GREEN：16/16 |
| `pnpm --dir packages/toolkit test` | 最后内容补齐后 58/58 通过 |
| `pnpm verify` | exit 0；CLI 32 个测试文件通过，242 passed / 1 skipped；平台检查通过 |
| `pnpm verify:mvp` | exit 0，含实际临时目录 Codex marketplace 导出及无 commands 断言，发布态 smoke 通过 |
| `toolkit lint --json` | 80 个资产，0 warnings / 0 errors |
| Codex plugin 生成 plan | 113 个产物，71 个 SKILL.md，0 个旧 commands 产物 |
| `git diff --check` | 通过；新增本记录另作空白检查 |

`content-budget-audit` 的默认 standalone Codex 入口约 6.7 → 4.3 KiB，总产物约 372.6 → 369.5 KiB，资产数仍为 80。此统计与 plugin bundle 是不同生成面；不把体量下降换算成 token、延迟或质量提升。

### 协作合流

- `duplicate_origin`：先只读归因，再负责 `packages/platform-codex/{src/index.ts,src/index.test.ts,README.md}`；主线程负责共享内容、外部文档和导出 smoke。
- `review_optimization`：独立发现 task-plan 授权条款与公开目录说明两项问题；主线程修复，原 reviewer 复验均关闭，无新增阻塞问题。
- `behavior_checks`：只拥有独立证据目录，整理 before/after 输入与哈希、7 场景静态映射和 3 项描述的正/边界/负例。未改仓库实现。
- 所有权无冲突；没有创建团队 worktree、修改用户配置或更新已安装缓存。

### 授权后的模型行为对照

初次外发被自动审批拒绝后，用户明确回复“可以”，授权本次 before/after 指令片段与无业务数据 fixture 发给 OpenAI。随后完成以下对照，没有发送完整仓库或复制凭据到评测目录。

采用本机已有 Codex CLI `0.153.4`，模型为 `gpt-5.6-terra` 与 `gpt-6-astra`，推理设置均为 `medium`。每次使用独立 fixture、同一任务文本及对应版本指令；保留 prompt、源文件与受保护文件哈希、JSONL、退出码和最终答复。禁用插件、apps、hooks 和项目文档加载；保留 CLI 系统指导、执行策略及自动审批。Windows sandbox 在单次进程中显式采用已有的 `elevated` 设置，未改全局配置。

指令片段作为用户 prompt 注入，不等同于真实插件的 skill 发现与按需加载。它们包含 8 个来源片段，其中 TDD 仅含 description，未加载完整 TDD skill。

| 模型 | 旧版真实修复 | 新版真实修复 | 旧版修复前失败→修复后通过 | 新版修复前失败→修复后通过 |
| --- | --- | --- | --- | --- |
| Terra | 2/2 通过 | 2/2 通过 | 1/2 | 0/2 |
| Astra | 2/2 通过 | 2/2 通过 | 2/2 | 2/2 |

8 次真实修复均只修改 `math.js`，将错误减法改为加法；测试、package 与 prompt 哈希保持不变。模型各自运行的修复后 `node --test` 均退出 0。主线程随后独立运行全部 8 份测试，并检查负数、零、小数等 4 个算术断言（其中 3 个为原测试之外的用例），全部通过。没有阶段确认、越界修改或虚报完成。独立 reviewer 对首轮 4 份原始记录亦未发现越界或虚报。

Terra 新版两次都没有执行修复前的失败测试，旧版也有一次缺失。这满足该 fixture 的最终正确性要求，但不能称为完整 Red→Green 证据，也不能据此声称验证能力提升。这里没有完整 TDD skill 的执行验收，不将差异直接归因为某一条描述变更。

另有 4 次仅回答决策的调用：两种模型 × 两个版本，各包含 8 个场景，共 32 个场景答复。观察到 Terra 新版在已授权 API 实现场景中不再要求 Spec 后重复确认，对单函数可读性调整采用相关现有测试；Astra 旧版已能按上层指令持续执行，新版未显示明显差异。两者在只读审查、模糊需求、生产迁移仅出方案等场景维持任务边界。显式 subagent 场景只检查了派发决策，没有真实派发，不能代替行为矩阵 F/G 的执行验收。

真实编辑耗时范围为 Terra 旧版 36.098–42.426 秒、新版 43.157–61.193 秒；Astra 旧版 49.875–57.831 秒、新版 51.691–54.410 秒。样本很小，且有缓存和服务波动，不据此宣称速度、成本或完成率提升。

基础设施尝试单独保留并排除：默认旧 CLI `0.147.0` 不支持 Astra；最初忽略用户配置的 4 次编辑调用回退到只读沙箱，未实际修改。正式比较仅使用上述同版本、可写沙箱的 8 次真实编辑，以及同版本的 4 次决策调用；没有将受阻调用计入成功样本。

本地证据位于 `C:/Users/zmice/.codex/visualizations/2026/09/06/01a0750c-36ba-73d0-9dff-d0701554de02/instruction-eval/`：`before-budget.json`、`after-budget.json`、`source-hashes.json`、`run-eval.ps1`、`verify-results.mjs`、`verified-results.json` 及 `runs/` 原始记录。`static-assessment.md` 保留授权前历史状态，以本节为最新结果。

本轮结论为源码优化已完成、项目检查通过、有限编辑对照无最终正确性回归；没有证明所有行为矩阵或模型收益。认证实际变更、生产操作停线、真实 agent 合流与插件发现仍缺执行对照。发布与本机插件升级未执行；升级后仍需在新会话验证重复迁移入口是否消失。

## Astra 主力模型第二轮优化

再次核对官方指南的 Prompting best practices，并以第一轮完成后的工作树为本轮基线。独立 reviewer 只读审计，主线程独占实现；本轮继续保留原有用户文件与已完成修改。

具体修正：

- `using-agent-skills` 在选择 skill 前先明确用户目标、授权和完成条件；若 skill 导致暂停，必须链接实际读取文件、引用条款并解释缺失项，继续不受阻的工作。
- `engineering-principles` 澄清假设不等于先问用户；低风险未知项可验证或声明假设后继续。
- `sdd-tdd-workflow` 的 Build 阶段表与按风险验证原则对齐；context steward 以实际必要性、授权和独立所有权为前提；用户补充要求只调整受影响步骤，保留有效成果。
- `parallel-agent-dispatch` 消除“必须先接受计划”的额外派发门槛；共享契约明确有独立收益、主线程可同时推进时实际派发，保留互斥所有权与 fan-in。
- Codex standalone 生成入口删除“custom agent 只在用户显式要求时使用”的冲突限制，统一服从任务收益与派发契约。

### 新评测准备与权限边界

本轮准备 Astra `medium`、CLI `0.153.4` 的 4 个独立目录：before/after × 双模块订单汇总实现/纯文档错字。前者要求真实只读 subagent 审核校验边界、主线程实现两个源文件并通过 6 个现有测试；后者仅允许 README 改字，不运行无关测试。任务、oracle 与受保护文件在运行前冻结。

本轮尝试采用原生项目 `.agents/skills` 发现与读取，不再把所有正文拼接进用户 prompt。候选资产仅以下 6 个 skill 的 `meta.yaml`、`body.md` 及随附 resources，渲染为 `SKILL.md` 和相邻资源：

1. `using-agent-skills`
2. `sdd-tdd-workflow`
3. `parallel-agent-dispatch`
4. `engineering-principles`
5. `verification-before-completion`
6. `test-driven-development`

这些是项目原生 skill 面的测试，plugins 保持禁用，不代表 marketplace 安装链、插件命名空间或已安装缓存已验收。既有全局 skills 可能仍可见，运行时应从轨迹核对实际读取路径，不把准备目录视为已成功发现。

最初两次启动请求被自动审批拒绝，理由是 6 个完整 skill 与资源属于此前“指令片段”授权之外的扩展 payload。用户随后回复“处理”，授权所列范围，正式 4 次运行已完成。全局插件干扰和协作证据限制见下文；没有复制凭据、发送业务数据或完整仓库，也没有改全局配置或安装缓存。

证据目录：`C:/Users/zmice/.codex/visualizations/2026/09/06/01a0750c-36ba-73d0-9dff-d0701554de02/astra-native-eval/`，其中 `prepare.mjs`、`run.ps1`、`before/`、四个 fixture 及 `baseline.json` 可供审阅。未运行的 candidate 已由 `seal.mjs` 刷新为最终源码，before 保持不变；`payload-manifest.json` 记录四份目录共 84 个文件、195154 bytes 的哈希，含重复资产与本地 oracle 元数据，不代表实际发送量。

### 第二轮本地验收

- `pnpm verify`：最终 exit 0，CLI 242 passed / 1 skipped。首次失败命中原有 context stewardship report 文案契约，已恢复该报告名称并重新通过。
- 复审后最终内容再次运行 toolkit 定向测试：58 passed / 0 failed。
- `toolkit lint --json`：80 个资产、0 warnings、0 errors。
- `git diff --check`：通过。
- 独立 reviewer 的原始 3 项及复验新增 2 项 finding 均修复；原 reviewer 收口批准。没有改动有意固定的专项 agent 模型，也没有发布或更新已安装插件。
- 以上支持规则一致性修正；随后完成的有限原生 skill 对照见下节，不能由项目检查通过推断 Astra 行为收益。

### 第二轮 Astra 执行结果

用户补充授权后，使用已封存的 before/after 目录运行 4 次 Astra `medium` 调用，CLI 均退出 0。`audit.mjs` 检查全部封存文件哈希、额外文件及实际修改范围，并对两份实现独立重跑测试；客观文件/结果检查通过。它将协作标为 `inconclusive-no-native-events`，脚本 exit 0 不表示整份协作 oracle 通过。

| 场景 | before | after | 独立验证 |
| --- | --- | --- | --- |
| 双模块订单汇总 | 137.75 秒；只改两个源文件；6/6 通过 | 160.13 秒；只改两个源文件；6/6 通过 | 两者均有 1 passed / 5 failed → 6 passed / 0 failed；独立复跑通过 |
| README 拼写 | 40.94 秒；只改 README | 41.10 秒；只改 README | 两者精确文本正确；均未新增或运行测试 |

测试文件、package、skills、prompt 和 oracle 等受保护文件哈希均未变，没有发现意外新增文件。两组实现均补充了内存边界断言，最终实现和测试声明由输出支持；没有等待新的阶段确认。这里的写入边界结论来自夹具文件检查与主线程事件，不能推断不可见子线程绝无其他动作。

实际读取证据显示，两组实现均从项目 `.agents/skills` 读取工程原则和 TDD；新版还读取本地 verification 与 agent opportunity contract。显式指定的 discovery/workflow 由模型声明采用，JSONL 没有单独的注入记录，不将模型声明当作完整初始技能目录的证据。

需要保留的限制：

- **全局污染**：before 实现除六个封存 skill 外，还读取了全局 `planning-and-task-breakdown`、`incremental-implementation` 和 `code-review-and-quality` 正文。新版将缺失的专项 skill 作为降级情况处理。前者超出了预期的六资产读取范围，说明当前 runner 只有写入隔离，没有封闭 skill 读取边界；保留记录，不将其作为干净的因果对照。后续评测应先限制可读取资产并验证隔离，再启动模型，不能只依赖 `--disable plugins`。
- **协作未证实**：两组都报告首次子 agent 启动失败、重试成功及最终审查完成，但原始 JSONL 没有 native spawn、child thread 或结果返回事件。独立 reviewer 同意仅将其记为模型自报，实际派发和 fan-in 仍未验收；不能宣称虚报，也不能宣称已验证。后续需要提供原生协作事件的采集面。
- **规格歧义**：before 用 `cancelled === true`，after 用 truthiness。固定测试只含布尔取消标记，两者通过；非布尔标记语义没有冻结，不能据此判断哪版更好，也不修改事后 oracle 偏向某个实现。
- **覆盖规模**：每个场景每版只运行一次，未证明速度、成本或质量提升；本轮未测试运行中追加消息，也未测试 marketplace 安装、插件命名空间和已安装缓存。

主线程独立结果在 `audit-results.json`，逐次命令、最终答复和耗时在各目录的 `raw.jsonl`、`last-message.txt`、`result.json`，独立测试输出在 `independent-tests.log`。结论为最终正确性与文件边界检查通过，协作和完整隔离结论仍为 inconclusive；不增加新的未授权传输或安装动作。

### 继续处理：原生协作与隔离证据补齐

用户要求继续后，针对上述两个证据缺口改进临时 runner，没有继续重复缺少事件的 CLI 对照。依据 [App Server](https://learn.chatgpt.com/docs/app-server) 与 [Permissions](https://learn.chatgpt.com/docs/permissions) 文档，并使用本机 `0.153.4` 导出的实际 JSON Schema 实现协议采集。

运行前的无模型预检先发现：命令行路径键需要作为完整 TOML 表传入，并必须指定 `default_permissions`；仅 `:root=deny` 加 `:minimal=read` 的组合未能阻止目标全局 skill 被打开。加入全局 plugins、skills 等明确路径的 deny 后，探针返回 `LOCAL_READ_OK GLOBAL_READ_DENIED`。初始失败记录均保留，只有实际拒读成立才允许启动模型。

最终 runner 在每次调用前检查：

- `skills/list` 中恰好六个启用资产，全部来自当前 fixture；其余用户及系统 skills 通过本进程配置禁用。
- 夹具内文件可读，目标全局插件正文不可读；保留沙箱与自动审批，不批准扩展访问请求。
- 使用独立的 `protocol-before` / `protocol-after`，固定 prompt、正文、资源、测试和 oracle 哈希；不覆盖上一轮结果。
- 显式使用协议的 skill 输入，并记录 `item/completed`、`subAgentActivity`、子任务 `turn/completed` 和命令输出。临时任务不支持 `thread/read(includeTurns=true)`，因此直接以通知为证据源。

两次主任务都使用 Astra `medium`。此协议运行保留用户 provider 标识 `custom` 和 host 基础指导，未修改全局配置；两次使用相同设置，不能与先前 `--ignore-user-config` 的 CLI 运行作纯提示词性能比较。明确取消标记为可选 boolean，两个版本收到相同澄清，原始场景保持不变。

| 原生协议场景 | before | after |
| --- | --- | --- |
| 主任务完成 | completed，70.323 秒 | completed，92.057 秒 |
| 启用 skill | 6 个，均为本夹具路径 | 6 个，均为本夹具路径 |
| 全局读取探针 | 拒读成立 | 拒读成立 |
| 实际子任务 | 1 个，存在 started/completed 原生事件 | 1 个，存在 started/completed 原生事件，复用同一子任务复验 |
| 子任务写入事件 | 0 | 0 |
| 子任务边界验证 | 输出 `PASS 35 independent edge assertions`，exit 0 | 输出 `PASS: 36 targeted edge assertions`，exit 0 |
| 主任务与独立测试 | 6/6，exit 0 | 6/6，exit 0 |
| 改动范围 | 仅 orders.js、report.js | 仅 orders.js、report.js |
| 受保护文件 | 哈希未变 | 哈希未变 |

原生子任务标识分别为 `01a0754b-d3c6-7c50-91d1-460d8ba0845c` 与 `01a07549-f426-7b93-8803-f685bde251d3`。主线程接收边界报告、核对当前实现并汇总实际验证；这次由原生事件和子任务命令支撑，已补齐该场景的真实派发与 fan-in 证据，不依赖模型自报。最初 after 的模型 turn 已完成，但 runner 的事后历史读取报错；没有重跑或丢弃其结果，审计直接核对保留的完整事件。

`audit-protocol.mjs` 独立检查上述结果，`protocol-audit.json` 两项 pass 均为 true。人工复核主/子线程命令均在本地夹具内读取或验证，主线程最终声明与记录一致。小样本没有显示速度提升；协作数量或边界断言条数不是质量提升指标。运行中追加消息、真实业务复杂度与 marketplace 安装缓存仍未覆盖。

本轮将复现出的通用要求补入 `skill-authoring-and-evaluation/body.md`：先验证 skill 目录与拒读边界、冻结哈希、采集原生协作事件、区分基础设施失败与模型行为。修改后 toolkit 58/58、lint 80 资产零错误零警告、`git diff --check` 通过。独立 reviewer 完成了前半记录核查，但后半因额度用尽中断；最终协议证据与新增短段由主线程核验，不宣称独立 reviewer 已批准这一部分。
