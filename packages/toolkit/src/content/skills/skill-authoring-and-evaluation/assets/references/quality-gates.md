# Skill 质量门禁

需要创建、改写或发布 skill 时读取本文件。

## 1. Discovery

- 名称使用稳定、可移植的 kebab-case
- `description` 同时包含 WHAT 与 WHEN
- 触发词具体，能和相邻 skill 区分
- 正文不再重复一整段“何时使用”
- 负例不会因为宽泛描述误触发

## 2. Primary Body

- 先给 quick path，再给例外
- 保留顺序、stop gate、输出契约和验证
- 删除模型本来就知道的通用教程
- 不重复 reference 中的内容
- 平台工具名只在确实不可移植时出现
- 接近 500 行前就拆分，不把行数上限当目标

## 3. Resource Placement

| 类型 | 放什么 | 要求 |
|---|---|---|
| `scripts/` | 重复、脆弱、需要确定性的操作 | 实际运行；错误清晰；临时资源可清理 |
| `references/` | 领域资料、长 checklist、变体说明 | 从正文一层直达；长文件有目录或检索提示 |
| `assets/` | 原样消费的图片、字体、样板文件 | 不作为隐式 instruction |
| `templates/` | 代理需要修改的脚手架 | 明确哪些部分允许改 |

脚本优先把机器可读结果写 stdout，把进度和诊断写 stderr。不得内置凭证。

## 4. Provenance and License

- 外部来源已登记，HEAD 和观察日期可复查
- `source.origin_*` 能定位到具体资产
- `adapted` 保留精确映射，`inspired` 说明改写边界
- 许可证按具体文件或 skill 检查，不从仓库热度推断
- source-available、品牌条款和第三方资产不当作开源内容复制

## 5. Evaluation

最小场景集：

1. 典型任务：证明主要流程有效
2. 边界任务：证明 stop gate、错误或兼容路径有效
3. 负例：证明不会抢占相邻 skill

每个断言必须回答：

- 什么可观察行为会让它失败
- 期望是否独立于被测 guidance 推导
- baseline 与 candidate 是否有区分度
- 是否能由脚本验证；不能时由谁人工判断

## 6. Release Evidence

- content / schema lint
- broken link 和 attachment 检查
- 相关 loader / generator 测试
- 至少一组 baseline / candidate 对照
- 上下文预算前后差异
- 未覆盖平台和剩余风险
