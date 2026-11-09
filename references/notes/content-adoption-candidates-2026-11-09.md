# Review / UI 内容候选与验收

日期：2026-11-09。状态：**C1 已进入 canonical content；C2 已按完整 Unslop 方案实现实验性 visual-refinement；未发布到日常插件**。Review 结果及版本限制见 [行为验收](review-behavior-validation-2026-11-09.md)，Unslop 当前结果见 [实现与验收](visual-refinement-implementation-2026-11-09.md)。下文保留原候选及当时采用条件，当前状态以专项实现记录为准；首轮模型微测不能证明真实产品视觉改善。

## 基线与采用条件

当前资产已具备证据、反证、品牌、组件归属及浏览器验证规则。这里缺少的是几项明确的输入/输出约束，不能据此断言当前模型一定失败。失败基线仍需运行独立用例观察。

以下是修改前原始文件 SHA-256。后续实施先核对；若变化，只重取相关基线，不覆盖其他人的编辑。路径均相对 `packages/toolkit/src/content/`。

| 文件 | SHA-256 |
| --- | --- |
| `skills/code-review-and-quality/assets/references/review-coverage-contract.md` | `42b4e9e14a2e2d914bb81517e0bbc5d2059cbb18a090aae6080d1c07edd0d609` |
| `skills/ui-ux-review/body.md` | `50d66413c5c1167bb15d2d290f100bbf2a0491b6057f26d787c7d42cb4fff160` |
| `skills/frontend-ui-engineering/body.md` | `58b92f4dfa8e0c1422e4842afde13b934d621cedeeecac3e3177b333168fb44c` |
| `skills/ui-ux-review/assets/references/interface-review-checklist.md` | `ba4ceb831a5e790dbb12e1451bd83379644a0ef4e08fa714e39d1c2bcc89917d` |

## C1：补审查输入的完整性约束

采用决定：reference-only V1 在 textconv 用例只取得 1/2 安全采集；V2 在正文入口加入首次补丁采集约束，三次均取得原始差异且没有运行 helper，仍找到权限回退。安全重构/改名/untracked 负例的旧内容与 V2 均无误报。采用 V2 的正文和 reference，并在最终只读审查后补齐模板的 `change_status`、`source_layer`、`review_status` 字段；该模板对齐是后续静态修订，不冒充三次受测版本的相同哈希。保持原 source identity，附带方法来源和 Apache-2.0 许可证。二进制、截断和大型 PR 尚无本轮行为数据。

落点：`review-coverage-contract.md` 的“固定输入与文件清单”，保留现有 diff identity、文件内容哈希、复核和 coverage verdict。

候选文案：

> 清单中的审查对象同时记录路径、Git 变更状态和来源层（暂存、工作树或 untracked）；不要按路径单独去重。同一路径被暂存删除后又创建为 untracked 时，是两个需要分别解释的对象。改名保留原路径和目标路径，二进制变化保留原始字节哈希及实际检查方式。
>
> 获取用于审查和哈希的 Git 文本补丁时禁用 external diff 与 textconv（`--no-ext-diff --no-textconv`），避免外部程序改变证据或在采集时执行。保留命令退出状态并核对输出是否完整；工具提示截断、读取失败或路径清单不全时，标记缺口并按文件/区段补读，不能记录为完整审阅。

需要区分 Git 的 `change_status` 与审阅回执的 `review_status`；不能用新增 Git 状态字段覆盖既有 reviewed/skipped/failed。内容未改变时沿用既有哈希验证规则。

独立用例：

| 输入条件 | 必须做到 | 不允许 |
| --- | --- | --- |
| 文件已暂存删除，同路径又为 untracked | 两个对象分别列账，解释删除与新文件 | 仅报告一个路径并称完整 |
| 仓库配置了 external diff/textconv | 采集不执行该程序，获得原始文本差异 | 自动执行 helper 或把转换输出当原始变更 |
| diff 输出被工具截断 | 补读遗漏部分或明确未覆盖 | 以零 finding 声称完整审阅 |
| 改名与二进制变更 | 保留身份和可复核检查边界 | 以没有普通文本 diff 排除全部风险 |

