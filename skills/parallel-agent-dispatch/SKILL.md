---
name: parallel-agent-dispatch
description: Use when executing multiple independent tasks concurrently through parallel subagents. Implements fan-out/fan-in pattern with context isolation, result collection, and conflict detection. Supports three parallel modes - Context Fan-Out, Git Worktree isolation, and Cascade batching. Sister skill to subagent-driven-development (serial execution).
---

# Parallel Agent Dispatch

## Overview

当实现计划中有多个独立任务时，通过并行子代理同时执行，大幅加速开发。每个子代理在隔离的上下文中工作，完成后汇总结果并检测冲突。

**三种并行模式：**
- **Context Fan-Out**（默认）— 单上下文内并行分派子代理
- **Worktree Parallel** — Git worktree 文件系统级隔离
- **Cascade** — 分层批次执行（层内并行，层间串行）

## When to Use

```
有多个待执行任务？ ─── 否 ──→ 不需要此技能
    │
   是
    ▼
任务之间独立？ ─── 否 ──→ subagent-driven-development（串行）
    │
   是
    ▼
任务 >2 个？ ─── 否 ──→ 串行可能更简单
    │
   是
    ▼
parallel-agent-dispatch ✓
    │
    ▼
任务修改同一文件？ ─── 是 ──→ Worktree 并行模式（文件系统隔离）
    │
   否
    ▼
任务有层次依赖？ ── 是 ──→ Cascade 模式（分层批次）
    │
   否
    ▼
Context Fan-Out（默认模式）
```

适用场景：
- 多个独立模块可以同时实现
- 多个独立测试文件可以同时编写
- 多个不相关的 Bug 可以同时修复
- 代码审查的不同维度可以并行进行

不适用场景：
- 任务之间有依赖关系（Task B 需要 Task A 的输出）
- 任务修改同一个文件
- 任务需要共享状态

## 执行流程

### 阶段 1：分析与分组（Analysis）

```
读取计划中的所有任务
    │
    ▼
构建依赖图
    │
    ▼
识别可并行的任务组
    │
    ▼
检查文件冲突（两个任务是否修改同一文件？）
    │
    ▼
确定并行批次
```

**关键检查：**
- 同一文件不能被两个并行任务修改
- 有依赖关系的任务必须串行
- 共享测试 fixtures 的任务要注意隔离

### 阶段 2：扇出（Fan-Out）

为每个并行任务分派子代理：

```
控制器
    ├─→ 子代理 A：Task 1（文件集 A）
    ├─→ 子代理 B：Task 2（文件集 B）
    └─→ 子代理 C：Task 3（文件集 C）
```

**每个子代理接收：**
- 完整的任务描述
- 允许修改的文件列表（严格限定）
- 项目约定和模式示例
- 测试策略
- **明确说明不要触碰其他子代理的文件**

### 阶段 3：并行执行

每个子代理独立工作：
1. 遵循 TDD 循环（红 → 绿 → 重构）
2. 只修改分配给自己的文件
3. 运行自己范围内的测试
4. 报告状态（DONE / BLOCKED / NEEDS_CONTEXT）

### 阶段 4：扇入（Fan-In）

收集所有子代理的结果：

```
子代理 A 完成 ──┐
子代理 B 完成 ──┼──→ 结果汇总 → 冲突检测 → 集成测试
子代理 C 完成 ──┘
```

**汇总检查清单：**
- [ ] 所有子代理报告完成
- [ ] 无文件冲突（检查 VCS diff）
- [ ] 运行完整测试套件（不仅是各自的测试）
- [ ] 检查跨模块的接口一致性
- [ ] 合并所有变更

## 冲突检测

即使预先分配了文件集，仍需检测以下冲突：

| 冲突类型 | 检测方法 | 解决方式 |
|---------|---------|---------|
| 文件冲突 | 两个子代理修改了同一文件 | 手动合并或串行重做 |
| 接口冲突 | 模块 A 的输出与模块 B 的输入不匹配 | 修复接口层 |
| 命名冲突 | 不同子代理对同一概念使用不同命名 | 统一命名后批量替换 |
| 依赖冲突 | 子代理引入了冲突的依赖版本 | 协调统一版本 |

## 失败处理

**单任务失败不阻塞其他任务。**

```
子代理 A：✅ DONE
子代理 B：❌ BLOCKED
子代理 C：✅ DONE
                │
                ▼
       先合并 A 和 C 的结果
       然后单独处理 B（串行重试或重新分析）
```

处理优先级：
1. 收集所有成功结果
2. 运行集成测试（仅成功部分）
3. 分析失败原因
4. 对失败任务：提供更多上下文 / 用更强模型 / 拆分为更小任务

## Worktree 并行模式

当任务需要真正的文件系统隔离时（例如多个任务可能触及相邻文件、或需要完整的构建环境），使用 git worktree 为每个并行代理提供独立的工作目录。

### 流程

```
分析任务 → 为每个任务创建 worktree + 分支
    │
    ▼
并行执行（每个代理在自己的 worktree 中工作）
    │
    ▼
汇入主分支 → 解决冲突 → 集成测试 → 清理 worktree
```

### 具体步骤

**1. 创建 Worktree：**
```bash
# 主仓库在 main 分支
git worktree add ../project-task-a feature/task-a
git worktree add ../project-task-b feature/task-b
git worktree add ../project-task-c feature/task-c

# 每个 worktree 是独立目录，独立分支
ls ../
  project/              ← main 分支
  project-task-a/       ← feature/task-a
  project-task-b/       ← feature/task-b
  project-task-c/       ← feature/task-c
```

