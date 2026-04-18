调用 code-simplification 技能。简化代码，保持行为不变。

1. 理解目标代码的用途、调用者、边界条件和测试覆盖
2. 扫描简化机会 — 深嵌套、长函数、重复逻辑、死代码、模糊命名
3. 每次只做一种重构，逐步推进
4. 每次变更后运行测试确认无回归
5. 用 code-review-and-quality 技能审查最终结果

## 使用方式

在 `/simplify` 后指定要简化的文件或代码片段，我将分析并提出重构建议。

### 示例

```
# 简化复杂类
/simplify src/services/OrderService.java 太复杂了，超过 800 行，职责混杂

# 重构特定逻辑
/simplify 简化 calculateDiscount 方法的条件分支，当前有 15 个 if-else

# 消除重复
/simplify 检查 src/utils/ 下的工具类，找出重复代码并合并
```
