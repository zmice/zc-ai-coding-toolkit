# Visual Refinement 验证

默认测试不调用模型、不启动浏览器、不安装可选依赖：

```powershell
pnpm test:visual-refinement
```

先构建 workspace，生成校验会读取平台包的 `dist`。`pnpm verify` 会按正确顺序执行构建与这些测试。

- `tools.test.mjs`：HTTP 路径边界、符号链接、临时目录所有权、参数、不覆盖输出、报告 URL 脱敏。
- `distribution.test.mjs`：四平台技能与附件逐字节校验，以及 Claude 当前不分发技能的边界。
- `behavior-cases.test.mjs`：独立输入与 oracle 的结构检查，不执行模型也不证明行为达标。

本地受限文件系统不能创建符号链接时，相应用例明确报告 skip。`CI` 已设置时这些权限错误仍会使测试失败，不降低持续集成的安全门禁。

## 手动工具集成

在已有 Playwright 的目录运行测试脚本的绝对路径；需要已安装的 Chrome/Chromium、ffmpeg 与 ffprobe。Chrome 可通过 `CHROME_PATH` 指定。

```powershell
node <repo>/tests/visual-refinement/browser-smoke.mjs --execute
```

它在 `.cache/visual-browser-*` 下创建自己拥有的输入、输出与临时目录，实际生成参考副本和 MP4，验证已有帧目录保留及启动失败、超时后的清理。`receipt.json` 固定源码哈希并记录结果。环境不允许浏览器或回环 HTTP 时保留失败结果，不自动申请提权。此检查只证明合成页面上的工具集成，不是产品视觉验收。

## 历史首轮行为对照

历史 Windows 专项实验的案例仍保留，但 [评测脚本](../../scripts/skill-evals-visual-study.mjs) 当前仅输出计划。必须从仓库根显式选择场景和臂：

```powershell
node scripts/skill-evals-visual-study.mjs <case-id> <baseline|candidate> --plan
```

场景见 [behavior-cases.json](behavior-cases.json)。`--execute` 返回 `blocked`，不会创建 home、复制登录信息或调用模型。旧版真实模型实验的结果见历史行为记录；要恢复执行，须先完成可复用评测环境、无交互预检和清理验证。

`complete` 仅说明调用结束，必须独立检查 oracle。首轮方案、静态改写、真实实现、浏览器验收与发布分别记账。本轮结果见 [行为记录](../../references/notes/visual-refinement-behavior-2026-11-09.md)与[实现记录](../../references/notes/visual-refinement-implementation-2026-11-09.md)。

## 设计规划扩展的首轮 micro-test

`node --test tests/visual-refinement/*.test.mjs` 校验工具行为、平台分发与用例结构，**不执行模型，也不证明页面设计质量**。`behavior-cases.json` 是原有只读首轮套件，由 `scripts/skill-evals-visual-study.mjs` 使用。

`design-workflow-cases.json` 是新页/已有页设计规划的 micro-test 套件，覆盖新页、已有页结构、多页只读方案、参考不可用、纯功能修复和无需修改。原生采集入口见下节；人工评分协议如下：

1. 在修改前冻结旧版 `visual-refinement` 正文及附件、`frontend-ui-engineering/body.md`、`commands/ui/body.md`，记录版本和摘要；候选版冻结相同范围。源码的 `assets/references` 对应发行态的 `references`。
2. 分别开隔离的生产者上下文，保持模型、角色、输入、可用工具与输出要求一致。只提供各自技能快照和用例的 `id/input`，不提供 `oracle`、另一组响应或评分结论。每个场景输出第一轮 `response` 与 `nextActions`，不得执行模拟任务中的页面操作。若一组场景共用上下文，须在结果中记录这一限制。
3. 保留原始响应 `{condition, cases:[{id,response,nextActions}]}`。评分前只给独立评审者原始输入、冻结 oracle 和匿名 A/B 响应，按每条 mustDo/mustNot 给 pass/partial/fail 与引用依据；不可只按关键词、篇幅或模板匹配评分。
4. 记录样本数、模型/角色、快照、原始响应摘要、实际评分与未覆盖范围。回改技能后不得沿用旧候选的行为结果；新一轮记录输入/候选差异。只修改格式或修正资产 lint 的等价措辞时，说明差异及为何不影响该行为结论。

