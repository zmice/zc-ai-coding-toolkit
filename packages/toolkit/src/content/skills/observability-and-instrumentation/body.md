# Observability and Instrumentation

## 角色定位

可观测性不是上线后的补丁，而是生产功能的一部分。这个 skill 用于先定义值班人员需要回答的问题，再选择日志、指标、追踪和告警，并通过真实故障路径验证遥测是否可信。

它不替代：

- 正在发生的故障定位：使用 `debugging-and-error-recovery` skill
- 已有性能瓶颈的测量和优化：使用 `performance-optimization` skill
- 发布窗口、灰度和回滚编排：使用 `shipping-and-launch` skill

## 何时使用

- 新增服务、接口、后台任务、队列消费者或外部系统集成
- 新增重试、降级、缓存、异步处理或跨服务调用
- 生产事故中出现“无法知道发生了什么”
- 新建或审查日志、指标、追踪、Dashboard、SLO 或告警规则
- 交付需要证明生产行为可见且可诊断的功能

不适用：尚无性能证据却准备提前优化，或只需临时打印本地调试信息。

## 核心流程

### 1. 先写值班问题

在添加埋点前，先写 2–4 个值班人员会问的问题：

```text
功能：支付重试
值班问题：
1. 首次成功、重试成功和永久失败分别占多少？
2. 永久失败来自超时、供应商拒绝还是参数校验？
3. 外部支付服务是否比平时更慢？
```

每个新增信号都必须回答其中一个问题。无法映射的问题和信号先不采集。

### 2. 为问题选择信号

| 信号 | 主要回答 | 示例 |
|---|---|---|
| 结构化日志 | 这一笔为什么失败 | `payment_failed` + error code |
| 指标 | 整体是否异常、影响多大 | error rate、p95/p99 latency |
| 追踪 | 时间花在哪个服务或调用 | 一次请求的跨服务 span |

记忆口径：指标说明“发生了异常”，追踪说明“异常在哪里”，日志说明“为什么异常”。

### 3. 设计结构化日志

- 使用稳定事件名和机器可查询字段，不拼接自由文本
- 在入口生成或接收 correlation/request ID，并向日志、span、HTTP、消息队列继续传播
- `error` 表示需要调查的不变量破坏；`warn` 表示已处理的降级；`info` 表示重要业务事件；`debug` 默认不进入生产
- 字段使用 allowlist，不记录完整请求体、认证头、token、密码或未脱敏 PII
- 外部调用记录目标、状态、耗时、尝试次数和脱敏后的业务标识

### 4. 设计指标

请求和外部依赖使用 RED：

- Rate：请求或任务处理速率
- Errors：失败率和失败类型
- Duration：延迟直方图以及 p50/p95/p99

资源使用 USE：

- Utilization：使用率
- Saturation：排队、池耗尽或积压程度
- Errors：资源错误

标签必须来自小而稳定的集合，例如 route template、status class、provider。禁止把 user ID、tenant ID、email、request ID、原始 URL 或错误文本作为指标标签。

### 5. 保持追踪连续

- 优先使用 OpenTelemetry 等供应商中立标准
- SDK 初始化发生在业务模块加载之前
- HTTP、RPC、数据库等常见边界优先使用自动埋点
- 只为有业务含义的内部单元添加手工 span
- 在 HTTP header、队列 metadata 和异步边界持续传播 trace context
- 默认采样，错误请求尽可能完整保留；span 属性同样不得包含秘密或未脱敏 PII

### 6. 设计症状告警

告警优先覆盖用户能感受到的症状：

- error rate 持续超过 SLO
- p99 latency 持续超过目标
- queue age 或任务积压超过业务时限

CPU、磁盘、pod 重启等原因信号默认进入 Dashboard，除非它们本身就是明确的用户影响。每条告警必须可行动、有阈值和持续时间依据，并链接最小 runbook：含义、第一条查询、升级路径。

### 7. 验证遥测本身

完成前必须主动触发信号：

1. 在测试或预发布环境制造一次失败
2. 用 correlation ID 找到结构化日志
3. 确认指标 series 和标签符合设计且数值合理
4. 跟随一次跨服务请求，确认 span 没有断链
5. 临时调整阈值触发新告警，确认通知和 runbook 可达
6. 尝试只依赖遥测解释故障，不先阅读源码

## 输出契约

```text
Observability plan:
- Feature:
- On-call questions:
- Logs:
- Metrics:
- Traces:
- Alerts:
- Sensitive-data boundary:
- Verification:
- Remaining blind spots:
```

## 危险信号

- 有外部调用、重试或队列，却没有任何新增遥测
- 日志依赖字符串拼接，无法按字段查询
- request ID 没有跨服务或跨消息传播
- 指标标签包含用户、租户、URL 或错误文本
- 只看平均延迟，没有直方图和高分位数
- 原因告警每天触发但无人采取行动
- 未制造故障就声明埋点和告警有效

## 完成门禁

- 值班问题已写明，每个信号都能回答一个问题
- 日志结构化且全链路带 correlation ID
- 新接口和依赖具备 RED 指标，资源具备必要的 USE 指标
- 指标标签集合有界，日志和 span 不泄露秘密或 PII
- 关键跨服务请求可以端到端追踪
- 告警基于症状、可行动、有 runbook，并至少测试触发一次
- 已通过一次诱发故障验证实际遥测输出

需要逐项执行时读取 `references/observability-checklist.md`。
