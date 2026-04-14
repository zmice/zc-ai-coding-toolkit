## 概述
手动触发当前会话的模式提取与学习。分析 hook 采集的观察数据，提取可复用的 instincts（本能），并持久化到本地文件和 Agent Memory。

## 子命令

| 子命令 | 说明 |
|--------|------|
| `/learn` | 分析当前会话观察数据，提取 instincts |
| `/learn status` | 显示当前项目和全局的所有 instincts |
| `/learn evolve` | 聚类相关 instincts，建议演化为 skill/command |
| `/learn save [描述]` | 手动创建一个高置信度 instinct |
| `/learn promote [id]` | 将项目级 instinct 提升为全局 |
| `/learn export` | 导出 instincts 为文件 |
| `/learn import [file]` | 从文件导入 instincts |
| `/learn setup` | 安装持续学习 hooks |

## 工作流程

### `/learn`（默认 — 分析与提取）

1. **读取观察数据**
   - 检查 `~/.qoder/homunculus/projects/<project-hash>/observations.jsonl`
   - 如无项目级数据，读取全局 `~/.qoder/homunculus/observations.jsonl`
   - 统计本次会话和总体观察数据量

2. **模式分析**
   - 扫描用户纠正（`is_correction: true` 的记录）
   - 识别错误→修复模式（`tool_outcome: failure` 后紧跟成功的同类操作）
   - 检测重复工具调用模式（相同工具+类似参数出现 3+ 次）
   - 推断项目约定（代码风格、文件结构一致性）

3. **生成 Instincts**
   - 为每个检测到的模式创建 instinct 草稿
   - 分配初始置信度（按来源类型）
   - 标记作用域（project / global）
   - 检查是否与已有 instincts 重复（合并并提升置信度）

4. **展示结果**
   ```
   📊 会话学习分析
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   观察数据: 42 条（本次会话 28 条）
   检测到的模式: 3 个

   1. [NEW] prefer-named-exports (0.80)
      触发: 创建 TypeScript 模块时
      行动: 使用 named export 而非 default export
      证据: 用户纠正 ×2

   2. [UPDATE] grep-before-edit (0.65 → 0.70)
      触发: 编辑文件前
      行动: 先搜索文件确认位置，再编辑
      证据: 重复工作流观察 ×5

   3. [NEW] use-zod-validation (0.60)
      触发: 处理 API 输入时
      行动: 使用 Zod schema 进行验证
      证据: 错误修复路径 ×2
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   确认这些 instincts？(Y/n/选择性确认)
   ```

5. **持久化**
   - 确认的 instincts 写入 `instincts/personal/*.yaml`
   - 置信度 >= 0.7 的同步到 Agent Memory（`learned_skill_experience`）
   - 更新已有 instincts 的置信度和证据

### `/learn status`

显示所有已学习的 instincts：

```
📋 Instinct 状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
项目: ai-coding-toolkit (a1b2c3d4e5f6)

项目级 Instincts (5):
  ● prefer-named-exports    [0.85] code-style
  ● use-zod-validation      [0.70] code-style
  ● tests-next-to-source    [0.65] testing
  ○ prefer-pnpm             [0.40] workflow    ← 低置信度
  ○ use-barrel-exports      [0.35] code-style  ← 低置信度

全局 Instincts (3):
  ● grep-before-edit         [0.90] workflow
  ● always-validate-input    [0.85] security
  ● conventional-commits     [0.80] git
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● = 活跃 (>= 0.5)  ○ = 试探性 (< 0.5)
```

### `/learn evolve`

分析 instincts 聚类，建议演化为正式 skill 或 command：

```
🧬 Instinct 演化分析
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
可演化集群:

1. "TypeScript 代码风格" (3 instincts, avg 0.73)
   - prefer-named-exports (0.85)
   - use-barrel-exports (0.65)
   - prefer-interface-over-type (0.70)
   → 建议: 演化为项目级 coding-style skill

2. "输入验证模式" (2 instincts, avg 0.78)
   - always-validate-input (0.85)
   - use-zod-validation (0.70)
   → 建议: 合并为全局 validation instinct

操作: evolve [集群编号] 或 skip
```

### `/learn save [描述]`

手动创建 instinct（置信度 0.9，明确教学）：

```
/learn save 这个项目中所有 API 返回都使用 Result<T, E> 模式

→ 创建 Instinct:
  id: use-result-pattern-for-api
  trigger: 编写 API 返回类型时
  action: 使用 Result<T, E> 模式包装返回值
  confidence: 0.90
  scope: project
```

### `/learn setup`

运行安装脚本配置 hooks：

```
运行 bash skills/continuous-learning/hooks/setup.sh
自动检测平台并安装 PostToolUse / UserPromptSubmit / Stop hooks
```

## 与 Memory 系统的集成

### 写入 Memory

当 instinct 置信度 >= 0.7 时，自动写入 Agent Memory：

```
update_memory:
  action: create
  category: learned_skill_experience
  title: "Instinct: [trigger]"
  content: "[action]\n\nConfidence: [confidence]\nDomain: [domain]\nEvidence: [evidence列表]"
  keywords: "[domain], instinct, [project_name], continuous-learning"
  scope: project | global
```

### 读取 Memory

会话启动时，从 Memory 检索已有 instincts：

```
search_memory:
  depth: shallow
  keywords: "instinct, continuous-learning"
  category: learned_skill_experience
```

## 前置条件

- hooks 已通过 `/learn setup` 或手动配置安装
- macOS/Linux 需安装 `jq`（hooks 脚本依赖）；Windows 版使用 PowerShell 内置 JSON 处理，无额外依赖
- 已有足够的观察数据（建议至少 5 条）

## 注意事项

- `/learn` 是分析性命令，不会修改任何源代码
- 提取的 instincts 需要用户确认后才持久化
- 高置信度 instincts 自动同步到 Memory，低置信度的仅本地存储
- 定期运行 `/learn status` 检查 instincts 健康状态
- 置信度 < 0.3 的 instincts 会被自动归档