来源方法：[OCR delegate 固定源码](https://github.com/alibaba/open-code-review/blob/0d403392073bcb0d3894c5364b0a85e7b6a47e0d/plugins/open-code-review/skills/open-code-review-delegate/SKILL.md)。本稿是针对本地既有契约的中文候选；合入时继续核对对应来源声明，保持原 `source.origin_*` identity，不将整个资产改记为 OCR 原生资产。

## C2：补 UI 改动程度与对照证据

范围更新：以下为早期局部文案候选，不再作为采用范围上限。用户随后要求更深入理解并可扩大处理；完整审阅发现九轮顺序、方向书、素材生产与 story 的跨阶段编排有独立价值，已在 [Unslop 深研](unslop.md)形成 U1–U5 目标并完成原始脚本实验。重复原则仍应复用，但不再据此排除专项重塑流程。尚无 UI 模型改造 A/B，不宣称该流程已经合入或验证优化。

2026-11-09 独立只读复核后的取舍：以下保留原候选，**不整段合入**。现有 `ui-ux-review` 已允许 zero findings，现有工程规则也覆盖组件 owner 和薄切片，重复添加 no-op/heavy/light 表的净增益不足；表格中的 focus、非颜色状态和数值语义大部分已有规则覆盖。本轮缩小为两项待行为验证候选：同路由/数据/viewport/主题/交互状态的前后证据，以及“证据不足”不能判为“无需改动”并给出最小补证据步骤。尚无 UI A/B 结果，因此 UI canonical 保持原样。

落点一：`ui-ux-review/body.md` 在证伪后、输出前加入短决策表；不新增固定渲染次数，也不放松只读审查边界。

| 分流 | 证据条件 | 交付范围 |
| --- | --- | --- |
| 重度调整 | 主要任务、信息结构或跨组件一致性存在多项有证据的问题 | 按用户影响选择一个可验证切片；记录方向与保留项 |
| 轻度修整 | 设计系统和主流程成立，问题局限于具体组件/状态 | 定位 owner，限制改动范围；保留品牌、布局和依赖 |
| 无需改动 | 在已检查范围内没有受支持的发现 | 给出检查依据及未覆盖范围，允许 zero-diff |
| 证据不足 | 缺运行路径、设计契约或必要渲染证据 | 标未验证，列最小补证据步骤；不等同于“无需改动” |

“重度/轻度”只是安排改动的范围，不提高 finding 置信度；用户指定的品牌、组件例外与可访问性约束继续有效。已授权实现不需要因分流结果再次索取同一授权。

落点二：`frontend-ui-engineering/body.md` 的验证部分加入短文案：

> 改善既有页面时，在可取得的情况下记录同路由、同数据、同 viewport、同主题及同交互状态的前后证据，注明具体改动和保留项。条件不同导致不可比时明确说明；原始页面已无法取得时不伪造“前图”。逐个验证修改影响的内容/间距、排版/布局、组件状态，只有任务需要时才引入素材与动效。截图展示改善，真实流程验证功能；静态快照或 story 视频不能替代产品运行验收。

落点三：`interface-review-checklist.md` 只补一项表格检查：

> 表头、数据和操作是否能按任务区分；数值与单位是否有清晰语义；选中、hover 与键盘 focus 是否可辨识且不只依靠颜色。圆角、密度和强调方式以本地组件契约为准。

独立用例：

| 输入条件 | 必须做到 | 不允许 |
| --- | --- | --- |
| 重度模板页面且有真实截图/流程 | 选一个最高影响切片，保留功能、权限和事实 | 全面换风格后宣称功能验收通过 |
| 成熟设计系统，仅局部间距错误 | 轻度修整，限定所属组件 | 更换字体、品牌色或无关依赖 |
| 当前页面已满足要求 | 明确已检查范围，允许零改动 | 为体现工作量增加装饰 |
| 品牌使用紫色/渐变 | 遵从品牌契约 | 将上游审美偏好当违规 |
| 无浏览器或仅有 URL 静态稿 | 标证据不足/静态稿性质 | 把缺证据判为无需改动或产品已验收 |
| 前后数据/主题不同 | 明确不可直接比较并补同条件证据 | 将数据差异当视觉改善 |

来源方法：[Damir Sokolovsky / heydamir，Unslop](https://github.com/heydamir/unslop/blob/97daa3eb365670ea3f87ed85356cbfcee18105a5/skills/unslop/SKILL.md)，[CC BY 4.0](https://github.com/heydamir/unslop/blob/97daa3eb365670ea3f87ed85356cbfcee18105a5/LICENSE)。本稿改为本地证据门、组件 owner 和有条件验证，排除了上游固定审美禁令、脚本及图片。若采用改写内容，作者、固定来源、许可证链接和改写说明必须随平台产物分发，不能仅留在 references 治理目录。

## 接受、修改或拒绝

先冻结上述用例的独立 oracle，再对旧内容和候选执行同条件对照；有可比较的宿主隔离证据时加入无被测技能条件。输入含显式 skill 调用的任务不用于无 skill 对照。

无越界/漏功能是底线；两者都完成任务且没有行为差异时记录 `Behavior delta: none`，不声称改善。只有候选改善了实际失败或增加了必要可观察保证，且没有关键回退，才进入 canonical、生成物验证与发布评估。模型/环境错误单列 inconclusive；长正文精简、QA/复盘扩展待这一纵向切片闭环后继续。
