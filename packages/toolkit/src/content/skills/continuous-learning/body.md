# Continuous Learning

## 角色定位

把一次会话中的可复用经验提炼成可审查、可回滚的学习项。它服务于长期协作质量，不是默认打开的遥测系统，也不是跨会话记忆的自动授权入口。

核心模式：观察 → 提炼 → 验证 → 持久化 → 演化。

## 何时使用

- 用户明确要求 `/learn` 或复盘当前会话。
- 多次出现同一纠正、错误修复路径或项目约定。
- Sprint retrospective 需要沉淀可复用经验。
- 需要把高频经验升级成 skill、command 或项目规则。

不适用：

- 单次偶然偏好。
- 未经验证的猜测。
- 敏感信息、凭据、生产数据或私人内容。
- 用户没有同意的自动跨会话记忆。

## 快速路径

1. 收集本轮会话中可复用的观察，不存大段原始输入输出。
2. 区分事实、用户偏好、项目约定和一次性上下文。
3. 只提炼“触发条件 → 行动”的原子 instinct。
4. 给每条 instinct 标置信心、证据、作用域和失效条件。
5. 低置信度只留本地候选；高置信度也要说明为什么可复用。
6. 需要写入长期文件或跨会话记忆时，先说明范围并等待用户同意。
7. 多次重复后，再考虑演化为正式 skill / command / AGENTS 规则。

## Instinct 格式

```yaml
id: prefer-targeted-verification
trigger: "when finishing a scoped toolkit content change"
action: "run toolkit lint and package tests before claiming completion"
confidence: 0.8
scope: project
evidence:
  - "User repeatedly asked for evidence before completion"
expires_when: "project verification policy changes"
```

写得下这一段，才说明它足够明确；写不下就不要持久化。

## 作用域判断

| 类型 | 默认作用域 |
|---|---|
| 当前仓库验证命令、目录边界、提交习惯 | project |
| 用户长期偏好，但不含敏感信息 | personal，需确认 |
| 通用安全实践、证据先于断言 | global candidate，需多次证明 |
| 一次性任务背景、临时路径、失败日志 | 不持久化 |

## 证据质量

可用证据：

- 用户明确纠正。
- 同一模式在多个任务中重复出现。
- 修复失败后验证证明某个流程更可靠。
- 仓库文档、测试或代码约束支持该规则。

不可用证据：

- 模型自己的感觉。
- 单次偶然成功。
- 未读完整输出的命令结果。
- 涉及秘密、个人数据或生产数据的原文。

## 演化门槛

从 instinct 升级为正式内容前，检查：

- 是否至少出现多次，或由用户明确要求沉淀。
- 是否能写成清晰触发条件，而不是宽泛建议。
- 是否与现有 skill / command 重叠。
- 是否有验证方式或反例边界。
- 是否会增加常驻上下文负担。

优先把稳定规则写进已有 skill 或项目文档；只有边界清楚、复用频繁时才新增 skill。

## Hook 边界

Hook / automation 只能作为显式 opt-in 能力：

- 安装前说明会记录什么、不记录什么、写到哪里。
- 默认只记录摘要，不记录完整工具输入输出。
- 支持关闭和清理。
- 平台事件名和配置方式必须以当前官方能力为准。

不要在内容层假设所有平台都支持同样的 hook 事件，也不要把 hook 当成默认运行前提。

## 推荐输出

```text
Recommendation: <不记录 / 记录为候选 / 写入项目规则 / 演化为 skill> because <证据、作用域和长期上下文代价>。
```

推荐必须说明被放弃的替代方案，例如“只留聊天结论”“写入 AGENTS”“新增 skill”，以及为什么当前选择更合适。
