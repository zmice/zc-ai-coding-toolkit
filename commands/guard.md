---
name: guard
description: 同时激活 Careful + Freeze 的组合防护，适用于操作生产环境，提供最高级别的安全保护。
---

调用 safety-guardrails 技能。组合激活危险命令预警 + 文件锁定，最高级别防护。

1. 自动启用 Careful 模式 — 所有危险命令执行前触发确认
2. 自动启用 Freeze — 锁定指定路径（如未指定则锁定默认敏感路径）
3. 环境变量修改标记为高风险，数据库操作强制二次确认
4. 使用 `/unguard` 解除所有防护

默认锁定路径：`*.env*`、`**/migrations/**`、`**/config/production*`、`docker-compose.prod*`

## 使用方式

`/guard [路径...]` — 激活组合防护，可选指定锁定范围。

### 示例

```
# 使用默认锁定范围
/guard

# 指定锁定范围
/guard src/core/** *.env

# 解除防护
/unguard
```
