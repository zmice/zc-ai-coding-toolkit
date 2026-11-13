# Unslop 全流程案例、评测入口与安装验证

日期：2026-11-13。范围为当前资源优化与本地隔离验收；用户选择了仓库隔离案例，并明确允许将选定技能文本及合成题发送给当前模型服务。不是生产页面验收，也没有发布或替换日常插件安装。

## 从实际执行发现的问题

第一版工单创建页功能正确，但 390×844 截图中大标题和重复说明把标题输入推到首屏之外。浏览器自动检查“无横向溢出”和提交成功未发现这个设计问题，主线程查看实际画面后提出修正。

处理分两层：原案例按同一 N1–N4 计划缩短标题、删除重复说明并重新验证；技能的设计计划附件增加“操作型页面首屏可开始主要任务”的规则，同时说明长表单无需所有字段同屏。再用全新上下文、相同业务请求从空目录制作新样本；新样本自行把辅助说明排到窄屏表单之后，通过相同浏览器断言。这个单样本结果支持本次修正方向，不代表设计质量普遍提升的统计结论。

同时将判型与阶段交接的详细规则归到 `visual-refinement` 设计计划附件的“生命周期交接”。start 保留轻量路由，spec/plan/build 保留直接进入的兜底，继续复用方向、owner、蓝图和任务 ID。局部修复、后端、纯审查和只读方案边界保留，六条 workflow 未增加。

五个生成态入口正文合计从 15,696 减为 15,337 个 Unicode 字符（减少 359）；共享附件承载详细规则和新增验收。这是入口体量变化，不是总上下文或实测 token 降幅，数据见 `context-delta.json`。

## 隔离页面验收

生产者只收到业务请求和当前 start 入口，按需读取技能；主线程持有独立验收并运行真实 Chrome。生产者为 native custom agent，独立上下文，不是完全封闭的实验容器；禁止读取另一组产物和 oracle 由任务约束执行。因此与下节的原生拒读隔离评测分别记账。

| 案例 | 实际验收与结果 | 本地证据 |
| --- | --- | --- |
| 新建工单页，首轮后修复 | 1440×1000、390×844；首个输入可见，空值/空白阻止提交，长中文与文本安全输出、优先级、键盘提交、摘要、下一单重置和焦点通过 | `.cache/lifecycle-20261113/evidence/new-page-v2/receipt.json` |
| 工单列表重塑 | 相同视口、主题、语言、种子数据前后对照；三条记录的 ID/title/description/status/priority/owner 在列表和详情逐一比对；组合筛选、清空、无权限、分派失败保留选择、重试、更新状态和焦点恢复通过 | `.cache/lifecycle-20261113/evidence/before/`、`evidence/redesign-final/receipt.json` |
| 新规则下独立新页样本 | 相同创建任务，从空目录完成；首屏输入和全部新页浏览器断言通过，没有第二轮设计纠正 | `.cache/lifecycle-20261113/evidence/new-page-candidate/receipt.json` |

三个案例均无 pageerror，未观察到外部页面请求。页面只做本地演示，无真实 API、账号或业务数据。Chrome 检查时设置 reduced motion；未做屏幕阅读器、200% 缩放和完整 WCAG 对比度审计。计划 ID 的实现/验证状态已回填各案例 `PLAN.md`，没有把单元测试替代真实画面。

## 原生评测与边界

新增 `pnpm eval:design`，支持 design/start 两套既有题目。默认只输出计划；显式执行才安装冻结插件并调用模型。start 套件只显式注入 start，由模型选后续能力；不将 oracle 传给生产者。每次固定输入、suite、资产和脚本哈希；保留原始首轮响应供独立评分，不以关键词或调用结束自动判 pass。

真实试运行发现 Windows 的仓库根拒读 ACL 未继承到部分缓存快照。无内容探针在复制真实认证之前停止了运行。最终改为对两臂源快照、suite、宿主指令和临时认证显式拒读并逐一探测；成功 run 的五项探针全部通过。临时登录仅供原生 Codex 认证，未进入模型输入，结束后已清理。范围内安全审查 finding 已关闭。

