# Unslop 候选评估

2026-11-13 扩展：新增新页设计与现有页重塑的页面蓝图、执行计划和逐项验收，详见 [页面设计规划扩展](unslop-design-workflow-2026-11-13.md)。这是已发布 0.12.0 之后的源码变更，发布/安装与真实产品验收状态以该记录为准。

后续落地：已新增实验性 `skill:visual-refinement`，落实 U1–U4 工作流、资料与适配脚本，真实 Chrome/ffmpeg 集成和四平台附件校验通过，见 [实现与验收](visual-refinement-implementation-2026-11-09.md)。U5 本轮仅做隔离首轮行为微测，未完成产品改造 A/B。下文保留深研与原始工具实验，旧缺陷结论针对未修改的上游代码，不代表适配后仍有相同缺陷。

最新复核：2026-11-09（Asia/Shanghai）。本轮完成固定源码、视觉样例、现有技能边界和本地真实脚本实验；没有安装到日常技能目录、调用图像服务或完成模型改造真实产品的 A/B。用户明确要求不预设最小吸纳，以下完整工作流评估替代早间“只补两个条目”的范围判断。

## 深入结论与采用范围

Recommendation: 采用分层的完整视觉重塑能力作为后续实现目标，因为 Unslop 的价值在于将诊断、方向、分轮实现和展示串成闭环；仅去重 checklist 会丢掉编排价值。保持普通 UI 任务按原流程执行，snapshot/story 单独适配和验收。

本轮 GitHub connector 和本地 checkout 双重核验 `main` 仍为 `97daa3eb365670ea3f87ed85356cbfcee18105a5`；没有比早间更新的提交。核查范围为完整 SKILL、五份 reference、两份脚本、两份测试、两个 HTML 样例、图片参考及来源声明。上游目前是 skill 和工具脚本集合，没有 package.json 驱动的独立应用、设计服务或图像后端。

治理状态为 `evaluating`：[完整范围快照](../snapshots/unslop/2026-11-09T09-46-38-917Z-full-workflow-study.json)固定 22 个 tree entries，内容树 SHA-256 为 `dda65d2b764a1b192f4ff606bda4ba8e81371a1857c73b0515d66526fc77575e`，仍为 pending-manual-review，不代表全量批准。可移植的实验摘要、环境与 11 个产物哈希见 [运行证据](unslop-runtime-evidence-2026-11-09.json)。

| 能力层 | 可以解决什么 | 本地处理方向 |
| --- | --- | --- |
| 输入重建 | 源码、URL、截图三种起点；URL 保存参考副本，截图需要重建静态页面 | 区分真实应用、参考副本和新方案稿；没有原应用源码时不声称完成生产改造 |
| 整屏诊断与分流 | 定位跨颜色、间距、文案、排版的连锁问题，选择重塑、精修、零改动或缺证据 | 保留分流的编排价值，使用本地证据门；不是给每个页面强加九轮修改 |
| 产品方向 | Product / Character / World / Moments / Signature 将产品、材料、视觉焦点与细节相连 | 复用已有设计契约，形成具体方向书；既有品牌、组件和任务约束优先 |
| 九轮实施 | Spacing → Color → Icons → Copy → Type → Layout → Details → Visuals → Motion | 保留顺序和每轮记录，允许有依据地跳过；文案先于排版，素材和动效在结构可用后加入 |
| 视觉素材 | 决定用产品预览、图表、主题对象或场景；给出 prompt、留白、构图、尺寸和集成方法 | 有实质新增价值，适合作为按需 reference；使用宿主已有图像能力，不强制接入新 MCP 或服务 |
| 特效与动效 | glyph、网点、抖动、双色等将素材映射为产品自己的视觉语言 | 可选主视觉模块；补生命周期释放、reduced motion、页面隐藏与性能预算，不扩散到每个控件 |
| 前后证据 | 逐层变更、保留项和同条件画面解释为什么改 | 保留同路由、数据、viewport、主题及状态；截图、真实交互和演示视频分别验收 |
| 过程展示 | story HTML 用累计 CSS 状态、测量标记和文字转场生成短视频 | 新增的可选交付物；适合评审/展示改造过程，演示 CSS、数据标记不进入生产组件 |

### 对现有能力的准确定位

仓库 `ui-ux-review` 已有证据审查、品牌契约、方向/文案参考和 zero findings；`frontend-ui-engineering` 已有 token/组件 owner、真实状态、响应式与无障碍验收。因此不能把每个上游原则都当作新能力，也不能因原则重叠就否定跨阶段工作流。

