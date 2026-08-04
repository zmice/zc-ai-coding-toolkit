---
'@zmice/zc': patch
---

修复 Codex marketplace 与 Qwen extension 发布同步可能保留同尺寸旧清单的问题，改用 checksum 校验确保远端 bundle 原子一致
