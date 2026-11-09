# Visual Refinement 首轮行为微测（2026-11-09）

这是隔离 Codex 中的只读首轮契约微测：检查证据、提出方案、声明边界。它不是产品视觉改善实证、完整 UI A/B、隐式技能触发测试或实现任务验收。每个场景每臂计划 1 次，视觉重塑 candidate 的预算中断另保留 1 次有界修复重跑；不以缺少最终答复判内容通过。

## 方法与隔离

- 独立测试代理先冻结 [behavior-cases.json](../../tests/visual-refinement/behavior-cases.json)，两臂读取完全相同的 `input`。oracle 不进入被测输入；首轮 scope 明确只读，零代码 diff 是预期结果。
- baseline 显式输入 `frontend-ui-engineering`、`ui-ux-review`；candidate 显式输入同两项及 `visual-refinement`。公共技能正文和附件来自固定 Git HEAD `46defebca23c94fb8ef98fffcd06d3499243e9e8`，避免工作树新增路由污染基线。公共技能的安装字节在两臂相同。
- 宿主另提供相同的 `imagegen`、`openai-docs`、`review-agent`、`skill-creator`、`skill-installer` 系统技能；baseline 的 discovery 中不存在 `visual-refinement`，candidate 存在。fixture README 已声明无浏览器访问，并提示筛选缺少重绘，因此功能负例衡量范围约束与回归计划，不衡量独立发现根因的能力。
- 通过真实 `plugin marketplace add`、`plugin add` 安装到临时 `CODEX_HOME`；逐文件验证 cache 与生成内容 SHA-256。baseline 校验 12 个技能文件，candidate 校验 20 个。
- 使用 Windows `codex-cli 0.167.0`、`gpt-6-astra/high` 和现有 [capture adapter](../../scripts/lib/codex-eval-capture.mjs)。默认预算为 240 秒、20 次工具调用、160000 observed cumulative tokens；该 token 计数包含多轮输入和缓存输入，不等于输出 token 或单次 context 大小。
- 沙箱中仓库、日常 `.codex`、用户 `.agents` 禁读；fixture 与插件 cache 只读、独立 scratch 可写、临时 `auth.json` 精确禁读。网络、web、apps、remote plugin 和 discovery prefetch 关闭。
- 复制凭据前先用无秘密占位文件检查 ACL 与拒读：只打开/关闭流，不打印受限内容。临时凭据沿用已验证 ACL，并在 `finally` 删除。日常 `config.toml` 与 `auth.json` 前后比较哈希。
- 首次默认沙箱嵌套预检在 120 秒超时，未复制真实凭据，记录在 `.cache/visual-study-visual-major-redesign-baseline-pCrEFj/preflight.json`。随后已获授权的评测以升级权限执行外层编排，内部隔离约束不变。用户要求停止许可弹窗后未再发起新权限请求。
- 仅保留工具完成项与模型文本供审计，删除可能含账户元数据的原始 `host-events.jsonl`；`final.md` 只取 `phase=final_answer`，无 final 时明确记录缺失。

## 冻结标识

| 对象 | SHA-256 |
| --- | --- |
| 独立 suite（含输入、scope、oracle） | `c8086c2fe48199f6f1bbaf88de379fc917bcfbfc2136644fea4377038dd099b2` |
| 共同 fixture | `64638bb1db2d5715ff8bfe776c74b7e37adc0043d85abae868ca190bf3e5b0fd` |
| capture adapter | `1a669dfa112f4b27a1481b26c282ef79f7ac9d2e92abdfc44af99359c5fe037b` |
| baseline 内容 | `724d5c70ec9ba116652f3df726e84545fb881fe2b876b4ffe6d05fc1da3425ba` |
| 首次 major candidate 内容（A） | `c43ba7c963f6e006b6cd379079d5db4d096b2ca12c3c5ba6861340fa81252a2a` |
| 后续 candidate 内容（B） | `d19a5ae48c5ee3d5e27506c7d64cfd187cb6b5ead8874813e1e883d7f2ca4fa1` |

A/B 内容指评测期间的候选内容版本，并非产品界面 A/B。二者仅 `visual-refinement/references/evidence-and-tools.md`、`scripts/runtime.mjs`、`scripts/snapshot.mjs` 的安装字节不同；skill 正文与 `workflow-and-passes.md` 相同。首次未决记录使用 A，后续组使用 B，因此不能声称所有执行均为完全相同的候选内容 revision。每次 `frozen.json` 保留全部 cacheHashes、oracleHash、inputHash、版本和预算。

## 运行证据

以下路径均相对仓库根目录；各目录包含 `preflight.json`、`frozen.json`、`receipt.json`、`evidence/capture.json`、`evidence/turn-evidence.json` 与 `evidence/final.md`。`.cache` 是本次本地证据，不作为可跨机器永久访问的发布产物。

