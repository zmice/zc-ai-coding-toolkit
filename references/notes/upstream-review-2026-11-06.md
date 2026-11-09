# 项目更新、上游吸纳与整体优化复核

日期：2026-11-06（Asia/Shanghai）。按项目/上游、OpenAI 官网、Unslop、整体复核的顺序开展。本轮交付同步证据与可审阅建议，没有直接导入候选 skill 或改动运行时代码。

后续细化见 [优化执行方案](optimization-execution-plan-2026-11-06.md)；新增的 Codex 版本、portable 格式、状态判定与 companion 取舍见 [能力复核](codex-plugin-capability-review-2026-11-06.md)。以下优先级是初审结果，具体执行顺序以细化方案为准。

## 1. 项目与上游更新

### 项目基线

- `git fetch origin` 成功；本地 `HEAD` 与 `origin/main` 均为 `46defebca23c94fb8ef98fffcd06d3499243e9e8`，ahead/behind 为 `0/0`，没有需要合并的提交。
- 当前 CLI 为 `0.11.1`；本轮从当前源码执行 `pnpm build` 成功。
- 保留任务开始时已有的未跟踪文件 `apps/cli/AGENTS.md`，没有提交、发布、升级全局插件或变更模型配置。
- 本轮没有修改 package 版本、锁文件或 `source.origin_*`。构建只刷新既有忽略的 dist/vendor。

### 上游证据

先保存旧基线到远端的 [完整差异报告](upstream-refresh-2026-11-06.json)，再对新 HEAD 追加 14 份 observation 快照。15 个上游全部取得远端证据：13 个登记路径有变化、1 个 HEAD 未变、1 个仅范围外有变化；共 1,167 条登记路径变化，最终无 `unknown` 或采集错误。

数量是登记范围内的路径变化，不代表逐文件语义审查。未登记路径仍保留在 JSON；本轮详细抽查了 Agent Skills、Superpowers、UI Skills、Vercel Web Interface Guidelines 与 OCR 的相关正文，其他大型上游主要做路径级筛选。

| 上游 | HEAD（缩写） | 登记路径变化 | 本轮结论 |
| --- | --- | ---: | --- |
| agent-skills | `301b02b12bff` | 86 | 优先参考触发正负例、execution/dialogue 区分与完整执行事件门禁；doubt-driven 只吸收证据反驳方法 |
| superpowers | `22f0b463e7a5` | 113 | v7.0.2 的少提无效问题、本地 cwd/绝对路径纪律、评测材料与安装资产分离值得参考 |
| everything-claude-code | `b38be6a7f635` | 514 | 新增 change-impact、docs/module governance 等候选；本轮只确认路径，不据此承诺具体能力 |
| gstack | `8d712d63ddb8` | 196 | context/review 等文件及运行时大幅扩张；保持按需筛选，不引入第二套运行时 |
| andrej-karpathy-skills | `2c606141936f` | 0 | HEAD 未变 |
| openai-plugins | `b767f8fa3be1` | 1 | 登记范围仅 marketplace 清单变化；范围外 codex-security 等变化不能误报为无更新 |
| anthropic-skills | `ca45fc496a34` | 0 | `source-paths-gap`，92 条范围外变化，主要涉及 Claude API；所登记前端内容未变 |
| github-awesome-copilot | `60dcb901abbd` | 7 | 主要作为目录/平台能力参考；未逐项评估 1,592 条范围外变化 |
| vercel-agent-skills | `1a2c79d4e6c4` | 8 | deploy-to-vercel 与 react-view-transitions 有变化；需具体平台需求才采用 |
| vercel-web-interface-guidelines | `434b7f913646` | 3 | 关注混合触控设备滚动行为、翻译保护与真实交互复验；不移植绝对风格禁令 |
| modern-web-guidance | `341268561baa` | 165 | 新增生成内容无障碍、OS 字体缩放、响应式等指南；采用前仍需核对浏览器支持策略 |
| ui-skills | `00db7d656719` | 2 | 新增 component-canvas/create-canvas；组件预览保持原 owner、隔离真实写入很有价值 |
| awesome-design-md | `fcc702849322` | 21 | README 与 10 组设计样本新增；继续作为参考，不作为全局品牌规则 |
| open-code-review | `891df1b63f38` | 36 | 新增语言规则和插件副本；核对 `(path,status)` 审查身份、纯文本 diff 与完整读取机制 |
| ponytail | `96608e078b2d` | 15 | skill 与 agentic benchmark 变化；不从目录或上游宣传推导本地节省效果 |