本机另有用户级 `product-visual-design`，已覆盖设计判断、参考提炼、多方向比较和合同下沉。它不在本仓库 canonical content，不能假定其他平台都有，也不在本轮修改范围。新能力应定位为**专项视觉重塑编排**，不再创建第二套通用设计合同。

建议仓库采用一个按需入口，候选 workspace identity 为 `visual-refinement`（名称尚未冻结），通过 `suggests` 或明确 handoff 使用现有 review / engineering / browser QA。主体保留输入类型、分流、方向、九轮和验收；长资料拆为方向与分轮、素材与特效、对照与展示 references。避免把 31 KB 上游正文全部追加到默认 UI 技能，也不要求使用者另外安装本机的个人 skill。

### 适用场景与采用边界

- 产品后台：重点是内容密度、分组、数值和状态层级；图表应保留实际指标含义，不为好看改数据。完整流程适合多个层面同时失序的页面。
- 营销首页、引导和空态：可以较完整采用方向书、产品场景、真实预览、构图和素材方法；演示数据明确标记，不能把生成图片中的 UI 当作可操作产品。
- 成熟设计系统：保留品牌、字体、组件和布局 owner，按审计命中项精修；不是每次都换视觉语言。
- 仅 URL/截图：交付参考分析与静态方案稿，后续仍需回到真实应用实现。快照不是源工程恢复，也不携带完整登录/业务行为。
- 需要评审或传播：提供可选 story；本地实测证明视频管线可运行，但未证明它改善用户任务成功率。

固定 4px 网格、禁紫色/渐变/emoji、限制字体重量和最多三次渲染不作通用强制规则；颜色、尺寸、文字格式、数字单位和字重应服从目标产品、语言与可访问性。上游也要求保留功能和事实，素材参考图只能帮助理解手法，不能替代原产品逐项对照。无图像工具时提供可交付的产品预览或明确未完成素材项，不将空槽作为完成界面。已授权实现无需因套用上游流程重复确认相同授权。

## 本地实验与实际发现

环境：Windows、Node 24.18.0、Playwright 1.65.0、Chrome 156.0.8078.80、ffmpeg 5.0.1。Playwright 仅安装到忽略目录 `.cache/unslop-lab-runtime`，复用系统 Chrome；未改项目依赖或全局安装。固定源码在 `.cache/unslop-deep-2026-11-09`，Git 工作树保持干净。

| 实验 | 结果 | 能证明什么 |
| --- | --- | --- |
| 原始测试，无 Playwright | 26 项：22 passed / 4 skipped | 参数和元数据基础检查通过；不能据此声称浏览器能力通过 |
| 原始 snapshot 测试，真实 Chrome | 12/12 passed，0 skipped | 本地文件与宽高参数实际输出 HTML 和截图 |
| 受控 HTTP 页面快照 | 响应式图片和滚动后 lazy 图片内联，现场 PNG 生成 | 证明静态外观采集的具体可用部分 |
| 快照保真检查 | runtime input 从 `runtime-edited` 回到 `initial`；Shadow DOM 丢失；Canvas 从有色像素变透明 | 复杂应用必须先比较保存副本与现场；失真不是仅修几条 CSS 就能解决 |
| 快照主动内容/联网检查 | script 标签移除，但 `onclick` 保留且重新打开后可执行；大于 3 MB 的图片保留 HTTP URL | 不是安全净化器，也不是完全离线导出；不能放到受信任域名当惰性 HTML |
| 自写 3 步 story | exit 0，H.264、2160×2160、60 fps、6.866667 秒；帧目录最终清理 | 证明 Windows 本地视频管线及顺序状态可用，已抽帧查看；不是完整产品视觉 A/B |
| story 目录边界 | 对自己创建的同前缀兄弟目录占位文件发请求，HTTP 200 且内容匹配 | `startsWith(root)` 不能约束真实目录边界，正式工具接收不可信 HTML 前必须修复 |
| story 临时目录 | 自建已有 `.story-frames/owned-placeholder.txt` 被启动逻辑删除 | 固定目录预删除会破坏已有内容，也会导致并发冲突，必须换成每次运行拥有的随机目录 |

上游 story 测试的 `pastMeta()` 只证明没有匹配两种元数据错误；后续依赖失败或超时也可能令其通过。本轮额外用真实 MP4 和 ffprobe 补足视频成功证据，没有把元数据测试当端到端测试。

