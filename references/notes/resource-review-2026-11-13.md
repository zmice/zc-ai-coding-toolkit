# 项目资源质量审查与修复

日期：2026-11-13（Asia/Shanghai）。按 `quality-review` → `code-review-and-quality` → `review-response-and-resolution` 执行。结论：本轮资源与当前变更审查 **Approve**；没有未处置的 Critical / Important。未发布、未升级已安装插件，也不代表真实产品页面验收通过。

本文保留该轮审查的固定快照。后续共享契约、完整页面案例、原生评测与安装验证见 [后续优化记录](unslop-lifecycle-validation-2026-11-13.md)，不沿用本文旧哈希证明后续变更。

## 已处理问题

| 等级 | 问题与证据 | 处理与复验 |
| --- | --- | --- |
| Important | `commands/build/body.md` 要求所有切片走 RED/GREEN，与 TDD skill 对纯静态内容的豁免冲突；新页面设计流程会经过该入口 | 按切片性质选择验证：行为变化保留 TDD，静态/视觉切片使用相称检查和实际浏览器对照。独立 reviewer 对静态布局、提交/错误恢复两例做指令层回归，均通过；不声称这两例已跑真实产品 |
| Important | `visual-refinement/assets/scripts/snapshot.mjs` 将 hidden 表单的运行时值写入可分享 HTML；纯内存合成 DOM 复现了 hidden 值保留，password 已有保护 | 默认移除 hidden/password/file 的 value，报告只计数；真实 Chrome fixture 验证原始及运行时哨兵不进入 HTML、回放值为空、可见 input/textarea 保留。独立安全回归关闭 finding |
| Important（验证可靠性） | `tests/skill-evals/review-coverage-cases.test.mjs` 在 Windows 清理 Git 夹具时遇到 EPERM，使完整门禁失败 | 使用原生 `rmSync` 的 5 次有界重试、100 ms 递增等待基础值；未跳过或修改业务断言。定向 5/5 与后续全量门禁均通过，两个已确认属于失败运行的夹具目录已清理 |
| Suggestion | 页面设计判型在入口和多个阶段重复，存在以后漂移的维护成本 | 本轮保留独立进入 spec/plan/build 时的兜底判断；主路由、蓝图和任务 ID 保持统一。暂不为消除文字重复引入 dispatcher 或删除直接入口能力，作为后续维护项 |

快照修复仅覆盖已确认的隐藏输入泄露，不按字段名猜测并删改可见内容。其他属性、文本、可见输入、textarea、图片和主动内容仍可能存在于副本；工具不是 HTML 净化器，分享前仍需按已有契约检查。

## 范围与五维度结论

全量结构审计覆盖 **82 项资产：42 skills、30 commands、10 agents，32 份附件**。来源注册、资产关系、发现元数据、正文与附件本地链接、重复正文和无 metadata 的目录均检查；未发现断链、相同正文或孤立资产目录，`toolkit lint` 为 0 errors / 0 warnings。

语义审阅采用“当前变更逐文件 + 未变高风险资源定向检查”，没有宣称 82 项资产的全部历史代码均做了逐行安全审计：

- workflow reviewer：start 与阶段接力，build/spec/plan/verify/review/TDD 等约束。
- frontend reviewer：视觉与工程技能、规划参考、三组评测用例及分发测试。
- security reviewer：快照/story/runtime 脚本、安全/协作规则和相关 agent 角色边界。
- 主线程：文档、来源说明、changeset、UI 入口、测试夹具修复、全量结构与集成证据、最终身份合流。

| 维度 | 本轮结论 |
| --- | --- |
| 正确性 | 修复 TDD 入口冲突；设计仍按同一蓝图/计划衔接，已有设计、只读、局部 bug 和后端边界保留 |
| 可读性 | 将快照输入处理的压缩单行展开，说明隐藏值移除目的；修订来源变更说明与工具文档 |
| 架构 | 资产事实源仍在 toolkit，平台消费生成结果，references 仍是治理证据；不增加独立插件或第七条 workflow |
| 安全性 | 隐藏表单值修复并实际回归；主动内容、可信 story 目录和可见业务信息的边界未夸大为全量净化 |
| 性能 | 新增表单处理仍是线性遍历、常量类型判断；清理重试有上限，无新运行时依赖。目录 metadata 的字符统计只作体量证据，不等同 host token 实测或通过未配置的预算门限 |

