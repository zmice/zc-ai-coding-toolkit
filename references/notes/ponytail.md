# Ponytail

Source: `https://github.com/dietrichgebert/ponytail`

## Status

面向 AI coding agent 的反过度工程规则与评测项目。当前登记为 `evaluating`，用于研究最小实现决策、过度工程审查信号和真实 agentic benchmark；它不是 toolkit 的运行时依赖，也不作为新的全局 persona 或模式系统。

## Latest Remote Evidence

- remote head: `2ed6c52c9d7e5e56942508591085fd45dea277d3`
- observed date: 2026-09-01
- evidence: manual review of the core skill, review/audit/debt skills, lifecycle hooks, portability matrix, package surface, agentic benchmark method and published limitations
- project surface: compact behavior rules plus mode persistence, lifecycle hooks, multi-host adapters and benchmark harness

## Extractable Upgrades

- 在理解真实流程后，按“需求是否必须存在 -> 仓库已有能力 -> 标准库或平台原生能力 -> 已安装依赖 -> 最小自定义实现”的顺序控制复杂度升级
- 将复用缺失、重复标准库或原生能力、无当前消费者的抽象和只服务少量逻辑的新依赖作为反过度工程信号
- 有意识的简化必须说明能力上限、升级触发条件和升级方向，但不强制在业务代码中使用品牌化注释
- skill eval 使用固定提交、隔离 baseline、真实 agent 修改和可离线重算的 workspace，同时把 correctness、safety、completeness 与 source size 分开衡量
- 对低风险、局部、可逆任务不强制完整设计、多方案展示和逐段确认；只有真实 trade-off 或风险会改变路线时才升级流程

## License Boundary

- repository license: MIT
- 当前只提炼方法和治理规则，不复制上游品牌文案、角色设定、状态机实现或 benchmark 结果作为本项目宣传结论
- 若未来复制或实质改写上游正文、脚本或测试夹具，需保留对应 MIT notice 并重新核对具体文件来源

## Non-Adoption Boundary

- 不新增 `ponytail`、`ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain` 或 `ponytail-help` 资产
- 不引入 `lite/full/ultra/off`、状态文件、statusline、Session/Prompt/Subagent hooks、MCP 或手工维护的平台 adapter 副本
- 不把“一行优先”“文件越少越好”或净减少 LOC 设为质量目标；简化仍以行为正确、理解成本和可验证性为准
- 不用最小测试数量替代与风险相称的测试、真实运行和安全验证
- 不把上游单模型、有限任务和小样本 benchmark 的 `100% safe` 外推为普遍安全结论

## Representative Evaluation Cases

1. 明确的单文件配置修改：直接采用现有模式，不强制设计会话、2-3 个方案或等待确认。
2. 日期输入需求：项目浏览器基线和交互要求允许时优先原生控件；不满足时再升级到已有组件或依赖。
3. 单实现 factory：没有真实边界契约时建议内联；明确隔离外部系统时保留。
4. 多处重复分支：先尝试删除、复用或局部数据映射；只有稳定的跨调用决策模式才引入 dispatcher 或领域模型。
5. 路径、权限和数据写入：即使代码更短，也不能删除信任边界验证、数据保护和回归证据。
6. Skill benchmark：baseline 必须隔离全局插件；低 LOC 必须同时通过正确性、安全性和完整性门禁。

## Current Decision

- 保持 `evaluating`
- 只将最小实现阶梯合入现有 `engineering-principles`
- 在现有 simplification/review 资产中补充反过度工程信号，不新增专项命令
- 收紧 `brainstorming-and-design` 的触发条件，避免小型明确任务被强制升级为完整设计流程
- benchmark 方法作为后续 eval 改进候选，本轮不搭建新的评测基础设施
