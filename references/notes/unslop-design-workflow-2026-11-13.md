# Unslop 页面设计规划扩展

日期：2026-11-13。用户确认同时覆盖新页面设计与现有页面重塑，随后要求由 start 自动接入整个流程，无需单独指定技能。本轮是源码中的技能扩展，尚未发布或升级本地/开发服务器的已安装插件。

后续资源审查修复了 build 的验证选择和快照隐藏值处理，并完成全量与合成浏览器回归，见 [资源质量审查](resource-review-2026-11-13.md)。下述快照与计数保留设计/start 阶段的证据，不冒充后续修复后的完整身份。

## 来源与范围

通过 GitHub API 复核 [heydamir/unslop main](https://github.com/heydamir/unslop/commits/main)，仍为已吸纳的 [97daa3eb365670ea3f87ed85356cbfcee18105a5](https://github.com/heydamir/unslop/tree/97daa3eb365670ea3f87ed85356cbfcee18105a5)。未声称上游新增新页设计能力。保留作者、CC BY 4.0 与 `source.origin_*`；新页蓝图、计划追踪、授权分流和计划到渲染的验收是本仓库扩展。

原版适配已具备方向书、九轮与工具证据边界，但没有把设计方向落实到区域蓝图、实施依赖及逐项验收的明确契约。当前改动：

- 保持 `skill:visual-refinement` / `unslop` 身份、optional / experimental 分级；增加 `new` 路径。
- 产品方向 → 区域蓝图（宽窄屏、主要操作、组件/状态）→ 可追踪实施项 → 前端实现 → 九轮复核 → 计划到渲染的验收。
- 业务输入足够时给暂定方案与最小实施依赖；未知 owner/API 标为待查，不用“稍后写计划”替代可交接的设计。
- `ui`、前端实现和 UI/UX 审查入口衔接新流程；只读、纯功能修复、缺少参考和无需修改仍各守边界。
- 新页不索要旧截图；已有页默认保留功能、内容与区段顺序，结构重排须有授权或依据并保留入口。后台不强制 hero、装饰图或动效。
- 设计/start 阶段未改 snapshot/story 脚本；后续快照修复以资源审查记录为准。未触及用户级技能、全局配置或安装目录。

## 验证协议与首轮发现

用例在改写前冻结，见 [design-workflow-cases.json](../../tests/visual-refinement/design-workflow-cases.json)。六例分别覆盖新页、已有页结构、多页只读方案、参考不可用、纯功能修复和无需修改。自动测试仅验证 fixture 结构；模型 micro-test 按 [人工复现协议](../../tests/visual-refinement/README.md) 单独执行。

- baseline 与 candidate 使用隔离的 `zc_frontend_specialist` 上下文（角色模型 `gpt-6-sol`，medium），生产者只读相应技能和输入，不读 oracle 或另一组响应。
- 每个版本六例共用一个上下文，每例各生成一次首轮 response + nextActions；不是逐例独立运行或多次统计试验。
- baseline 最初未找到按发行态路径写出的 reference，补读源码快照的 `assets/references/workflow-and-passes.md` 与 `evidence-and-tools.md` 后确认响应无需改变；不是遗漏参考资料的 baseline。
- 独立 `zc_test_engineer`（同角色预设模型与 reasoning）仅收到输入/oracle 与匿名 A/B 响应，逐条给判断和引用。未把承诺执行当作实际执行。

第一轮：baseline 3 pass / 3 partial；candidate v1 4 pass / 2 partial；双方 mustNot 违反均为 0。已有页重塑中，新版明确“待处理订单前置、指标降级、全部字段与入口保留”；新页及多页仍把具体顺序/依赖推迟到后续，判 partial。

针对该失败类型补充“已知足够时先给暂定蓝图和 2–3 个实施依赖”，并用内容发布页例子说明交接粒度，随后用同一冻结用例集重跑 v2。这是开发集上的改进验证，不能作为未见任务上的泛化结论。

第二轮盲评将分组对调，A 为 baseline、B 为 v2：baseline 3 pass / 3 partial，v2 为 5 pass / 1 partial，双方 mustNot 违反仍为 0。新页明确了宽窄屏区域与 U1 → U2 → U3 实现依赖；已有页明确异常处理前置与指标降级。剩余多页只读场景仍把部分实现项与验收留到后续，判 partial。

v3 仅针对这个输出缺口明确：多页方案每页交付至少一个具体实现切片、依赖及“操作 → 预期结果”，不能只列调研/写方案步骤。最终定向回归使用原套件的 `plan-only-multiple-pages` 和 `functional-only`；不把 v2 的全量结果冒充 v3 全量重跑。

最终定向回归：独立生产者的两个匿名响应经另一位只读评审逐条核验，均为 pass，无 mustNot 违反。多页方案已交付共享契约 U1、依赖 U1 的列表切片 U2 和详情切片 U3，并分别写出“输入条件 → 结果/空态变化”和“提交跟进 → 成功或可恢复失败反馈”；均明确待执行、保持只读。纯功能修复继续只定位筛选/请求/表格链路，不启动视觉重塑。

| 场景 | baseline 首轮 | v2 首轮 | v3 定向回归 |
| --- | --- | --- | --- |
| 新页面 | partial | pass | 未重跑 |
| 已有页结构重塑 | partial | pass | 未重跑 |
| 多页只读方案 | partial | partial | pass |
| 参考不可访问 | pass | pass | 未重跑 |
| 纯功能修复 | pass | pass | pass |
| 无需修改 | pass | pass | 未重跑 |

## 快照与证据定位

本地原始证据位于 `.cache/unslop-design-20261113/`，不含登录凭据；缓存不随分发包安装。`baseline-responses.json`、`candidate-v1/responses.json`、`candidate-v1/score.json` 保留首轮结果；v2 原始输出及盲评在 `candidate-v2/responses.json`、`candidate-v2/blind-score.json`；v3 定向回归在 `candidate-v3/responses.json`、`candidate-v3/score.json`。输入快照的摘要以 UTF-8 文本、CRLF 归一为 LF 计算：

| 对象 | SHA-256 |
| --- | --- |
| 独立用例与 oracle | `f0ca6dbbd16c59dc58235b647247d5060063f6aca90e44eebfd15744e3660c60` |
| baseline 资产文件清单 | `854004da2f0dec7c848bf45a552a2b63998bb8e4f4444d1e3e7bb354349c5dd7` |
| candidate v2 资产文件清单 | `a3e6fe03752bcb778325d3c8880262673f10d0c2f41e96f9a1aae85e7a9d9410` |
| candidate v3 资产文件清单 | `2e69e654e67448bf8e7b07b0d2a16c1c83c3263542d71ad61f6944ae063ec80a` |

清单包含技能正文、附件、前端实现正文与 UI 命令正文，各文件摘要保存在 `evidence-manifest.json`。v1 保留原始输出但未保存完整独立源码快照，仅用于定位本轮修正原因，不作为最终可重复基线。

## start 自动路由与全流程交接

用户指出专门点名技能会割裂工作流，因此增加任务驱动的自动路由，仍保留六条固定 workflow：

- `start` 自动判断需要设计、复用已有设计、或沿用原路线。新页结构/视觉与整屏重塑自动进入设计能力；纯界面审查、单点修复和非前端任务保留各自入口。
- `sdd-tdd-workflow` 与 Spec/Plan/Build 衔接设计结果；方向、蓝图、组件 owner、待定项、任务 ID 和验收在同一 spec/plan 中传递，Review 核对偏差、Verify 回填真实渲染/交互证据。
- UI/前端/视觉技能的触发条件不再要求用户点名 Unslop；已完备的设计和计划只复用补缺口。只读贯穿阶段，已授权实现不重复请求批准。
- `start` 推荐关系可达设计、前端工程、界面审查与浏览器 QA；没有新增 CLI 命令、后台守护进程或自动状态机。平台缺少能力时必须说明实际缺口。

先冻结 [start-routing-cases.json](../../tests/visual-refinement/start-routing-cases.json) 的六个不点名专项技能的输入与 oracle，再比较修改前快照和候选。两个 `zc_frontend_specialist` 从各自 start 快照按需读技能，独立 `zc_test_engineer` 只见匿名响应与 oracle。每组仍为一个上下文中的六例，属首轮 micro-test；采用指令限定读取范围，不声称已实施文件系统级拒读隔离。生产者报告了实际读取列表，未取得工具级完整事件审计。

盲评 A（candidate）6 pass，B（baseline）5 pass / 1 partial，两组均无 mustNot 违反。baseline 的新页案例有工程切片，但未明确宽窄屏蓝图及其到实施、浏览器验收的同计划交接；candidate 明确了该链路。其余五例保持符合：已有页重塑、只读方案、U3 续接、功能 bug、纯后端。不能据此声称旧版完全无法自动设计，或新版在真实长流程里必然执行成功。

原始证据目录：`.cache/unslop-start-20261113/`，包含 baseline/candidate 快照、剥离 oracle 的 `inputs.json`、两组响应、匿名响应、`blind-score.json` 和 `manifest.json`。归一换行后的 SHA-256：

| 对象 | SHA-256 |
| --- | --- |
| 六例路由 oracle | `df789ef332393b9976a81b9fd542189d244f6dcf34e95ab28c50647e8f9cea51` |
| baseline 资产清单 | `79afad0158be165ffc2286bc782faff0392a2dfc71cad50e505f1798f54fc9df` |
| 模型所读 candidate 资产清单 | `6084923e5a3df302f73d759e8948ec6907befd313222a0b6acd1188f6d42ba7a` |

独立审查后将 start 中“纯审查”“普通修复”收紧为“纯界面审查”“普通前端修复”，消除与代码审查优先级的歧义；审查者回归通过。这是模型快照后唯一正文差异，六例不含纯代码审查场景，未另行声称该场景有模型评测证据。入口正文由 3,184 增至 3,840 个 Unicode 字符；详细方法继续按需读取专项技能。

## 设计/start 阶段的验证与边界（资源审查前）

- `pnpm --dir packages/toolkit test`：58 passed。
- `toolkit lint --json`：82 assets，0 warnings / 0 errors。
- `node --test tests/visual-refinement/*.test.mjs`：15 passed，1 skipped（Windows 无符号链接创建权限，EPERM），0 failed。包含四平台附件逐字节分发、三组用例结构、start 推荐关系及 Codex 生命周期完整分发检查。
- Codex、Qwen、OpenCode、Qoder CN 分发包含新增 `references/design-plan.md`；Claude 当前跳过 skills，不能声称已交付该技能。
- 第一阶段新页扩展的 v3 正文从 1,678 增至 2,268 Unicode 字符（归一换行），新增按需设计规划参考 2,537 字符；后续 start 接力另补触发与交接段落。字符数不是模型 token 实测。
- 独立审查提出的新 fixture 缺少结构校验、`no-op` 被 lint 误识别为资产引用两项均已修复并回归确认。
- `git diff --check` 通过；新增文件的行尾空格与结尾换行检查通过。

没有运行真实产品页面的生成/重塑 A/B，也没有产品浏览器或人工视觉验收。这里验证的是技能契约、首轮规划行为与分发；不能声称 AI 后续执行必然符合蓝图或真实页面已经变好。尚未发布，发布前仍应执行完整发布门禁。
