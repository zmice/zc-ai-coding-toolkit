---
name: perf
description: 分析代码性能瓶颈并提供优化方案，从测量开始，用数据驱动优化决策。
---

调用 performance-optimization 技能。先测量，再优化，用数据说话。

1. **测量** — 先 profiling，不凭直觉优化
2. **识别瓶颈** — 找到真正的热点代码
3. **方案设计** — 提出优化方案及其 trade-off
4. **实施验证** — 实施后用 benchmark 验证效果

## 使用方式

在 `/perf` 后描述性能问题或指定要优化的代码，我将分析并提出方案。

### 示例

```
# 接口性能问题
/perf 订单列表接口响应时间超过 3s，数据量 50w+

# 前端性能
/perf 首页加载时间太长，LCP 超过 4s，需要优化 Core Web Vitals

# 代码分析
/perf 分析 src/services/ReportService.java 的性能瓶颈，处理大批量数据时内存飙升
```