脚本证据：`.cache/unslop-upstream-tests-before-deps.log`、`.cache/unslop-snapshot-browser-tests.log`；快照 `.cache/unslop-lab-runtime/snapshot-proof-VOuDQF/result.json`、`snapshot.live.png`、`snapshot-render.png`；视频 `.cache/unslop-lab-runtime/story-proof-JPehhI/result.json`、`story.mp4`、`middle.png`。实验源为同目录的 `snapshot-probe.mjs`、`story-probe.mjs`、`server-observer.mjs`。story 的预加载模块仅记录监听地址，未改上游请求处理或清理代码；所有目录边界请求仅访问本次自产标记，没有读取真实用户文件或发送外部数据。

### 工具适配要求

1. story 服务限定明确路由；解码错误应返回 400；用 `realpath` / `relative` 核对目录边界和普通文件，拒绝同前缀兄弟目录、编码穿越与符号链接越界。不能只修字符串前缀。
2. 每次创建专用随机帧目录，仅清理本次拥有的目录；浏览器启动、页面、截图、ffmpeg 失败和取消都需验证清理。增加输出覆盖策略、并发、超时和资源上限。
3. snapshot 先提供明确的“参考副本”模式并输出资源失败、未内联内容和可能失真清单；若承诺惰性离线模式，须另做脚本/事件/iframe/表单/URL 策略及联网阻断验收，不能以移除 script 标签代替。
4. 两工具需共享 Node/Playwright/Chromium/ffmpeg 可用性检查和 Windows 路径处理，按需启用；不向默认技能安装注入浏览器或系统依赖。
5. 继续保留上游作者、固定来源、许可证及改写说明。来源声明按上游 CC BY 4.0 文件处理；本轮未把脚本或素材复制进正式分发资产。

## 扩展后的实施与验收范围

| 阶段 | 具体产物 | 验收条件 |
| --- | --- | --- |
| U1 专项工作流 | 可选视觉重塑入口、分流与方向模板、九轮记录、现有技能 handoff | 重塑任务能进入；局部修复不误触发；成熟界面允许无修改；缺证据不判已通过 |
| U2 素材与效果参考 | 产品预览/图表/对象/场景选择、prompt 与构图模板、可选代码效果 | 真实事实保留；无图像能力时仍明确交付边界；窄屏、替代文本、尺寸和性能得到验证 |
| U3 采集工具 | 修订 snapshot、资源/失真报告、明确预览边界 | 响应式与懒加载、字体/图像失败、Canvas/Shadow DOM/表单、主动内容与联网都显式测试 |
| U4 展示工具 | 修订 story、本地 fixture、唯一临时目录和输出策略 | 实际视频编码、目录隔离、已有文件保留、并发、异常与中断清理；生产产物无 story 属性 |
| U5 综合验证 | dashboard/marketing/成熟局部页面三个类型的旧流程 vs 新流程 | 同输入、状态和设计约束；保留权限/功能/事实，真实浏览器及人工视觉评审；不能只比较截图漂亮程度 |

工作流/素材适配可以独立于脚本推进，不需要等全部工具完成；也不因工具有边界问题而否定完整流程。当前完成的是深入研究、上游登记和原始能力实测；U1–U5 尚未作为正式资产交付，尤其没有模型视觉重塑 A/B、图像生成或生产 UI 验收。下一步由上述范围驱动实施，不再限定为之前两条补充文案。

只读协作：`unslop_workflow_depth` 负责工作流与现有能力映射，`unslop_tool_boundaries` 负责脚本边界，主线程负责固定源码、浏览器/视频实验和治理落盘；边界复现经安全代理核对。没有改用户级 `product-visual-design` 或日常插件。

## 2026-11-09 早间更新（历史范围判断）

