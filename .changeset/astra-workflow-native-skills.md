---
"@zmice/zc": minor
---

优化 GPT-6 Astra 工作流：在已授权范围内连续执行，按任务价值派发 agent，并使用与风险相称的验证。

Codex 插件统一使用原生 skills，停止重复分发 commands 入口。旧 slash / source-command-* 调用请迁移到 `$zc-toolkit:<名称>`；原命令内容仍保留在对应 skill 中。

补充真实 skill 加载、隔离预检和原生子代理事件的评估要求，避免将自报结果作为验证证据。
