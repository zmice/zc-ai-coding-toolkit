# 技能发现

## 何时使用

会话开始或不确定入口时使用。用最少上下文选中当前阶段真正需要的 skill：先读 metadata，选中后再读正文；不要把整个技能目录加载进会话。

## 路由

| 当前任务 | 首选 skill |
|---|---|
| 入口不确定或需要完整任务分诊 | `command:start` |
| 已明确属于产品假设或方向发散 | `idea-refine` |
| 新功能或重大变更，需要规格 | `spec-driven-development` |
| 已有规格，需要拆任务 | `planning-and-task-breakdown` |
| 编写或修改代码 | `incremental-implementation` |
| 需要官方文档依据 | `source-driven-development` |
| UI / API 专项实现 | `frontend-ui-engineering` / `api-and-interface-design` |
| 写测试或修 bug | `test-driven-development` / `debugging-and-error-recovery` |
| 真实浏览器流程 | `browser-qa-testing` |
| 代码、安全或性能审查 | `code-review-and-quality`，按风险追加专项 skill |
| 创建、改写或评估 skill | `skill-authoring-and-evaluation` |
| 上下文膨胀 | `context-budget-audit` |
| 提交、发布或文档同步 | 对应 Git、shipping、release documentation skill |

任务跨阶段时按需切换，不把前一阶段的完整正文继续留作当前规则。

## Discovery Contract

判断候选 skill 时只看：

1. WHAT：它提供什么能力
2. WHEN：当前任务是否命中具体触发场景
3. BOUNDARY：相邻 skill 是否更合适
4. PLATFORM：当前平台是否真正支持需要的工具或安装面

不要从 skill 名称猜完整能力，也不要把兼容语义、旧命令名或生成产物误当成平台原生功能。

## 选择规则

- 只加载能改变当前动作的 skill。
- 两个 skill 顺序相关时，先用定义/诊断类，再用实现/验证类。
- 多个 skill 只是重复通用原则时，保留最具体的一个。
- 可从代码和配置推断的低风险事实直接验证；只有会改变路线的高风险歧义才询问用户。
- skill 缺失或平台能力不足时，说明降级，并保留同一输出与验证契约。

## 常见序列

```text
Feature:
command:start
→ idea-refine（仅在需要方向发散时）
→ spec-driven-development
→ planning-and-task-breakdown
→ incremental-implementation
→ test-driven-development
→ code-review-and-quality
→ verification-before-completion

Bug:
debugging-and-error-recovery
→ test-driven-development
→ code-review-and-quality
→ verification-before-completion

Skill asset:
skill-authoring-and-evaluation
→ context-budget-audit
→ verification-before-completion
```

## 输出

开始工作前只需记录：

```text
Skill route:
- Current phase:
- Selected:
- Why:
- Deferred:
- Platform fallback:
```

选择完成后立即进入目标 skill，不继续扩写路由说明。
