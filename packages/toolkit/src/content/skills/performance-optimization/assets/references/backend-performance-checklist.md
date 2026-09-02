# 后端性能按需检查

只在证据把瓶颈指向数据库、连接池或缓存时读取。具体命令和语法以当前数据库官方文档为准。

## Query plan 与索引

- 使用相同参数、数据和环境保存 before / after `EXPLAIN ANALYZE` 或等价 query plan。
- 检查扫描方式、estimated / actual rows 偏差、额外 `Sort`、锁等待和实际耗时；小表或低选择性查询出现 Seq Scan 不一定是错误。
- composite index 按 query shape 设计，通常先 equality，再 range / sort；partial、expression、full-text 或 trigram index 只在查询条件匹配时采用。
- 记录索引写放大、存储成本和维护成本，并检查 unused / duplicate index。

## 连接池

- 每个进程一个 pool；核对 `instances × pool max` 与数据库连接上限，并为管理连接和突发留余量。
- 先观测 connection wait / timeout、active / idle / wait、long transaction、missing await 和 leaked client。
- 扩大 pool 不是默认修复；它可能把排队转移到数据库并放大争用。
- multiplexing proxy 只用于已证明的 autoscaling / serverless 连接风暴，不作为常规依赖。

## 缓存

- 记录 layer、invalidation、staleness window、key dimensions、TTL、eviction 与 memory ceiling。
- key 包含所有影响结果的租户、查看者、语言、权限和 feature flag 维度。
- 观测 hit rate 与 origin load；hot key 防 stampede，negative cache 使用短 TTL，origin error 不缓存为 not-found。
- 权限、余额、结算库存等 stale 即 correctness bug 的数据默认不缓存。
- cache-aside 适合通用读取；read-through 简化调用方；write-through 增加写延迟；write-behind 有数据丢失与重排风险，必须有明确业务依据。

## Keep / revert

| 结果 | 决策 |
|---|---|
| correctness green，主指标改善超过测量波动且复杂度可接受 | keep，并加最小充分 guard |
| 改善落在 run-to-run variance 内 | revert 或继续收集证据 |
| 指标变差、测试失败或靠跳过必要工作换取提升 | revert |
