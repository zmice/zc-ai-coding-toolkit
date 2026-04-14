---
name: freeze
description: 锁定指定目录或文件，禁止 AI 编辑，保护关键文件不被意外修改。
---

调用 safety-guardrails 技能。锁定指定路径，只读保护。

1. 解析用户指定的路径和 glob 模式（支持多个路径）
2. 确认锁定范围和受影响文件数
3. 对锁定文件拒绝编辑操作，只读操作不受影响
4. 使用 `/unfreeze` 或 `/unfreeze <路径>` 解除锁定

## 使用方式

`/freeze <路径...>` — 指定要锁定的路径或 glob 模式。

### 示例

```
# 锁定关键目录和文件
/freeze src/core/** *.env migrations/

# 锁定配置文件
/freeze docker-compose.prod* config/production*

# 解除锁定
/unfreeze
```