| 场景/臂 | 运行目录 `.cache/` 下 | capture | 工具数 | observed total tokens |
| --- | --- | --- | ---: | ---: |
| major baseline | `visual-study-visual-major-redesign-baseline-0yPWTe` | complete | 8 | 128372 |
| major candidate 首次 A | `visual-study-visual-major-redesign-candidate-osqnaw` | inconclusive / maxTokens，无 final | 2 | 169977 |
| URL baseline | `visual-study-url-without-render-evidence-baseline-4oY1Yp` | complete | 4 | 61809 |
| URL candidate B | `visual-study-url-without-render-evidence-candidate-LlAvYn` | complete | 7 | 66507 |
| functional baseline | `visual-study-functional-fix-neighbor-negative-baseline-s5vLQ2` | complete | 4 | 79068 |
| functional candidate B | `visual-study-functional-fix-neighbor-negative-candidate-xZ9lBE` | complete | 6 | 108716 |
| major candidate B 有界预算修复 | `visual-study-visual-major-redesign-candidate-g5lz7E` | complete | 5 | 92519 |

预算修复保持相同模型、输入、oracle、fixture、240 秒和 20 工具上限，单独允许 320000 token，原未决记录保留；候选内容采用 B。这改变了预算和内容 revision，不能据此比较性能、成本或给出统计显著性结论。

7 次模型调用均已核验 fixture 原文件哈希、oracle、日常配置和凭据源不变；结束后 fixture 仍恰好为原 5 个文件，没有新文件。7 份 capture 均确认进程树清理完成，临时 `auth.json` 和原始 `host-events.jsonl` 已删除。默认权限预检失败的占位 `auth.json` 同样已删除。

## Oracle 结果与边界

由独立只读 reviewer 根据冻结 oracle、`final.md` 和 `turn-evidence.json` 评分；`pass` 只表示该首轮条目满足，`partial` 保留缺口，不等于完整原任务通过。

| 场景 | baseline | candidate B | 对应证据与缺口 |
| --- | --- | --- | --- |
| 大幅视觉重塑 | partial：mustDo 1、3 pass，2 partial；mustNot 3/3 pass | pass：mustDo 3/3、mustNot 3/3 | 两臂都读取页面、共享组件和 token，覆盖整屏候选方向并区分源码与渲染。baseline 未说明 motion 的适用性；candidate 明确“当前流程没有必须通过动画表达的变化”，暂跳过并要求未来支持 reduced motion。 |
| URL 无渲染证据 | partial：mustDo 1、3 pass，2 partial；mustNot 3/3 pass | partial：mustDo 1、3 pass，2 partial；mustNot 3/3 pass | baseline 的 `Invoke-WebRequest` 与 candidate 的 `curl.exe` 都真实失败，均读取本地源码、未虚构参考画面。两臂最终答复均未明确请求可用截图或可访问参考，按 oracle 的材料补充要求保留 partial。 |
| 功能修复邻近负例 | pass：mustDo 2/2、mustNot 2/2 | pass：mustDo 2/2、mustNot 2/2 | 两臂都计划在更新 `selected` 后补 `render()`，保留样式并断言实际表格结果；candidate 额外断言“选启用但尚未点击，仍显示两行”。均未要求视觉重塑或 story。 |

首次 major candidate A 的 maxTokens/no-final 为 **inconclusive，不评分**。不能将其最后一条 commentary 当最终答复，或将未观察到违规当 pass。

可支持的增量仅限一次微测：major candidate 更明确记录 `insufficient`、九轮 owner 和跳过理由，补齐动效适用性；URL candidate 的表达更结构化，但两臂同有材料请求缺口；functional candidate 多一条提交前状态断言，而 baseline 已满足该 oracle。没有证据表明候选在真实 UI 质量、端到端交付、成本或稳定性上整体更好。

评分后对最终 skill 正文做一处**静态补强**：在 Quick path 输入段增加“确实需要忠实匹配参考、现有工具又无法取得画面时，指出所需截图或可访问方式；不依赖参考的已授权工作继续。”该句不在本次被测 B 的安装字节中；最终版正文与实验 B 存在这处后测差异。没有为此新增模型调用或提权，最终版行为未重复验证，URL 结果仍保留 partial，不能宣称缺口已经由模型实证修复；技能保持实验性状态。

已观察到的候选行为：URL 缺乏证据时明确标注 `insufficient`，将九轮作为待验证方案，并区分页面源码与浏览器画面；功能负例在显式注入视觉技能后仍提出仅补 `render()` 的最小修复和真实表格点击断言，没有把视觉重塑或 story 作为完成条件。它们证明首轮回答的契约表现，不能证明后续真的实现、截图对照通过或视觉质量提高。

未验证：真实页面的布局/美感改善、浏览器渲染、可访问性实际结果、真实后端与权限状态、动效与 reduced motion、完整实现与回归、隐式触发准确率、其他模型/宿主或多次重复稳定性。source-only 观察不代替渲染证据，网络失败不代表参考页面不存在。

## 复现入口

```powershell
node scripts/skill-evals-visual-study.mjs <case-id> <baseline|candidate> <absolute-codex.exe> --execute
```

入口是显式 opt-in 真实调用，不纳入普通单元测试。每次创建独立临时目录；不得把隔离预检失败改为忽略，或把凭据/日常 home 加入任务可读范围。

实际静态验证：`node --check scripts/skill-evals-visual-study.mjs` exit 0；定向 `git diff --check` exit 0。对两个尚未跟踪的新增文件另运行 `git -c core.autocrlf=false diff --no-index --check -- NUL <path>`，均无空白错误诊断（no-index 因新增文件差异返回 1）。7 次实测的安全回执与最终目录状态另经断言复核通过。