## 实际验证

- 最终 `pnpm verify`：exit 0；toolkit/平台 **111 passed**，CLI **285 passed / 1 skipped**，评测/目录/分发 **43 passed**，visual-refinement **16 passed**。合计 **455 passed / 1 skipped**。
- 唯一 skip 是 `apps/cli/src/cli/__tests__/surface.test.ts` 既有 Windows 条件跳过的 symlinked-bin 测试；视觉脚本的符号链接越界测试本轮在最终验证中通过。
- `review-coverage-cases.test.mjs` 定向回归：5/5 passed。
- 真实 Chrome + Playwright + ffmpeg/ffprobe 合成集成：快照脱敏与可见字段保持、响应式/懒加载资源、H.264 1080×1080 / 10 fps / 7 s 视频、既有帧目录保留、启动失败与超时清理全部通过。
- 四平台视觉附件逐字节分发、Codex 从 start 到设计/实现/QA 的完整生成链通过；Claude 当前跳过 skills，未声称该能力已分发到 Claude。
- `git diff --check --no-ext-diff --no-textconv` 与新增文档空白检查通过。

初次受限运行在 Git/MSYS 创建 Windows 命名对象时失败，沙箱外复验又暴露了夹具清理 EPERM。没有把这两次失败写成成功，也没有通过跳过断言绕过；修复清理后重新运行全量门禁取得上述最终结果。Chrome/ffmpeg 已通过后未无理由重复运行。

## 审查身份与回执

审查基于 HEAD `92abea913ebcd68881960ce96d5ed8b72d408884` 的暂存/工作树/untracked 状态。初始清单有 25 个对象，工作树原始 patch SHA-256 为 `832f0e07ffa02727c794a50bb76310a07ae1047229c3d24c1d3e2c3f4edff569`；暂存补丁为空。

所有用于审查与哈希的 Git patch 采集都关闭 external diff 和 textconv。修复后重新枚举最终清单、逐文件原始字节 SHA-256 和各层 patch SHA-256，复用回执时要求内容哈希相同；新改动单独审阅。完整记录位于 `.cache/resource-review-20261113/final-manifest.json`，分工回执为 `workflow-review.json`、`frontend-review.json`、`security-review.json`。`apps/cli/AGENTS.md` 是本轮前已存在的用户自有 untracked 指令文件，明确排除修改并核对内容未变，不计入源码审阅数。

验证原始证据：`.cache/resource-review-20261113/verify-final-2.log`、`final-test-status.json`、`coverage-regression.log`；浏览器工具回执为 `.cache/visual-browser-qWYuOb/receipt.json`，其中快照源码 SHA-256 为 `43a175db0f6cc51e26cda97b7466c873b306d5b0c5cea22297f99695883256df`。这些是本地审查证据，不随运行时插件分发。

## 剩余边界

- 先前六例 start 自动路由的盲评是首轮响应证据，本轮未重跑模型完整交付，也未将结构单测说成模型行为验证。
- 浏览器集成使用合成页面，不能替代真实产品的新页设计/已有页重塑 A/B、业务权限验收和人工视觉评审。
- 本轮未联网刷新所有上游，也未进行整个仓库的渗透测试；来源完整性针对本地已登记状态。
- 发布门禁要求处理未提交变更；本轮只审查修复与验证，不提交、发布或更新用户安装。

最终枚举还发现初次失败运行留下的 `.review-coverage-ucjvqK`，其创建时间、合成 `src/access.js` 与测试 Git 仓库结构吻合。确认绝对路径位于 `tests/skill-evals` 且无 reparse point 后已清理；不属于待交付资源。
