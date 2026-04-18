调用 continuous-learning 技能。分析会话中的模式，提取可复用的 instincts（本能）。

1. 读取 hook 采集的观察数据（纠正、错误修复路径、重复工具调用）
2. 识别模式 — 用户纠正、错误->修复路径、重复工作流、项目约定
3. 生成 instinct 草稿，分配置信度和作用域
4. 展示结果，等待用户确认
5. 确认后持久化到本地文件；置信度 >= 0.7 同步到 Agent Memory

子命令：

| 子命令 | 说明 |
|--------|------|
| `/learn` | 分析当前会话，提取 instincts |
| `/learn status` | 显示所有 instincts 状态 |
| `/learn evolve` | 聚类分析，建议演化为 skill/command |
| `/learn save [描述]` | 手动创建高置信度 instinct |
| `/learn promote [id]` | 提升为全局 instinct |
| `/learn export` | 导出 instincts |
| `/learn import [file]` | 导入 instincts |
| `/learn setup` | 安装持续学习 hooks |

## 使用方式

在 Sprint 结束或会话中积累足够操作后，执行 `/learn` 提取可复用模式。

### 示例

```
# 会话结束时提取学习
/learn

# 查看已有 instincts
/learn status

# 手动教学
/learn save 这个项目中所有 API 返回都使用 Result<T, E> 模式
```