快照是观察证据，状态仍为 `pending-manual-review`；快照中的 notes 是采集时版本，不能替代本报告，也不代表批准吸收。新快照冻结 tree identity，不是上游文件字节的完整归档。

### 最有价值的吸纳点

1. **可执行行为样本优先于更多规则**。Agent Skills 将静态、词法路由近似与真实执行评测分开，并增加相邻负例。适合把本地已有 eval 方法变成固定 fixtures，而不是照搬英文 TF-IDF 阈值或 Claude 专用 runner。[来源](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/evals/README.md)
2. **关键限制放在简短正文，细节按需加载**。Superpowers 的更新记录解释长 skill 在压缩后丢失循环上限的情况，也把测试情境移出安装目录。可转为本地安装资产隔离和恢复用例；其宿主特定 20,000 阈值不能直接推广。[来源](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/RELEASE-NOTES.md)
3. **组件预览不改变组件来适应画布**。复用 public API，控制 mock/provider，在画布快捷键、portal、滚动与组件交互之间划清边界。已有 Storybook/组件测试 owner 时优先复用，不默认再建 canvas 系统。[来源](https://github.com/ibelick/ui-skills/blob/00db7d656719c399c091f3ea138c6f42a7fa4d98/skills/component-canvas/SKILL.md)
4. **补细节，保留已有审查机制**。OCR 的 `(path,status)` 可处理 staged deletion 后同路径 untracked recreation；纯文本 diff 应禁用外部 diff/textconv，并检查截断。本地已有逐文件回执与 finding 证据门，不再重复“新增审查闭环”。[来源](https://github.com/alibaba/open-code-review/blob/891df1b63f380845d882a289a67a6e36c331120c/plugins/open-code-review/skills/open-code-review-delegate/SKILL.md)

不采纳 Agent Skills doubt-driven 的每轮强制跨模型询问，也不采纳 Superpowers 的普遍实现前等待审批。用户已授权、目标明确的工作仍按本地流程继续；独立审查按任务风险与实际收益触发。

## 2. OpenAI 官网建议

详见 [官方资料与本地映射](openai-guidance-2026-11-06.md)。优先级最高的是：

- skill description 前置清晰触发词，单独检查初始技能列表预算。
- 固定 oracle，对比同题 baseline/candidate，保留工具事件和文件产物。
- 用实际宿主验证；单元测试、CLI smoke 与模型行为分别报告。
- 新评测方案考虑本地 runner/Promptfoo，避免依赖已转只读、计划 2026-11-30 关闭的旧 Evals 平台。

官方依据：[技能发现与预算](https://learn.chatgpt.com/docs/build-skills)、[宿主评测](https://developers.openai.com/cookbook/examples/partners/harness_aware_plugin_evals/harness_aware_plugin_evals)、[平台停用时间](https://developers.openai.com/api/docs/deprecations)。

## 3. Unslop 能力与采用判断

详见 [Unslop 专项评估](unslop.md)。固定提交为 `a6f121eee5f29c2f74976b75456feae8b66afb3a`。

- 一个 UI 精修 skill，配套五份参考和两个脚本；不是代码去冗余或通用重构工具。
- 适合页面视觉审查、局部 polish、产品视觉方向、静态改稿和可选改造短视频。
- 本地已有设计方向、Signature、文案、组件 owner 与真实渲染证据规则；优先补“重度/轻度/无问题”分流和逐层前后对照。
- 不直接复制 31 KB 主文、全套固定审美和未验证脚本；保留 CC BY 4.0 来源/署名要求。
- 未执行上游脚本、安装依赖、生成图片或渲染视频；不能宣称脚本安全或改版效果已经验收。

## 4. 整体优化优先级

| 优先级 | 具体问题与落点 | 可审阅的下一步 | 验收标准 |
| --- | --- | --- | --- |
| P1 | `upstream report --with-remote` 在远端全部失败时仍可退出 0，容易被自动化误判成功；见 `apps/cli/src/cli/upstream.ts` | 保持默认尽力收集兼容性，设计可选严格模式和机器摘要，区分采集成功/失败、范围缺口与审阅状态 | 模拟 DNS/超时/部分失败时保留报告且严格模式非 0；正常远端结果保持 0 |
| P1 | 有 eval 方法，缺真实 skill 触发/行为 runner | 在独立测试目录定义 10–20 个中英文 fixtures；覆盖 review/debug/build/UI 及相邻负例，再接可选宿主 runner | 固定 oracle；记录真实加载事件、工具结果、diff；分列 pass/fail/inconclusive；不向默认离线 CI 注入付费调用 |
| P1 | `audit:context` 只统计生成物体量；单资产 description lint 不能证明总列表可发现 | 增加初始 catalog、描述前缀和正文三个层次的审计；保留已有字节/行数指标 | 能发现截短后无法区分的技能；不把 bytes 当 tokens，不按文件总量推断每轮消耗 |
| P2 | UI 改造容易过度或只换风格 | 在既有 `ui-ux-review` / `frontend-ui-engineering` 的 reference 中加入 polish/no-op 和前后对照样本 | 已有品牌不被覆盖；良好页面允许 zero-diff；窄屏、状态、键盘与 reduced motion 有实际证据 |
| P2 | 上游路径覆盖与审阅时间不同步 | 检查 OCR 新插件路径与 OpenAI 新候选；对明确不吸收的范围外变化保留理由 | registry、note、snapshot 范围一致；范围缺口不能被解释为上游无更新 |
| P2 | 长正文仍有裁剪空间 | 优先拆 `git-workflow-and-versioning`、`security-and-hardening` 的长示例和重复说明，保留核心边界 | 单 skill 安装后的引用仍可解析；行为样本不回退；压缩后 stop/恢复规则仍可找回 |
| P3 | 项目地图有失效源码路径，局部入口存在旧安装说明 | `docs/architecture/project-context.md` 的 `src/content-lint.ts`、`src/query.ts` 改为当前 `src/lint/content-lint.ts`、`src/query/toolkit-query.ts`；另行处理已有未跟踪 CLI AGENTS | 路径真实存在；手写规则与生成入口的归属明确；不覆盖用户未提交文件 |

建议从前两项开始：先保证“证据采集失败不会被误认成功”，再让技能优化具备可比较的行为证据。之后才用实际失败推动描述/正文裁剪与 UI 方法补充。

### 已有能力，避免重复建设

- 6 条 workflow、start 分诊、薄入口与按需 references。
- 描述长度/重复项/关系图检查，以及确定性 search/recommend 测试。
- 审查 diff identity、逐文件 `reviewed/skipped/failed` 回执、finding 反证门。
- 自定义 agent 分工、最小上下文 brief、有界循环与 fan-in。
- Skill 创作的 baseline/candidate、独立 oracle、失败基础设施与行为失败区分。
- 平台生成/安装测试及发布态 smoke 脚本；本轮只运行下列列明命令。

### 内容体量基线

`node scripts/content-budget-audit.mjs` 成功。默认生成计划中 Codex 为 81 assets / 106 artifacts / 384.4 KiB，入口 4.3 KiB；最大的两个正文分别为 security 13.1 KiB、Git 12.7 KiB。这是**磁盘生成文本体量**，不代表每轮全部加载或真实 token 消耗。

### 验证与未覆盖范围

- `git fetch origin`、HEAD/ahead-behind 核对：通过。
- `pnpm build`：通过。
- 15 个上游最终远端报告：成功，0 unknown/error。
- 14 份新快照：4,201 个 tree entries；逐一核验计数、HEAD/范围绑定、manifest SHA-256，以及与更新前报告 HEAD 一致性，全部通过。
- 本地 `upstream report all`：通过，能加载新增快照。
- `toolkit lint --json`：81 assets，0 warnings，0 errors。
- `pnpm verify`：退出 0，共 368 passed、1 skipped。toolkit 58、platform-core 25、qwen 3、codex 16、claude 3、opencode 5、CLI 258；CLI 的符号链接 bin 入口测试在 Windows 按既有条件跳过。
- `git diff --check`：通过；新增文档另做空白检查与本地链接核对。
- 全量验证原始日志在本机忽略目录 `.cache/verify-2026-11-06.log`，不作为发布产物。
- 未运行 `verify:mvp`、`release:check`、真实宿主 skill A/B、Unslop 脚本或生产 UI 验收；未提交、推送、发布或全局安装。

环境说明：第一次普通沙箱 pnpm 自举出现 EPERM，远端报告出现 DNS/thread 启动失败。改用已获准的正常执行环境后构建、采集与全量验证成功。第一次报告的退出 0 暴露上表的自动化判定风险；最终保存的报告已经由成功采集结果替换。

只读协作：`evaluation_audit`（`zc_test_engineer`，`fork_turns=none`）核查结构/查询/生成 smoke 与真实模型评测的边界；1 轮完成，无文件修改。主线程负责来源核对、快照校验、测试运行与最终建议合流。
