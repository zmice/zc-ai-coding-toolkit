# Visual Refinement · 视觉重塑

按 Unslop 方法编排页面设计与视觉重塑：产品任务 → 方向 → 页面蓝图 → 执行计划 → 实现 → 渲染验收。新页面从 brief 建立设计，已有页面从整屏证据判断改动程度。单点功能修复走 `skill:frontend-ui-engineering`；纯审查走 `skill:ui-ux-review`。已有实现授权无需为采用此流程重复询问。

## When to Use

新页面需要确定内容结构、布局或视觉方向，或现有页面需要整屏重塑、去模板化、多层视觉规划时自动使用；不要求用户点名 Unslop。`command:start` 和前端工程可以按任务进入。已有可执行设计时沿用，只补缺口；普通组件开发、单点修复不自动扩展为全面设计。只给设计方案时采用规划部分，保持只读。

## Quick path

1. **固定目标、输入与授权。** 读真实路由、内容、数据/权限和设计系统，明确用户任务、主要操作、组件 owner 与不可变项。已有页取得整屏、窄屏和关键状态；新页不要求不存在的旧截图，先从业务 brief 和相邻页面建立契约。只有 URL/截图时区分现场、参考副本和静态方案稿，不能声称恢复业务逻辑。采集见 [evidence-and-tools.md](references/evidence-and-tools.md)。
2. **分流并确定范围。** 新页用 `new`；已有页按证据选 `heavy`（多个层面牵连）、`light`（局部精修）、无需修改（符合契约）或 `insufficient`（不足以判断）。只审查先用 `skill:ui-ux-review`。缺少渲染时可以做暂定规划，不能给未见画面判错；无需修改时直接交付依据。
3. **写方向并落实为蓝图。** 使用 Product、Character、World、Moments、Signature，逐项映射到真实业务、token 和组件，见 [workflow-and-passes.md](references/workflow-and-passes.md)。随后按 [design-plan.md](references/design-plan.md) 明确内容区域、主次任务、宽窄屏阅读顺序、状态与视觉重点。业务目标与已知组件足够时，首轮就给暂定区域顺序与主操作位置；未知项标为待查，不仅承诺“稍后写蓝图”。后台页不强制 hero、图片或动效。
4. **建立可执行计划。** 每项写明 ID、依据、目标区域/owner、具体变更、依赖和可观察验收。首轮可以只列主任务的 2–3 项，须有实际动作与先后依赖；读取源码后修正暂定 owner。`new/heavy` 先解决内容与结构，再细化样式；`light` 只处理有证据的问题。只给方案时在响应中交付，不写文件；已授权实现时简要告知计划后直接推进，不停在“是否开始”。
5. **按计划实现与分轮复核。** 用 `skill:frontend-ui-engineering` 落实组件、数据、状态、响应式与无障碍。先交付主要任务的可运行切片，再用 Spacing → Color → Icons → Copy → Type → Layout → Details → Visuals → Motion 九个视角复核整屏。九轮是覆盖检查，不要求九次修改；记录命中计划项、保留/跳过依据。素材与特效确有需要再读 [visuals-and-effects.md](references/visuals-and-effects.md)。新证据导致偏离计划时先更新原因、受影响项和验收，不静默改方向。
6. **逐项验收。** 把实际渲染与蓝图/计划逐项核对；已有页还需同路由、数据、viewport、主题、语言和状态的前后对照。用 `skill:browser-qa-testing` 复验主要操作、加载/空/错/禁用/成功/权限、键盘焦点、窄屏和 reduced motion，再按 `skill:verification-before-completion` 报告。实现和验证分开记状态；截图只证明画面，没有浏览器证据的项目保留待验证。
7. **可选 story。** 评审或传播确有需要时才制作独立 story HTML；演示内容不进入生产代码。没有 Playwright/Chrome/ffmpeg 或不能编码时，交付已有截图与记录，说明尚未取得的证据。

## 输出

确实需要忠实匹配参考、现有工具又无法取得画面时，指出所需截图或可访问方式；不依赖参考的已授权工作继续。不能只标记 `insufficient` 后让缺失输入悬空。

按范围交付分流依据、方向与页面蓝图、计划项的实现/验证状态、九轮复核（含保留/跳过）、实际证据和未覆盖范围。`light` 可以合并为短表；无需修改或 `insufficient` 不生成空计划。新页以 brief → 蓝图 → 渲染验收，不伪造 before。只给方案时不把待执行项标成完成。

只给多页方案时，每页至少交付一个具体实现切片、依赖和“操作 → 预期结果”的验收；不能仅列“读资料 → 写蓝图 → 交付方案”。缺少源码细节可以标注待查，已知任务足够的部分先给暂定计划，且保持只读。

进入完整交付时，把方向、蓝图、组件 owner、计划 ID、待定项及验收方式交给现有 spec/plan；后续实现、审查与验证沿用这份事实源，不另起冲突的视觉计划，也不在阶段切换时重新设计。交接细节见 [design-plan.md](references/design-plan.md)。

来源与改写见 [LICENSE-unslop.txt](references/LICENSE-unslop.txt)。新页蓝图、计划追踪与验收映射是本仓库对固定上游的扩展，未复制示例图片。
