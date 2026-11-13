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

## 手动首轮行为对照

Windows 专项实验使用 [评测脚本](../../scripts/skill-evals-visual-study.mjs)，必须从仓库根运行并显式选择场景、臂和现有 Codex 可执行文件：

```powershell
node scripts/skill-evals-visual-study.mjs <case-id> <baseline|candidate> <absolute-codex.exe> --execute
```

场景见 [behavior-cases.json](behavior-cases.json)。它使用真实模型调用，创建隔离临时 home 和只读 fixture；在复制登录信息前执行拒读探针，失败就停止。临时登录副本在 `finally` 删除；强制终止可能绕过清理，需核查该次运行自己拥有的 `home/auth.json`。不要将凭据或原始宿主事件提交到仓库。

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

默认单测仅校验用例、start 推荐关系的可达性、六条 workflow 不变以及 Codex 整条技能链和附件的完整分发。历史首轮行为结论见 [本轮记录](../../references/notes/unslop-design-workflow-2026-11-13.md)。原生采集需要显式执行以下入口。

## 原生设计行为采集

先构建并分别冻结修改前后 marketplace 到仓库 `.cache` 的不同目录。不能把同一份当前内容同时标为修改前后。脚本要求快照包含本地 `zc-toolkit` marketplace 和完整插件 skills；拒绝外部目录和符号链接。

```powershell
pnpm eval:design --suite start --case new-page-implicit --arm baseline --baseline <绝对baseline目录>
pnpm eval:design --suite start --case new-page-implicit --arm candidate --baseline <绝对baseline目录> --candidate <绝对candidate目录> --binary <绝对codex.exe> --model <同一模型> --effort <同一推理档位> --execute
```

默认只输出计划，不调用模型、不复制凭据。`--suite design` 使用设计套件；`--suite start` 只显式注入 `start`，由模型选择后续能力。两臂分别执行；每个案例单独会话，模型只收到 `id/input` 对应的输入，没有 oracle。执行当前支持 Windows，沿用现有 capture adapter 的工具/时间/token 上限和进程树清理。

执行时必须同时提供两个冻结目录，以便显式拒读并实测两臂源快照，不能只依赖仓库根 ACL 继承。先做快照/安装字节核对及拒读探针，通过后才将当前本机登录复制到 ACL 保护的临时 home，`finally` 清理；强制终止后须核查该次拥有的临时登录文件。不要提交临时 home 或宿主原始日志。`frozen.json` 固定输入、资产、suite 和脚本哈希，`receipt.json` 核对修改与清理边界，`final.md` 和 `turn-evidence.json` 用于独立评分。`captureStatus=complete` 不代表行为通过；基础设施失败记为 inconclusive，不能计成模型回归。

仅预检失败且尚无凭据或模型捕获的目录，可追加 `--retry-preflight <该次root绝对路径>` 重试。入口核对 case/arm、disposable marker、快照字节，并拒绝整个目录树中的 junction、symlink、硬链接或特殊文件，再重新执行全部拒读探针。这个选项不放宽沙箱，也不保证修复 Windows 初始化超时；已开始模型捕获的目录不可复用。

`scripts/verify-codex-design-install.mjs <隔离home绝对路径> <codex.exe绝对路径> --execute` 可在无登录凭据的临时安装中启动新的 app-server，只调用技能发现接口并核对 start 到 QA 的启用路径，不启动模型。该 home 必须位于仓库 `.cache` 内且带 `.skill-eval-home` 标记；不能用于宿主安装目录。

## 隔离页面完整交付

`lifecycle-cases.json` 固定新页与重塑页任务和独立验收；生产者只获得 input，不能读取 oracle 或另一组结果。`fixtures/redesign` 提供原始数据、权限和行为 owner；新页从空目录开始。交付范围为本地演示，不接真实业务后端。实现产物放在独立 `.cache` 目录，不作为新的 runtime 模板分发。

使用同一视口取得旧页 before，生产者通过当前 start 路由设计与实现，浏览器控制者独立验证；验证失败交原生产者修复，结果沿原计划 ID 回填。已有 Playwright 的目录中运行：

```powershell
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --capture-only
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --case new-page
node <repo>/scripts/visual-lifecycle-browser.mjs <页面目录> <新的证据目录> --execute --case redesign
```

检查器使用当前案例的可访问名称/结果区域；新生成页面如采用不同语义名称，控制者应先读 DOM 再调整定位，保持原 oracle 不变。它覆盖宽窄屏、首个输入可见性、必填/长文本/键盘、新单重置、搜索/筛选/详情/权限/失败重试，保存截图与源码哈希。画面仍需人工审阅；不把无溢出或功能通过等同设计质量。仅绑定本机回环且阻止页面的外部请求，不代表可安全执行任意不可信 HTML。
