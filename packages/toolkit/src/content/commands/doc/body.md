调用 documentation-and-adrs 技能。记录决策和知识，不只是代码。

1. 确定文档类型 — ADR / API 文档 / README / 代码注释
2. 收集上下文 — 背景、决策过程、备选方案、影响
3. 按标准模板生成文档
4. 强调 **why**（为什么这样决策），而不只是 what

## 使用方式

在 `/doc` 后说明你需要哪种文档，我将按规范生成。

### 示例

```
# 记录架构决策
/doc 记录我们选择 Redis 而非 Memcached 做缓存的决策（ADR）

# 生成 API 文档
/doc 为 src/controllers/OrderController.java 生成接口文档

# 项目概览
/doc 生成项目的技术架构概览文档
```
