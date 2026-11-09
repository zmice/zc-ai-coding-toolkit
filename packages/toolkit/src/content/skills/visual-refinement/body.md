# Visual Refinement · 视觉重塑

专项编排已有界面的视觉重塑：从整屏证据确定改动程度，形成产品方向，再按九轮实施和对照验收。单点功能修复走 `skill:frontend-ui-engineering`；只要审查意见走 `skill:ui-ux-review`，保持只读。已有实现授权无需为采用此流程重复询问。

## When to Use

用户明确要求整屏视觉重塑、去模板化，或多层视觉问题需要共同方向时使用。只有局部功能修复或纯审查时使用对应常规技能。

## Quick path

1. **固定输入与契约。** 取得真实页面的整屏和代表性窄屏、关键状态及实际内容；记录路由、数据、viewport、主题、语言、权限、设计系统、组件 owner。只有 URL 或截图时先区分现场、参考副本和静态方案稿，不能声称恢复业务逻辑。采集方法见 [evidence-and-tools.md](references/evidence-and-tools.md)。
2. **诊断并分流。** 参照 `skill:ui-ux-review` 给每个问题定位证据和影响，再选择 `heavy`（多个层面相互牵连）、`light`（局部视觉精修）、无需修改（现状符合契约）、`insufficient`（缺少足够证据）。无需修改时不制造修改；证据不足时补证据后再判断。不得因为页面不符合上游偏好而判错。
3. **写方向。** 用 Product（一句产品与受众）、Character（具体气质）、World（业务的材料和场景）、Moments（最多几个重点视觉时刻）、Signature（一个可复用的识别细节）形成简短方向书；将每项映射到本地 token、组件、真实内容和页面任务。已有品牌、中文排版、功能与事实优先。详见 [workflow-and-passes.md](references/workflow-and-passes.md)。
4. **分轮落地。** 按 Spacing → Color → Icons → Copy → Type → Layout → Details → Visuals → Motion 检查整屏，每轮记录证据、变更、保留项及跳过理由。文案先于排版和布局，素材与动效最后加入。实现遵循 `skill:frontend-ui-engineering` 的组件、状态、响应式与无障碍契约。素材与特效仅在有产品理由时读取 [visuals-and-effects.md](references/visuals-and-effects.md)。
5. **对照和真实 QA。** 同路由、数据、viewport、主题、语言和状态比对前后整屏，复验主要操作、加载/空/错/禁用/成功/权限状态、键盘焦点、窄屏和 reduced motion。使用 `skill:browser-qa-testing` 验证浏览器行为，再按 `skill:verification-before-completion` 报告实际结果。截图仅证明画面，视频仅用于展示过程。
6. **可选 story。** 评审或传播确有需要时，使用独立 story HTML 展示累计变化；演示 CSS、标记与数据不进入生产代码。没有 Playwright/Chrome/ffmpeg 或不能编码时，直接交付同条件截图和记录。

## 输出

确实需要忠实匹配参考、现有工具又无法取得画面时，指出所需截图或可访问方式；不依赖参考的已授权工作继续。不能只标记 `insufficient` 后让缺失输入悬空。

交付所选分流及依据、方向书、九轮记录（含跳过）、复用的设计系统资产、前后同条件证据、真实浏览器和自动检查结果、未覆盖范围。无需修改或证据不足时也要明确交付结论。外部来源的归属与改写见 [LICENSE-unslop.txt](references/LICENSE-unslop.txt)；本技能是固定提交的改写，未复制示例图片。