**2. 分派子代理：**
每个子代理的工作目录指向其 worktree，完全隔离。

**3. 合并策略：**
```bash
# 完成后合并各分支
git checkout main
git merge feature/task-a --no-edit
git merge feature/task-b --no-edit
git merge feature/task-c --no-edit

# 清理
git worktree remove ../project-task-a
git worktree remove ../project-task-b
git worktree remove ../project-task-c
git branch -d feature/task-a feature/task-b feature/task-c
```

**4. 冲突解决：**
- 合并时发现冲突 → 手动解决或分派子代理处理
- 实验失败 → 直接删除 worktree，无需复杂回滚

### 何时选择 Worktree 模式

| 场景 | Worktree 优势 |
|------|----------|
| 任务需要完整构建环境 | 每个 worktree 可独立 `npm install` 和构建 |
| 任务可能触及相邻文件 | 文件系统级隔离，无写入冲突 |
| 探索性实验 | 失败时直接删除 worktree，零成本 |
| 多人/多 Agent 协作 | 每人一个 worktree，自然隔离 |

## Cascade（级联）执行模式

当任务有层次依赖关系时，使用级联模式：每层内并行，层间串行，每层完成后验证再进入下一层。

### 流程

```
依赖分析 → 构建层次图 → 分层执行

层 0（基础）：无依赖的任务
    │  Task 1, Task 2, Task 3 ── 并行 ──→ 验证
    ▼
层 1：依赖层 0 的任务
    │  Task 4, Task 5 ── 并行 ──→ 验证
    ▼
层 2：依赖层 1 的任务
    │  Task 6 ── 串行 ──→ 最终验证
    ▼
完成
```

### 层次图构建

```
1. 读取计划中的所有任务及其依赖关系
2. 将无依赖的任务放入层 0
3. 将仅依赖层 0 的任务放入层 1
4. 以此类推，直到所有任务分层
5. 每层内的任务互相独立，可并行执行
```

### 层间门控

每层完成后必须通过验证才能进入下一层：

```
层 N 完成
    │
    ▼
✅ 所有任务成功 → 运行集成测试 → 进入层 N+1
❌ 部分失败 → 先合并成功结果 → 单独处理失败任务
❌ 集成测试失败 → 停止，修复后重新运行本层
```

### Cascade vs 简单批次

Cascade 是批次策略的精确版——基于依赖图自动计算批次，而非手动划分：

| 特征 | 简单批次 | Cascade |
|------|---------|--------|
| 批次划分 | 手动 | 依赖图自动计算 |
| 层间关系 | 隔离 | 明确的依赖传递 |
| 失败影响 | 本层失败才停 | 层失败阵止下游 |
| 适用场景 | 简单独立任务 | 有层次依赖的复杂计划 |

## 并行模式选择指南

| 场景特征 | 推荐模式 | 原因 |
|---------|---------|------|
| 任务完全独立，不触及同一文件 | **Context Fan-Out** | 最简单高效，无额外开销 |
| 任务可能触及相邻文件或需要独立构建 | **Worktree Parallel** | 文件系统级隔离，安全无冲突 |
| 任务有层次依赖关系 | **Cascade** | 层内并行 + 层间门控，最大化并行度 |
| 任务紧耦合，有严格串行依赖 | **不使用并行** | 用 subagent-driven-development 串行执行 |
| 探索性实验，不确定哪个方案最优 | **Worktree Parallel** | 失败时直接删除 worktree，零成本 |
| 大型计划（10+ 任务） | **Cascade** | 自动优化执行顺序，可控资源使用 |

## 批次策略

大型计划不必一次全部并行：

```
批次 1：Task 1, 2, 3（并行）→ 汇总 → 集成测试
    │
    ▼
批次 2：Task 4, 5（并行，依赖批次1的输出）→ 汇总 → 集成测试
    │
    ▼
批次 3：Task 6（串行，依赖批次2）→ 最终测试
```

**批次划分原则：**
- 同一批次内的任务互相独立
- 下一批次可以依赖上一批次的输出
- 每批次后运行集成测试
- 批次大小根据可用资源调整

## 与其他技能的衔接

- **subagent-driven-development** — 姊妹技能：串行版本，适合有依赖的任务链
- **planning-and-task-breakdown** — 上游：生成带依赖关系标注的任务计划，Cascade 模式依赖其输出的依赖图
- **git-workflow-and-versioning** — Worktree 模式依赖 git worktree 管理，参见该技能的 worktree 章节
- **verification-before-completion** — 扇入阶段和 Cascade 层间门控的集成测试遵循验证铁律
- **code-review-and-quality** — 所有并行结果合并后进行统一审查
- **continuous-learning** — 并行执行中的模式（常见冲突、有效批次大小）自动记录为 instinct

## Red Flags

- 并行执行有依赖关系的任务
- 两个子代理修改同一文件（非 Worktree 模式下）
- 跳过扇入阶段的集成测试
- 不检查跨模块接口一致性
- 子代理间共享上下文（违背隔离原则）
- 单个子代理失败就放弃所有结果
- 不运行完整测试套件就声明并行执行完成
- Cascade 模式中跳过层间门控直接进入下一层
- Worktree 完成后不清理（浪费磁盘空间）
- 不根据任务特征选择并行模式，一律使用默认 Fan-Out
