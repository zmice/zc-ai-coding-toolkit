# 风险所有权映射

规划时用它把描述中隐含、却可能改变交付结论的风险落到可执行责任。它不代替风险评估、真实验证或用户授权。

```text
Risk ownership map:
- risk:
  evidence / trigger:
  affected task or boundary:
  owner:
  mitigation or decision:
  verification:
  stop gate if unresolved:
```

至少检查兼容性、数据与迁移、权限与安全、并发与失败恢复、依赖与配置、回滚、可观测性和验收缺口。`owner` 可以是实现任务、reviewer、controller 或用户决策，但不能是未命名的“后续处理”。`verification` 必须是可运行命令、可观察场景或可复核证据；无法给出时应进入 stop gate，不能借风险表继续推进。
