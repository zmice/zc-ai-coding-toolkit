# Unslop 在当前项目的落地（2026-11-09）

深研方案已落实为可选、实验性的 `skill:visual-refinement`。来源固定为 Unslop `97daa3eb365670ea3f87ed85356cbfcee18105a5`；未发布 npm、未更新日常插件。原始上游实验仍见 [主记录](unslop.md)，不能与适配后的结果混用。

## 已落地

- **U1 工作流：** 输入与证据 → heavy/light/无需修改/insufficient → Product/Character/World/Moments/Signature → 九轮记录 → 同条件对照与真实 QA。允许有依据地跳过，不复制固定审美禁令。
- **U2 按需资料：** 方向与九轮、素材与效果、证据与工具三份 reference；使用宿主已有图像能力，保留品牌、事实、中文排版、组件 owner 与功能。
- **U3 snapshot：** 输出 `reference.html`、`source.png`、`report.json`；支持 Windows 绝对路径、响应式和 lazy 图片，保留普通输入运行值，移除 password/file 值，报告保真/资源限制。报告 URL 去除用户信息、query 和 fragment。
- **U4 story：** 保留累计 CSS 状态、测量红线、波浪过渡与文字效果；输出 MP4 和报告。严格 HTTP mount、realpath/目录关系和普通文件检查，拒绝 symlink 越界；独占临时帧目录，保护已有 `.story-frames`，处理失败和超时清理。
- **入口整合：** `command:ui` 推荐新技能；工程与审查正文仅在明确重塑请求时交接。建议关系采用单向编排，避免循环。
- **分发与许可：** 四个支持 skills 的平台携带正文、脚本、reference、CC BY 4.0 许可及作者/改写声明。Claude 当前适配器跳过 skills，已说明限制；未复制上游示例图片。

源码：[meta](../../packages/toolkit/src/content/skills/visual-refinement/meta.yaml)、[body](../../packages/toolkit/src/content/skills/visual-refinement/body.md)、[工具使用和 story 格式](../../packages/toolkit/src/content/skills/visual-refinement/assets/references/evidence-and-tools.md)。安装包含此资产的构建后，Codex 插件入口为 `$zc-toolkit:visual-refinement`；源码新增不意味着已安装插件自动升级。

## 实际验证

| 检查 | 结果与范围 |
| --- | --- |
| toolkit lint | 82 assets，0 warnings / 0 errors |
| toolkit 完整包检查 | 58/58 通过；六个 toolkit/平台包合计 111/111，日志 `.cache/visual-verify-final-1109.log` |
| 新增定向测试 | 12 项：当前权限内 11 passed / 1 skipped；Windows junction 创建受限。该 junction 回归在先前获准的 6/6 工具测试中已实际通过 |
| 四平台生成 | Codex、Qwen、OpenCode、Qoder CN 附件与 canonical 内容逐字节一致；同时验证 Claude 跳过 |
| CLI 包测试 | 33 个文件通过，282 passed / 4 skipped；含上游 35/35。跳过为原有 1 项及当前无权创建 junction 的 3 项 |
| 发布态 smoke | 最终正文上再次执行 `pnpm verify:mvp` 成功，日志 `.cache/visual-mvp-final-1109.log`；不是发布或日常插件安装 |
| 真实工具集成 | Chrome + Playwright + ffmpeg：snapshot 成功；story H.264、1080×1080、10 fps、70 帧、7 秒；已有帧目录保留，启动失败及 1 秒超时后的独占帧目录清理通过 |
| 全仓 `pnpm verify` | 尚非全绿：包检查和构建已通过；评测/分发测试 41 passed / 2 failed，失败位于 Review external diff/textconv 的 MSYS helper 启动，沙箱拒绝 `NtCreateDirectoryObject`（0xC0000022）。本轮未提权，两项失败保留 |
| 空白检查 | `git diff --check` 通过 |

最终工具实跑目录 `.cache/visual-browser-WqkBeE` 含输入、截图、视频、失败报告、源码哈希和 `receipt.json`。最初成功运行 `.cache/visual-browser-0lTDIx` 在独立审查前，最终修复以 `WqkBeE` 为准。复现入口 [browser-smoke.mjs](../../tests/visual-refinement/browser-smoke.mjs) 从已有 Playwright 的目录显式传 `--execute`，不安装依赖。

独立审查提出并修复两项问题：关闭浏览器后、启动 ffmpeg 前再次检查中止状态；snapshot 成功/失败报告及日志统一脱敏 URL。后续集成测试使用修复后的源码，URL 脱敏另有独立单元断言。

## 行为验证与剩余边界

U5 本轮是三组隔离 Codex 首轮行为对照，见 [行为微测](visual-refinement-behavior-2026-11-09.md)。它用于区分重塑、缺证据和功能负例，不是完整产品视觉 A/B。脚本测试和模型回答不能证明生产页面功能、权限、响应式和无障碍验收通过，因此保持 `stability: experimental`。

独立评分：重塑 `partial → pass`，参考 URL 缺证据 `partial → partial`，功能负例 `pass → pass`。URL 场景未明确索取缺失画面的入口，已在正文补充所需截图/访问方式的输出要求；这是受测版本后的静态补强，未重新调用模型，不把该缺口列为实证修复。最终正文通过 lint、附件生成、发布态 smoke 和空白检查。

## 同日继续收尾：无需新增授权

复用本机已安装的 pnpm 10.13.1，在本次进程 PATH 中优先使用其目录；临时文件放入短路径 `.cache/v1`。这消除了版本自举写入沙箱用户缓存失败及测试夹具路径过长的问题，没有改用户全局配置。

实际修正了两处测试问题：Orchestrator 改用 `mkdtemp(tmpdir())` 并清理自己拥有的目录，去掉 Windows 下落到 `E:/tmp` 的写死路径；三个畸形锁恢复场景拆为独立参数化用例，分别保留原有 5 秒上限与完整断言，避免三个 Git 工作流共用一个超时。定向 5 项通过，之后 CLI 全包通过。

目录链接测试在本地环境出现 EPERM/EACCES/ENOTSUP 时明确 skip；`CI` 已设置时仍抛错。已用当前不支持 junction 的环境设置 `CI=true` 运行一项反证检查，预期失败且没有把该用例跳过，日志 `.cache/visual-ci-capability-guard.log`。支持目录链接的环境仍执行原安全断言。

新增 [验证入口说明](../../tests/visual-refinement/README.md)，区分默认自动检查、手动浏览器工具集成与真实模型首轮实验。本轮没有重复触发模型或浏览器授权；上一轮真实工具结果只适用于记录中的源码哈希。

Canvas 与 Shadow DOM 仍不保真，snapshot 不是净化器或完全离线导出；story 使用自己编写的可信独立 HTML。尚未验证所有信号时序、编码器失败和浏览器平台。

回退可撤销新 skill、UI handoff/建议关系及测试入口；不涉及运行数据迁移。发布、日常插件更新和真实业务产品的完整重塑不在此次完成范围内。
