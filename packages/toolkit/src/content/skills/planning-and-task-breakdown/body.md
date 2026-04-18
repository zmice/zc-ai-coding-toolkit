# 规划与任务拆解

## 概览

把工作拆成小而可验证的任务，并给出明确的验收标准。好的任务拆解，是代理能稳定完成工作和把事情搞成一团乱麻之间的分水岭。每个任务都应该小到能在一次专注会话里实现、测试和验证。

## 何时使用

- 你已经有规格，需要拆成可实现单元
- 某个任务太大或太模糊，不知道从哪里开始
- 工作需要被多个代理或多个会话并行处理
- 你需要向人类传达范围
- 实现顺序不明显

**不适用的情况：** 单文件改动且范围显而易见，或者规格已经给出明确任务。

## 规划流程

### 第 1 步：进入 Plan 模式

在写任何代码之前，先处于只读模式：

- 阅读规格和相关代码
- 识别现有模式和约定
- 映射组件之间的依赖关系
- 记录风险和未知项

**规划期间不要写代码。** 输出应该是一份计划文档，而不是实现。

### 第 2 步：识别依赖图

明确什么依赖什么：

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

实现顺序遵循依赖图，自下而上：先打基础，再做上层。

### 第 3 步：纵向切片

不要先把数据库全部做完，再做所有 API，再做所有 UI，而是一次做一条完整的功能路径：

**坏的切法（横向切片）：**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**好的切法（纵向切片）：**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
Task 4: User can view task list (query + API + UI for list view)
```

每个纵向切片都应交付一个可工作的、可测试的功能。

### 第 4 步：编写任务

每个任务都遵循如下结构：

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [description of what to verify]

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [Small: 1-2 files | Medium: 3-5 files | Large: 5+ files]
```

### 第 5 步：排序与检查点

按以下原则安排任务：

1. 先满足依赖关系（先建基础）
2. 每个任务结束时系统都应保持可工作
3. 每 2-3 个任务设置一次验证检查点
4. 高风险任务优先安排，尽早失败

添加明确的检查点：

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

## 任务拆解尺度

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | 单个函数或配置改动 | 添加一条校验规则 |
| **S** | 1-2 | 一个组件或一个接口 | 新增一个 API endpoint |
| **M** | 3-5 | 一个完整功能切片 | 用户注册流程 |
| **L** | 5-8 | 多组件功能 | 带筛选和分页的搜索 |
| **XL** | 8+ | **太大了，必须继续拆** | — |

如果任务达到 L 或更大，就应该继续拆小。代理在 S 和 M 尺度上表现最好。

**需要继续拆分的信号：**
- 预计超过一次专注会话（大约 2 小时）的代理工作
- 你无法在 3 个或更少的要点中写清验收标准
- 它同时触及两个或以上相互独立的子系统（例如 auth 和 billing）
- 任务标题里频繁出现 “and” 或 “以及”，说明其实是两个任务

## 计划文档模板

```markdown
# Implementation Plan: [Feature/Project Name]

## Overview
[One paragraph summary of what we're building]

## Architecture Decisions
- [Key decision 1 and rationale]
- [Key decision 2 and rationale]

## Task List

### Phase 1: Foundation
- [ ] Task 1: ...
- [ ] Task 2: ...

### Checkpoint: Foundation
- [ ] Tests pass, builds clean

### Phase 2: Core Features
- [ ] Task 3: ...
- [ ] Task 4: ...

### Checkpoint: Core Features
- [ ] End-to-end flow works

### Phase 3: Polish
- [ ] Task 5: ...
- [ ] Task 6: ...

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk] | [High/Med/Low] | [Strategy] |

## Open Questions
- [Question needing human input]
```

## 并行化机会

当有多个代理或多个会话时：

- **可以并行：** 独立的功能切片、已实现功能的测试、文档
- **必须串行：** 数据库迁移、共享状态变更、依赖链
- **需要协调：** 共享 API 合同的功能，先定义合同，再并行实现

## 常见合理化说辞

| 合理化说辞 | 现实 |
|---|---|
| “我边做边想” | 最后往往只会得到一团乱麻和返工。10 分钟规划能省几小时。 |
| “任务很明显” | 还是写下来。显式任务能暴露隐藏依赖和被遗忘的边界情况。 |
| “规划是额外开销” | 规划本身就是任务。没有计划的实现，只是在敲字。 |
| “我脑子里都记得住” | 上下文窗口是有限的。书面计划能跨会话保存。 |

## 红旗

- 没有书面任务列表就开始实现
- 任务标题只有“实现功能”，却没有验收标准
- 计划里没有验证步骤
- 所有任务都是 XL 级
- 任务之间没有检查点
- 没有考虑依赖顺序

## 验证

在开始实现前，确认：

- [ ] 每个任务都有验收标准
- [ ] 每个任务都有验证步骤
- [ ] 任务依赖已识别且排序正确
- [ ] 没有任务会修改超过约 5 个文件
- [ ] 主要阶段之间有检查点
- [ ] 人类已经审阅并批准计划
