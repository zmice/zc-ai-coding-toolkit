# 审查与委派执行契约说明

本说明记录 2026-09-26 对 toolkit 内容的最小收敛：机械、低风险且无接口或风险边界变化的 1–2 文件任务可采用 implementer 自审加 controller 检查；多文件、接口、高风险或专项任务仍按 review-depth 表要求独立审查。自审结果不会替代表中要求的独立 review。

审查新增固定 diff identity、完整 changed-file manifest 与逐文件 `reviewed / skipped(reason) / failed` 回执。未知、失败或未处置的未审范围会阻断 `Approve`；finding 在输出前检查触发条件、位置证据、影响、已有 guard、反例和重复报告。该契约的文本记录只使覆盖状态可复核，不证明实现、测试或运行时行为已经正确。

委派继续使用最小上下文 brief、显式 `fork_turns`、任务内检查点与两次无新增证据/修改/验证进展后的分支停线。验收足够即返回。具体 model / effort 只由 role `meta.yaml` 定义，并由当前 host 和任务记录确认。