首轮响应只能证明计划表达、路由和授权边界；不能证明 AI 后续按计划实现、实际视觉更好或浏览器验收通过。要验证后者，需要真实项目的相同输入、状态和权限、实际代码改动、渲染与交互证据及人工评审。新页按 brief/蓝图验收，已有页追加同条件前后对照。

## start 自动路由与生命周期交接

`start-routing-cases.json` 的输入不点名 Unslop 或 `visual-refinement`，覆盖新页、整屏重塑、只读方案、已批准计划续接、功能 bug 与纯后端负例。采用同样的人工 micro-test 协议，但生产者先读各自快照的 `commands/start/body.md`，再按选择的路线读取阶段技能；只提供 `id/input`，保留 oracle 给独立盲评。结果区分路由是否选中、设计产物是否传递到实现/验收和授权边界，不要求回答中机械出现某个技能名。

默认单测仅校验用例、start 推荐关系的可达性、六条 workflow 不变以及 Codex 整条技能链和附件的完整分发。历史首轮行为结论见 [本轮记录](../../references/notes/unslop-design-workflow-2026-11-13.md)。原生采集仍处于封禁状态；以下入口只可生成计划或准备文件。

## 原生设计行为采集

先构建并分别冻结修改前后 marketplace 到仓库 `.cache` 的不同目录。不能把同一份当前内容同时标为修改前后。脚本要求快照包含本地 `zc-toolkit` marketplace 和完整插件 skills；拒绝外部目录和符号链接。

```powershell
pnpm eval:design --suite start --case new-page-implicit --arm baseline --baseline <绝对baseline目录>
pnpm eval:design --suite start --case new-page-implicit --arm candidate --baseline <绝对baseline目录> --candidate <绝对candidate目录> --binary <绝对codex.exe> --model <同一模型> --effort <同一推理档位> --prepare-only
```

默认只输出计划，不调用模型、不复制凭据。`--suite design` 使用设计套件；`--suite start` 计划只标记 `start`。`--prepare-only` 创建冻结快照副本与配置并以 `needs-environment` 退出；这不是可执行环境验证。`--execute` 返回 `blocked`，退出码 2。

准备模式必须同时提供两个不同的冻结目录，避免把同一版本当作前后对照。当前没有沙箱拒读探针、登录复制、`frozen.json`、模型捕获或评分结果；不能将计划或准备文件视为行为改善证据。

`--retry-preflight` 已禁用；会话复用已经实现，但恢复执行仍须解决真实宿主隔离和清理验证缺口。

`scripts/verify-codex-design-install.mjs <隔离home绝对路径> <codex.exe绝对路径> --execute` 可在无登录凭据的临时安装中启动新的 app-server，只调用技能发现接口并核对 start 到 QA 的启用路径，不启动模型。该 home 必须位于仓库 `.cache` 内且带 `.skill-eval-home` 标记；不能用于宿主安装目录。发现与采集共用清理阻断标记，清理未确认的 home 不得重启；发现失败停止当前批次，不自动认证或初始化沙箱。

## 隔离页面完整交付

`lifecycle-cases.json` 固定新页与重塑页任务和独立验收；生产者只获得 input，不能读取 oracle 或另一组结果。`fixtures/redesign` 提供原始数据、权限和行为 owner；新页从空目录开始。交付范围为本地演示，不接真实业务后端。实现产物放在独立 `.cache` 目录，不作为新的 runtime 模板分发。

使用同一视口取得旧页 before，生产者通过当前 start 路由设计与实现，浏览器控制者独立验证；验证失败交原生产者修复，结果沿原计划 ID 回填。已有 Playwright 的目录中运行：

```powershell
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --capture-only
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --case new-page
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --case redesign
```

检查器使用当前案例的可访问名称/结果区域；新生成页面如采用不同语义名称，控制者应先读 DOM 再调整定位，保持原 oracle 不变。它覆盖宽窄屏、首个输入可见性、必填/长文本/键盘、新单重置、搜索/筛选/详情/权限/失败重试，保存截图与源码哈希。画面仍需人工审阅；不把无溢出或功能通过等同设计质量。仅绑定本机回环且阻止页面的外部请求，不代表可安全执行任意不可信 HTML。
