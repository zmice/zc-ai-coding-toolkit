# Performance Optimization

## 角色定位

性能优化必须从测量开始。这个 skill 用于定位真实瓶颈、做最小修复、再次测量，并补回归保护；不用于凭感觉提前复杂化实现。

## 何时使用

- 规格里有明确性能目标或预算。
- 用户、监控或日志报告慢。
- Core Web Vitals、接口延迟、吞吐、内存或 CPU 有异常。
- 怀疑一次变更造成性能回归。
- 功能会处理大数据量、高并发或关键首屏路径。

不适用：没有性能证据，只是担心未来可能慢。

## 快速路径

1. 写清性能症状和目标指标。
2. 建立 baseline：真实数据或可复现 synthetic 测量。
3. 定位瓶颈：前端、后端、数据库、网络、渲染、内存或外部依赖。
4. 只修当前证据指向的瓶颈。
5. 再次测量，确认指标改善。
6. 评估复杂度代价，避免为了小收益引入长期维护成本。
7. 加 guard：监控、benchmark、预算或回归测试。

## 指标选择

| 场景 | 优先指标 |
|---|---|
| 首屏慢 | LCP、TTFB、bundle size、network waterfall |
| 交互卡顿 | INP、long task、render count、main thread profile |
| 布局跳动 | CLS、图片尺寸、字体加载、late content |
| API 慢 | p95/p99 latency、query time、cache hit、payload size |
| 资源异常 | CPU、memory、GC、connection pool、queue depth |

默认使用能复现症状的最小指标。不要同时优化所有指标。

## 常见定位方向

- 前端首屏：大图片、render-blocking CSS/JS、bundle 过大、慢 TTFB。
- 前端交互：长任务、重复渲染、过大 DOM、同步计算。
- 数据加载：瀑布请求、N+1、过大 payload、缺少分页。
- 后端接口：缺索引、锁等待、连接池耗尽、重复计算。
- 内存/CPU：无界缓存、泄漏、正则回溯、同步重计算。

## 数据库与连接池决策门

- 慢查询先在相同参数和数据条件下保存 before query plan；检查扫描方式是否合理、估算行数与实际行数偏差、额外排序，以及索引是否匹配 filter + sort 的 query shape。
- 新索引必须重跑 after plan。执行计划或用户指标没有改善时回退，并记录写放大与存储成本。
- 多个接口同时变慢且时间花在等待连接时，先查 long transaction、未释放连接和 active / idle / wait；不要默认扩大 pool。
- 每个进程只维护一个 pool，并证明 `instances × pool max` 不超过数据库连接上限；只有 autoscaling / serverless 证据成立时才考虑 multiplexing proxy。

## 缓存正确性决策门

- 只有已测量为昂贵且读显著多于写时才引入缓存；否则选择 `defer / monitor`。
- 明确一个缓存层、一个失效策略和可接受的 staleness window。
- key 覆盖 tenant、viewer、locale、permissions、feature flags 等所有结果变体；旧值会造成越权、错账或错误库存的数据默认不缓存。
- hot key 评估 request coalescing、stale-while-revalidate 或 lock；negative cache 使用更短 TTL，origin error 不得当成 not-found 缓存。

## 修复纪律

- 先证明瓶颈，再改代码。
- 一次只优化一个瓶颈。
- 保留 before / after 数字。
- 使用同一命令、条件和预算重测；改善没有超过 run-to-run variance 时视为无收益。
- correctness 先于性能；测试变红或靠少做必要工作换来的提升必须回退。
- neutral 或更差的变更默认回退；只为已证明有效的主指标选择最小充分 guard。
- 小收益大复杂度的优化要默认拒绝。
- 性能关键路径改动要补 benchmark、监控或预算门禁。

数据库、连接池与缓存的按需检查见 `references/backend-performance-checklist.md`。

## 输出契约

```text
Performance evidence:
- Symptom:
- Target:
- Baseline:
- Bottleneck:
- Change:
- After:
- Regression guard:
- Trade-off:
```

推荐结论：

```text
Recommendation: <optimize / monitor / defer / revert> because <baseline, measured impact, complexity cost, and rejected alternative>.
```

没有 baseline 和 after 数据，不要声明性能优化成立。
