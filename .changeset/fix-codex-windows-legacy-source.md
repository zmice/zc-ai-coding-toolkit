---
"@zmice/zc": patch
---

修复 Windows 上旧版 Codex 直装插件迁移顺序：先复制可恢复备份并保持旧 source 可读，完成官方卸载后再移除残留目录和从 Git marketplace 重新安装