原生模型为本机当前配置的 `gpt-6.1-sol` / `high`，CLI 0.167.0。典型新页任务的 baseline 与 candidate 均成功捕获；匿名评分中候选全部满足 oracle，基线仅在“明确已有实现授权”一项为 partial，两者都正确安排了设计、前端实现与浏览器验收。该比较只证明首轮表达与路由，不能证明模型已实现业务页面。

续接、后端负例的两臂，以及只读多页候选在 Windows 新 home 的沙箱初始化阶段超时；尚无有效模型结果，不能计为模型失败或通过。续接候选的同目录预检重试也超时，未继续无依据重复执行。禁止通过放宽拒读条件获得结果。两个成功原生 run 分别为 `.cache/design-study-new-page-implicit-baseline-aDU0jc` 和 `.cache/design-study-new-page-implicit-candidate-RmNkFv`；匿名输入、映射与评分保存在 `.cache/lifecycle-20261113/score-*.json`、`blind-score.json`。

## 审查修复与测试

- 重塑页检查最初只覆盖部分信息；现逐条验证全部种子字段，并检查分派后唯一允许的 owner/status 变化。
- 采集入口原先只记录完整性布尔值；现任一完整性检查失败、capture 未完成或进程清理未确认都会标为 inconclusive 并返回非零状态，负例测试覆盖 false、缺字段与不确定清理。
- 仅预检失败的目录可以显式重试；安全审查发现的子目录链接写入风险已修复：在任何写入前递归检查整个已有目录树，拒绝 junction、symlink、越界、硬链接和特殊文件。真实链接负例已执行，不依赖字符串断言；该功能没有解决本机沙箱初始化超时，不能声称批量评测全部通过。
- Git 评测夹具清理再次出现 EPERM；仅增加重试不足以消除工作区干扰。现将夹具放在 ignored `.cache/review-coverage/run-*`，保持唯一目录及有界清理，避免源目录和 Windows 重定向系统 Temp。默认沙箱的 Git/MSYS 命名对象限制仍存在；完整门禁需在允许该能力的环境执行，不跳过相关断言。
- 最终验证与逐文件身份见 `.cache/lifecycle-20261113/` 中的验证日志、审查回执和 final-manifest；早期失败日志保留，不覆盖成成功。

最后一次 `pnpm verify`（`verify-final-accepted.log` / `verify-final-accepted-status.json`）退出 0：toolkit/平台 111 passed，CLI 285 passed / 1 skipped，评测/目录/分发 43 passed，视觉与新采集入口 23 passed，合计 **462 passed / 1 skipped**。唯一 skip 是原有 Windows symlinked-bin 条件跳过；新增 junction/hardlink 负例均实际通过。代码审查发现的四项问题已关闭；`git diff --check` 和新增文件空白检查由 final-manifest 合流核对。

12 个原生评测目录中有 2 个有效捕获，其余 10 个未进入模型阶段；含一次同目录重试，不能把目录数等同成功样本数。`capture-summary.json` 核对所有临时认证文件均不存在。原生批量回归仍为部分完成，代码门禁与页面/安装验收通过不能替代它。

## 打包与安装

实际生成本地 tarball，连同工作区已安装的七个运行依赖打包后离线 npm 安装；没有从网络临时升级依赖。隔离 CLI 的 toolkit lint 为 82 资产、0 errors / 0 warnings。其生成的 104 个技能/附件文件与源码生成结果逐字节相同，回执为 `pack/installed-content-check.json`。

使用官方 plugin marketplace/add 将该包生成的 marketplace 安装到无凭据临时 home；新 app-server 只调用 initialize 和 skills/list，发现并启用 start、visual-refinement、frontend-ui-engineering、spec、plan、incremental、sdd 和 browser QA 八个关键技能。进程正常退出已确认，回执为 `discovery-receipt.json`。此检查不调用模型，不等于日常宿主插件已升级。

tarball 保留当前清单版本 0.12.0，仅用于本地验包，不是新的 npm 发布。正式版本由已有 minor changeset 管理；没有覆盖 registry 上的同名版本，也没有修改本地/开发服务器的日常安装。
