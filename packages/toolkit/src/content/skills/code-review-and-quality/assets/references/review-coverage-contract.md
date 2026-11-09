# 审查覆盖契约

在需要可复核结论、跨任务 fan-in 或范围较大的 review 时读取。本文件定义审查输入和输出的最小可核验记录；它不证明审查质量，也不替代测试、构建、真实流程验证或专项审查。

## 固定输入与文件清单

先记录不可歧义的 `diff identity`：提交审查写 `base`、`head` 与完整 range；工作树审查写 `HEAD`、暂存/未暂存状态、生成时间、完整补丁的 SHA-256 和 changed-file manifest。manifest 为每个 changed file 记录内容 SHA-256，包括 untracked 与二进制文件（对原始字节哈希）；不能只用 `HEAD`、状态或时间代替内容冻结。随后从该 identity 枚举完整 `changed files`，再标出 reviewable、排除和失败文件。改变 identity 后必须重新枚举，不能把旧清单混入新结论。

清单中的审查对象同时记录路径、Git 变更状态和来源层（暂存、工作树或 untracked）；不要按路径单独去重。同一路径被暂存删除后又创建为 untracked 时，是两个需要分别解释的对象。改名保留原路径和目标路径，二进制变化保留原始字节哈希及实际检查方式。

获取用于审查和哈希的 Git 文本补丁时禁用 external diff 与 textconv（`--no-ext-diff --no-textconv`），避免外部程序改变证据或在采集时执行。保留命令退出状态并核对输出是否完整；工具提示截断、读取失败或路径清单不全时，标记缺口并按文件/区段补读，不能记录为完整审阅。

Git 的 `change_status` 与审阅回执的 `review_status` 分别记录，不要相互覆盖。

```text
Review coverage:
- diff identity:
- patch SHA-256 (working tree):
- manifest source / generated at:
- changed files:
  - path:
    change_status: <Git status, including rename endpoints>
    source_layer: staged | worktree | untracked
    content SHA-256:
    review_status: reviewed | skipped | failed
    reason: <required for skipped / failed>
    reviewer or owner:
    evidence:
- unreviewed scope:
- accounting: changed / accounted / reviewable / selected / reviewed:
- coverage verdict: complete | blocked
```

`accounted` 是已有 `reviewed`、`skipped(reason)` 或 `failed` 回执的 changed files；它不等于已审。`reviewable` 是按本轮范围可审的文件，`selected` 是实际进入本轮审查的 reviewable 文件，`reviewed` 只表示已按本轮维度读过对应 diff 和必要上下文。`skipped` 必须有具体原因（如 generated、二进制、超出授权或等待专项审查）；`failed` 记录无法读取、解析、定位或执行所需检查的原因。

任何未知状态、未列出的 changed file、`failed` 或没有处置决定的 `skipped` 都是 `blocked`，不得输出 Approve。非空变更而 `selected=0` 同样是 `blocked`，不得把“全部排除”称为审查完成。被排除文件需要单独的 owner、后续检查或明确的范围接受决定；不能以“零 finding”掩盖未审范围。

审查结束前重新计算补丁和 manifest 哈希。身份未漂移才可复用回执；漂移时只重新枚举并重审内容哈希已变化、新增、删除或受其接口影响的范围，同时更新 accounting 和 residual risk。无法界定影响范围时阻断结论并扩展到保守范围。

## Finding 证伪与位置

每条 finding 先尝试推翻：检查触发前提、实际调用路径、已有 guard、错误处理、测试或配置约束、反例和重复报告。只有仍能用当前 diff 或必要上下文支持时才输出；证据不足时保留为待验证假设，不能按严重度阻断。

```text
Finding:
- severity: Critical | Important | Suggestion
- location: path:line (或明确的不可定位原因)
- trigger:
- impact:
- code evidence:
- disproof checks: counterexample / guard / caller constraint / duplicate search
- expected fix:
- regression check:
- confidence or open assumption:
```

位置必须能回到固定 diff identity。无法定位不自动使问题无效，但必须说明位置限制并交由 controller 决定是否阻断；不可把猜测性行号伪装成已验证锚点。

## 结论门禁

`Approve` 需要 coverage verdict 为 `complete`、没有未处置 Critical 或 Important、必要验证证据可信且剩余风险已写明。`Request changes` 和 `Defer` 同样附带 coverage receipt；前者写清阻断 finding，后者写清未审范围、owner、恢复条件和为什么当前不能合并。Important 只能按正文既有的明确延后理由处理，不能因有 coverage receipt 而任意放行。文本回执本身只证明记录存在，不等于代码、测试或运行时行为已经验证。

## 方法来源与改写

同路径变更身份与原始补丁采集方法参考 [Alibaba Open Code Review delegation skill](https://github.com/alibaba/open-code-review/blob/0d403392073bcb0d3894c5364b0a85e7b6a47e0d/plugins/open-code-review/skills/open-code-review-delegate/SKILL.md)（Apache-2.0）。本项目用中文重写，保留本地 diff identity、内容哈希、review_status 与阻断规则；不依赖或调用 OCR CLI。适用许可证随产物提供于 [LICENSE-open-code-review.txt](LICENSE-open-code-review.txt)。