- 最新 `main`：`97daa3eb365670ea3f87ed85356cbfcee18105a5`，提交于 2026-11-08 21:16:22 UTC（北京时间 11 月 9 日 05:16:22）。相对旧 `a6f121e` 前进 17 个提交。
- [固定提交差异](https://github.com/heydamir/unslop/compare/a6f121eee5f29c2f74976b75456feae8b66afb3a...97daa3eb365670ea3f87ed85356cbfcee18105a5)涉及 README、SKILL、两个脚本，新增 `test/snapshot.test.mjs` 和 `test/story.test.mjs`；五份 references 与 LICENSE 未变。
- 最新结构仍为 1 个 skill、5 份 references、2 个脚本，另有 2 个测试。许可证仍为 CC BY 4.0；新增测试不等于在本机运行通过。

| 最新变化 | 本地吸纳判断 |
| --- | --- |
| SKILL 补充表格状态和按钮圆角检查 | 表头/数值/选中/focus 可辨识值得补入既有 UI checklist；圆角遵从本地组件契约，不导入统一风格禁令 |
| snapshot 支持本地文件、尺寸参数验证、滚动触发懒加载 | 改善静态方案稿输入范围；仍不恢复应用业务逻辑，离线完整性和活动 HTML 隔离另验 |
| story 改进 meta 解析、lint 提示和部分失败清理 | 展示能力有所完善；固定 `.story-frames`、路径 `startsWith(root)` 与并发/失败清理仍需专项验证 |
| 上游新增测试 | 可以借鉴输入/失败场景；本轮未运行，不宣称脚本已安全或已适配 Windows |

早间曾将增量限定为 heavy/light/no-op 分流、同条件前后证据和逐层修改记录。后续去重又缩为两条。这些是当时的局部候选，不再代表当前完整采用范围；上面的深研保留整个视觉重塑编排的价值，同时复用已有品牌、token、组件 owner 和浏览器规则。

早间仅更新研究记录，尚未把方法写入 canonical skill；本轮新增真实脚本实验与 evaluating 登记。统一优先级和验收见 [执行方案](optimization-execution-plan-2026-11-06.md)。固定源码：[SKILL](https://github.com/heydamir/unslop/blob/97daa3eb365670ea3f87ed85356cbfcee18105a5/skills/unslop/SKILL.md)、[snapshot](https://github.com/heydamir/unslop/blob/97daa3eb365670ea3f87ed85356cbfcee18105a5/skills/unslop/scripts/snapshot.mjs)、[story](https://github.com/heydamir/unslop/blob/97daa3eb365670ea3f87ed85356cbfcee18105a5/skills/unslop/scripts/story.mjs)。

## 2026-11-06 历史分析

## 来源与范围

- 项目：[heydamir/unslop](https://github.com/heydamir/unslop)，作者 Damir Sokolovsky（[@heydamir](https://x.com/heydamir)）。
- 固定提交：`a6f121eee5f29c2f74976b75456feae8b66afb3a`，提交时间为 2026-11-01；最新提交修复快照丢失响应式图片的问题。
- 实际结构：**1 个 skill、5 份 Markdown references、2 个脚本**，另有参考图片、示例页面和 `agents/openai.yaml`。该 YAML 是显示信息，不是独立 custom agent。
- 本轮读取 README、完整 SKILL、5 份 references、snapshot 脚本及 story 脚本的输入/输出、服务、渲染与清理相关部分；未逐行审查 story 的全部动画实现。
- 本轮只作为候选研究，不增加默认安装项，不登记为已吸收上游。

## 能处理什么

| 能力 | 输入与产物 | 适用边界 |
| --- | --- | --- |
| UI 视觉审查 | 已有页面/截图 → 可定位问题清单 | 重点是间距、层级、色彩、图标、文案、装饰与模板化；不能替代功能或安全审查 |
| 产品视觉方向 | 产品和受众 → Product / Character / World / Moments / Signature | 有助于避免改完仍像通用模板；已有品牌和设计系统应当优先 |
| 页面精修 | 可编辑源码 → 九个层次的调整 | 顺序为 spacing、color、icons、copy、type、layout、details、visuals、motion；支持 heavy / light / no-slop 分流 |
| 只有网址时的方案稿 | URL → 静态 HTML 与现场截图 → 修改后的静态稿 | `snapshot.mjs` 不会还原原站框架、业务逻辑、登录状态和完整交互 |
| 只有截图时的方案稿 | 截图 → 人工重建静态 HTML | 由 agent 重建，没有自动、无损截图转代码能力 |
| 产品视觉素材 | 图像服务 + prompt → hero/对象素材 | 需要宿主实际具备图像工具；项目本身不提供图像生成后端 |
| 改造过程展示 | story HTML → 约 10 秒 MP4 | 需要 Playwright、Chromium 和 ffmpeg；用于展示，不证明真实产品交互已实现 |

依据：[README](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/README.md)、[SKILL.md](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/skills/unslop/SKILL.md)。

## 资源拆解

| 文件 | 用途 | 本项目的合适落点 |
| --- | --- | --- |
| `references/signs.md` | 按视觉层列举模板化迹象 | `ui-ux-review` 的按需检查参考；先用项目契约与渲染证据确认 |
| `references/tokens.md` | 间距、颜色、字体、圆角、动效的起始值 | 仅作无设计系统时的方案参考，不覆盖既有 token |
| `references/visuals.md` | 素材选择、prompt、构图和页面集成 | `frontend-ui-engineering` 的可选视觉资源指导 |
| `references/effects.md` | glyph、halftone、dither、duotone | 按需实例，不纳入默认界面要求 |
| `references/refs.md` | 成品示例的索引 | 理解构图与强调方式，不复刻品牌与布局 |
| `scripts/snapshot.mjs` | 浏览器抓取 DOM/CSS、图片和截图 | 独立实验工具；如吸收，先补输出、网络与离线能力测试 |
| `scripts/story.mjs` | 本地 HTTP 服务、逐帧截图、ffmpeg 编码 | 独立展示工具；如吸收，先隔离临时目录、检查路径并补失败清理 |

## 吸纳建议

优先对现有资产补最小机制，不新增一套重叠的 `/unslop` 默认流程：

1. **改动程度分流**：大范围方向修订、轻量 polish、无需修改。尤其保留“没有问题就停止”，防止为证明优化而改变好页面。
2. **可解释的调整顺序**：先稳定内容与间距，再处理排版/布局，最后加素材和动效。映射到本地 token、组件 owner 与状态验证，不要求每次机械执行全部九轮。
3. **前后证据清单**：同路由、同数据、同 viewport 的截图加用户流程复验，标明改善项与保留项。story 只是附加演示，不能替代截图和浏览器验收。
4. **具体文案检查**：变化值有比较对象，产品声明有来源，短标签保持动作一致。只保留现有 `design-direction-and-copy.md` 尚未覆盖的增量。

本地已经有产品主题、受众、主要任务、Signature、Restraint、文案与渲染证据规则；这些不属于本轮新增缺口。主要增量是 polish/no-op 分流与可复核的逐层修改记录。

## 不直接照搬的内容

- 全面禁止紫色、渐变、emoji、粗字重、斜体，或固定侧栏宽度、4px 网格：属于上游风格偏好，不能推翻项目设计契约。
- 以“像 slop”为由重画 logo：品牌资产调整必须服从用户目标。
- 主流程最多渲染三次：不能阻止必要的错误修复、窄屏、键盘或 reduced-motion 验证。
- 无图像工具时留下空视觉槽：本地交付仍需明确完整性，不把空槽称为已完成。
- 将 story 中的 layout tween 当成生产动效实现：演示与产品运行代码应分开。
- 整份主文直接常驻：`SKILL.md` 为 31,327 bytes，若采用应拆为短入口和按需 references。

## 脚本采用前需验证的事实

以下是源码观察与采用前检查项，不是完成的安全审计：

- `snapshot.mjs` 使用新浏览器页面，删除 script/source/srcset 等内容；跨源资源抓取失败或资源超过内联限制时保留远端 URL，因此不能声称“完全离线”。
- 删除 `<script>` 不等于完整 HTML 清洗；代码没有统一去除事件属性、iframe、表单提交和所有活动 URL。把外部页面当作不可信输入，若要提供安全静态预览，需单独定义并验证隔离契约。
- `story.mjs` 使用固定 `.story-frames` 并递归删除；并发任务、已有目录及失败恢复需要独立验证。
- 本地服务使用字符串 `startsWith(root)` 检查路径。若引入运行时，应改为经过规范化/真实路径核对的目录边界，并测试兄弟目录前缀、编码路径和软链接；本轮未执行利用复现。
- `effects.md` 示例有持续 animation frame 和 IntersectionObserver；若落入应用，需按组件生命周期补齐 observer 清理、reduced motion 和页面隐藏时的行为。

脚本来源：[snapshot.mjs](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/skills/unslop/scripts/snapshot.mjs)、[story.mjs](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/skills/unslop/scripts/story.mjs)、[effects.md](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/skills/unslop/references/effects.md)。

## 来源保留

上游标注 [CC BY 4.0](https://github.com/heydamir/unslop/blob/a6f121eee5f29c2f74976b75456feae8b66afb3a/LICENSE)。若复制或改写分发，需保留作者、来源、许可证及改写说明，并验证这些材料随各平台产物一起分发；不能仅因为本仓库使用 MIT 就移除上游标注。本轮只写分析，没有导入上游正文、脚本或图片。

## 建议的最小验收样本

- **重度模板页面**：调整后仍保留原有功能、内容事实、路由和授权；同数据前后截图支持每条改善结论。
- **已有设计系统、仅局部间距错误**：只修对应 owner，不更换品牌色、字体、布局或依赖。
- **已经合理的页面**：允许 zero-diff，不能靠新增装饰表现“做了工作”。
- **品牌本来就是紫色/渐变**：不得仅凭上游禁令判错。
- **无浏览器或只有 URL**：明确证据限制与静态稿性质，不宣称真实应用验收通过。

结论：建议吸收少量方法到现有 UI 资产；snapshot/story 工具保持可选候选，待独立验证后再决定是否产品化。
