# Skill 创作与评测

## 何时使用

创建、改写或评估 skill 时使用。把 skill 当作会改变代理行为的可执行资产，而不是一篇说明文。成功标准同时包含：

- 正确触发：目标请求能选中，相邻请求不会误触发
- 行为改善：相同任务使用新 guidance 后更接近验收标准
- 上下文经济：常驻 metadata 短，正文只保留 quick path，细节按需加载
- 可追溯：外部来源、改写边界和许可证结论可复查

## 先分类

| 现状 | 基线 |
|---|---|
| 新 skill | 不加载该 skill |
| 改现有 skill | 修改前的快照 |
| 只修触发 | 当前正文不变，仅比较 metadata 路由 |
| 只修资源 | 当前 skill 不带新资源 |

先写一句失败基线：`在 <场景> 中，当前资产因为 <原因> 产生 <可观察失败>`。

## 创作流程

1. 收集 3 个代表性请求：典型成功、边界场景、相邻但不应触发的负例。
2. 为每个请求写可观察验收标准，不用“更好”“更完整”。
3. 选择 guidance 自由度：
   - 多种做法都成立：原则和决策门
   - 有首选模式但允许变化：伪代码、模板或带参数脚本
   - 顺序脆弱或重复出错：确定性脚本和严格验证
4. 设计三层内容：
   - `description`：WHAT + WHEN + 区分相邻 skill 的关键词
   - `body.md`：核心流程、stop gate、输出契约、验证要求
   - resources：长参考、脚本、模板和静态资产
5. 检查来源和许可证；不能确认可改写权时只吸收机制，不复制表达或文件。
6. 运行结构 lint，再做行为评测。

详细门禁见 `references/quality-gates.md`。

## 行为评测

对同一组请求比较 baseline 与 candidate：

```text
Evaluation case:
- Prompt:
- Expected route:
- Must do:
- Must not do:
- Evidence:
```

评测顺序：

1. 同时运行 baseline 和 candidate，避免环境变化造成假对比。
2. 先判断触发，再判断首轮动作、边界、输出和证据。
3. 客观项用脚本或明确断言；语气、设计感等主观项保留人工审阅。
4. 记录 token / 行数 / 读取资源数；不能测量时明确标注为静态估算。
5. 找出对 baseline 与 candidate 都恒真的断言并删除，它们没有区分力。
6. 只针对观察到的失败改 guidance，然后重跑原场景和至少一个新场景。

没有可用子代理或评测 harness 时，在主线程按同一 rubric 做人工对照；不要伪造并行、token 或耗时数据。

## 改写决策

- 路由失败：优先改 `description`
- 步骤遗漏：在正文增加最小决策门或输出契约
- 重复编写代码：沉淀并实际测试 `scripts/`
- 正文过长：把变体、示例和领域资料移到一层 reference
- 规则频繁失效：解释原因，并把脆弱步骤改成可执行检查
- 只对示例有效：删除特例措辞，补一个结构不同的新场景

## 输出契约

```text
Skill evaluation:
- Target:
- Failure baseline:
- Representative cases:
- Structural checks:
- Behavior delta:
- Context delta:
- Provenance / license:
- Remaining risk:
- Recommendation: <ship / revise / split / reject> because <evidence and trade-off>
```

只有结构检查和行为对照都成立，才能声明 skill 已优化。
