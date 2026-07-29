# 可观测性检查清单

用于生产功能埋点、审查和发布前验证。先写值班问题，再选择信号。

## 值班问题

- [ ] 写明 2–4 个值班人员会问的问题
- [ ] 每个日志、指标、span 和告警都能回答其中一个问题
- [ ] 指标说明是否异常，追踪说明异常位置，日志说明异常原因

## 结构化日志

- [ ] 日志使用稳定事件名和结构化字段，不依赖自由文本拼接
- [ ] 每条日志带 correlation/request ID
- [ ] ID 能跨 HTTP、RPC、队列和异步边界传播
- [ ] 日志级别含义一致
- [ ] 字段使用 allowlist，不记录完整请求体或认证头
- [ ] 不记录 token、密码、密钥或未脱敏 PII
- [ ] 已检查实际输出，不存在 `[object Object]` 等不可查询内容

## 指标

- [ ] 每个新增接口和外部依赖具备 RED：Rate、Errors、Duration
- [ ] 队列、连接池、主机等资源具备必要的 USE：Utilization、Saturation、Errors
- [ ] 延迟使用 histogram，可查询 p50/p95/p99
- [ ] 标签来自固定小集合，例如 route template、status class、provider
- [ ] 标签不包含 user ID、tenant ID、email、request ID、原始 URL 或错误文本
- [ ] 队列同时监控 depth、age 和处理耗时

## 分布式追踪

- [ ] OpenTelemetry 或等价 SDK 在业务模块之前初始化
- [ ] HTTP、RPC、数据库等常见调用已启用自动埋点
- [ ] 入站提取并出站传播 trace context
- [ ] 队列消息携带 trace metadata，异步链路不断裂
- [ ] 手工 span 只覆盖有业务意义的工作单元
- [ ] span 属性不包含秘密或未脱敏 PII
- [ ] 采样策略与流量匹配，错误请求尽可能完整保留

## 告警与 Dashboard

- [ ] page 告警基于 error rate、p99 latency、queue age 等用户症状
- [ ] CPU、磁盘、pod 重启等原因信号默认进入 Dashboard
- [ ] 每条告警都可行动，且有阈值和持续时间依据
- [ ] 每条告警链接 runbook：含义、第一条查询、升级路径
- [ ] 告警严重度保持简洁，例如 page 和 ticket
- [ ] Dashboard 能直接回答最初的值班问题

## 验证遥测

- [ ] 制造一次失败，并通过 correlation ID 找到对应日志
- [ ] 发送测试流量，确认指标 series、标签和值符合预期
- [ ] 跟随一次端到端请求，确认 span 没有断链
- [ ] 临时调整阈值，确认新告警到达正确渠道且 runbook 可访问
- [ ] 仅依赖遥测解释一次诱发故障，没有先阅读源码

## 发布前门禁

- [ ] 结构化日志已进入聚合系统
- [ ] 新接口和依赖的 RED 指标已进入 Dashboard
- [ ] 至少一条关键症状告警已配置并测试触发
- [ ] 关键请求可以跨所有服务追踪
- [ ] 值班人员知道 Dashboard 和 runbook 的位置
