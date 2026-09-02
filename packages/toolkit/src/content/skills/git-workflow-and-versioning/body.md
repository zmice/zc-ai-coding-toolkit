# Git 工作流与版本管理

## 概述

Git 是你的安全网。把提交当存档点，把分支当沙箱，把历史当文档。AI Agent 高速生成代码的环境下，规范的版本控制是保持变更可管理、可审查、可回滚的核心机制。

## 何时使用

当前工作区已由 Git 管理，或用户明确要求初始化/迁移到 Git、创建分支、提交、合并、worktree 或分析历史时使用。先检查仓库状态和团队规则；非 Git 工作区不得为套用本技能自行 `git init`，改用备份、`git diff --no-index` 或项目已有校验方式。

## 核心原则

优先级：仓库/团队既有策略 > 用户明确要求 > 当前安全状态 > 本技能默认建议。先识别默认集成分支、当前分支、未提交用户改动、commit / PR 规范、release 模型和 hooks；不得为了套模板自动建分支、自动提交或重写历史。

### 主干开发（无既有策略时的可选默认）

尽量保持团队默认集成分支可部署，并用可审查的小切片降低分叉。分支寿命由冲突风险、发布节奏和团队策略决定；release、support 或 migration 分支可以长期存在，但需要 owner、同步策略和结束条件。

```
main ──●──●──●──●──●──●──●──●──●──  （始终可部署）
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← 可审查、可持续同步的 feature 分支
```

这是推荐的默认策略。使用 gitflow 或长期分支的团队可以调整原则（原子提交、小变更、描述性消息）以适配自己的分支模型 — 提交纪律比具体的分支策略更重要。

- **开发分支是成本。** 分支每多存活一天，合并风险就多一分。
- **发布分支可以接受。** 当需要稳定发布版本而 main 继续前进时。
- **Feature Flag 是条件化工具。** 只有需要把未完成功能安全合入、且有隔离与清理计划时才使用，不作为长期分支的普遍替代。

### 1. 早提交，勤提交

用户已授权提交且变更只属于当前任务时，为逻辑完整、已验证的切片建立 checkpoint。未授权、共享 dirty worktree 或混有用户改动时只报告 diff，不代替用户提交。

```
工作模式：
  实现切片 → 测试 → 验证 → 提交 → 下一个切片

不要这样：
  实现所有功能 → 祈祷能跑 → 一个巨大提交
```

提交是存档点。如果下一个变更出了问题，你可以立即回到上一个已知正常的状态。

### 2. 原子提交

每个提交只做一件逻辑上完整的事：

```
# 好的：每个提交自包含
git log --oneline
a1b2c3d feat: 添加任务创建接口及校验
d4e5f6g feat: 添加任务创建表单组件
h7i8j9k feat: 表单对接 API 并添加加载状态
m1n2o3p test: 添加任务创建测试（单元 + 集成）

# 差的：所有东西混在一起
git log --oneline
x1y2z3a 添加任务功能、修侧边栏、更新依赖、重构工具函数
```

## 3. 描述性消息

提交消息解释 *为什么*，而非仅仅描述 *做了什么*：

```
# 好的：解释意图
feat: 注册接口添加邮箱格式校验

防止无效邮箱格式写入数据库。
在路由处理层使用 Zod schema 校验，与 auth.ts 中现有校验模式一致。

# 差的：描述 diff 中显而易见的内容
更新 auth.ts
```

**格式：**
```
<type>: <中文简述>

<可选的详细说明，解释"为什么"而非"做了什么">
```

**类型前缀：**
- `feat` — 新功能
- `fix` — Bug 修复
- `refactor` — 既不修 bug 也不加功能的代码重构
- `test` — 添加或更新测试
- `docs` — 仅文档变更
- `chore` — 工具链、依赖、配置

### 4. 关注点分离

不要把格式化变更和行为变更混在一起。不要把重构和新功能混在一起。每种变更应独立提交，最好也是独立的 PR：

```
# 好的：关注点分离
git commit -m "refactor: 提取校验逻辑到共享工具模块"
git commit -m "feat: 注册流程添加手机号校验"

# 差的：关注点混杂
git commit -m "重构校验并添加手机号字段"
```

**重构和功能开发分开提交。** 重构和功能是两种不同的变更 — 分开提交。这使每个变更更容易审查、回滚和在历史中理解。小清理（如重命名变量）可以酌情包含在功能提交中。

### 5. 控制变更规模

用逻辑边界、审查负担、独立验证和回滚能力决定是否拆分，不设通用 LOC 硬阈值。生成文件、锁文件、迁移或机械变更可以很大但仍保持原子；不要为追求小 diff 破坏完整性。

```
独立行为切片 → 可单独验证和回滚时拆分
生成/迁移/锁文件 → 不可合理拆分时保持原子并补验证
混合关注点 → 按行为、格式化、生成物或迁移边界拆分
```

## 分支策略

### Feature 分支

```
main（始终可部署）
  │
  ├── feature/task-creation    ← 每个分支一个功能
  ├── feature/user-settings    ← 并行开发
  └── fix/duplicate-tasks      ← Bug 修复
```

- 从 `main`（或团队默认分支）创建分支
- 保持分支持续同步，并在冲突风险或审查负担上升前收敛；不使用通用天数作为失败门槛
- 合并后删除分支
- 只有仓库已有 flag 机制且有清理计划时，才用 Feature Flag 隔离未完成功能

### 分支命名（遵循仓库约定；无约定时作为示例）

```
feature/<简短描述>   → feature/task-creation
fix/<简短描述>       → fix/duplicate-tasks
chore/<简短描述>     → chore/update-deps
refactor/<简短描述>  → refactor/auth-module
```

## Git Worktree 并行开发

当多个 AI Agent 需要并行工作时，使用 git worktree 同时运行多个分支。通用 / `zc team` 流程优先使用已被 `.gitignore` 覆盖的项目内 `.worktrees/`；如果无法证明项目内目录会被忽略，就使用仓库外的兄弟目录。Codex native subagent 的临时隔离是例外：使用 `zc agent worktree` 分配 OS temp lease，不写入仓库 `.worktrees/`，也不占用 Codex Desktop 的 `$CODEX_HOME/worktrees` namespace。

```bash
# 为 feature 分支创建 worktree
git worktree add .worktrees/project-feature-a feature/task-creation
git worktree add .worktrees/project-feature-b feature/user-settings

# 每个 worktree 是独立目录，各自有自己的分支
# Agent 可以并行工作互不干扰
ls .worktrees/
  project-feature-a/    ← task-creation 分支
  project-feature-b/    ← user-settings 分支

# 完成后先确认状态，再合并或清理
git -C .worktrees/project-feature-a status --short --branch
git worktree remove .worktrees/project-feature-a
```

优势：
- 多个 Agent 可以同时工作在不同功能上
- 无需切换分支（每个目录有自己的分支）
- 变更相互隔离，直到显式合并
- 实验失败时也先记录结论并检查 diff，再决定合入、保留或丢弃

## 存档点模式

```
Agent 开始工作
    │
    ├── 做了一个变更
    │   ├── 测试通过？ → 提交 → 继续
    │   └── 测试失败？ → 回退到上次提交 → 调查
    │
    ├── 做了另一个变更
    │   ├── 测试通过？ → 提交 → 继续
    │   └── 测试失败？ → 回退到上次提交 → 调查
    │
    └── 功能完成 → 所有提交形成干净的历史
```

这个模式意味着你不会把多个未验证增量混成一团。如果 Agent 走偏了，先读 `git status` 和 `git diff`，确认哪些文件属于本次增量，再按团队规则回退或丢弃；不要在未确认范围时使用破坏性回退命令。

## 变更摘要

每次修改后提供结构化摘要。这使审查更容易，记录范围纪律，暴露意外变更：

```
变更内容:
- src/routes/tasks.ts: 为 POST 端点添加校验中间件
- src/lib/validation.ts: 添加 TaskCreateSchema（使用 Zod）

未修改（有意为之）:
- src/routes/auth.ts: 有类似校验缺口但不在本次范围内
- src/middleware/error.ts: 错误格式可优化（单独任务）

潜在关注点:
- Zod schema 为严格模式 — 会拒绝多余字段，请确认是否预期行为
- zod 作为依赖添加（72KB gzipped）— package.json 中已存在
```

这个模式能尽早发现错误假设，给审查者提供清晰的变更地图。“未修改”部分尤其重要 — 它展示了你的范围纪律。

## 提交前检查

每次提交前：

```bash
# 1. 检查即将提交的内容
git diff --staged

# 2. 确保没有密钥泄露
git diff --staged | grep -i "password\|secret\|api_key\|token"

# 3. 运行测试
npm test

# 4. 运行 lint
npm run lint

# 5. 类型检查
npx tsc --noEmit
```

使用 git hooks 自动化：

以下 hook 仅是 Node 项目示例；先使用仓库现有工具，不为套模板新增依赖：

```json
// package.json（使用 lint-staged + husky）
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## 分支收尾

提交纪律解决的是“如何安全前进”，分支收尾解决的是“何时正式结束”。一个 branch 在以下条件同时成立前，不算真正完成：

- 变更已经过本任务要求的验证
- branch 的最终去向已经明确
- 不再需要的 branch / worktree 已清理

常见结束状态：

- **直接合入** — 适合短生命周期分支；合入目标分支后立即删除
- **开 PR 等待审查** — 推送 branch，附带验证证据，PR 合并后删除 branch
- **暂时保留** — 只在有明确后续任务、责任人和截止时间时成立
- **丢弃实验** — 记录结论后删除 branch 或清理 worktree，不让失败方案长期悬挂

如果你需要具体的 merge / keep / discard / cleanup 判定，转到 `branch-finish-and-cleanup`。

## 生成文件处理

- 是否跟踪 lockfile、迁移、`dist/`、IDE 配置或其他生成文件，由仓库 policy 和现有 tracked state 决定。
- 环境凭据、私钥和本地秘密不得提交；项目级共享配置只有经过审查且不含秘密时才跟踪。
- 不擅自改变现有生成物策略；需要迁移时先说明对发布、安装和 diff 的影响。

## 使用 Git 调试

```bash
# 查找哪个提交引入了 bug
git bisect start
git bisect bad HEAD
git bisect good <已知正常的提交>
# Git 二分检出中点；在每个点运行测试来缩小范围

# 查看最近的变更
git log --oneline -20
git diff HEAD~5..HEAD -- src/

# 查找谁最后修改了某行
git blame src/services/task.ts

# 搜索提交消息关键词
git log --grep="校验" --oneline
```

## 常见借口

| 借口 | 现实 |
|------|------|
| “等功能做完再提交” | 一个巨大提交无法审查、调试或回滚。每个切片都提交。 |
| “提交消息无所谓” | 消息就是文档。未来的你（和未来的 Agent）需要理解改了什么以及为什么。 |
| “回头再 squash” | Squash 会破坏开发叙事。从一开始就做干净的增量提交。 |
| “分支太麻烦” | 是否建分支取决于团队策略、当前 dirty state 和冲突风险；不要自动建分支，也不要在共享分支无保护地混入变更。 |
| “回头再拆分” | 大变更更难审查、部署风险更高、更难回滚。提交前拆分，不要事后。 |
| “不需要 .gitignore” | 直到带生产密钥的 `.env` 被提交。立即配置。 |

## 危险信号

- 大量未提交的变更在累积
- 提交消息像 “fix”、“更新”、“杂项”
- 格式化变更和行为变更混在一起
- 项目没有 `.gitignore`
- 提交了 `node_modules/`、`.env` 或构建产物
- 长期分支与 main 严重分叉
- 在共享分支上 force-push

## 提交检查清单

每次提交前确认：

- [ ] 提交只做一件逻辑上完整的事
- [ ] 消息解释了“为什么”，遵循 type 规范
- [ ] 提交前测试通过
- [ ] diff 中没有密钥
- [ ] 没有把格式化变更和行为变更混在一起
- [ ] `.gitignore` 覆盖了标准排除项

## 分支结束检查清单

- [ ] branch 的目标去向已明确：merge、PR、保留或删除
- [ ] 合入或关闭前的验证证据已准备好
- [ ] 合并后的 branch 会被删除，不会长期滞留
- [ ] 关联 worktree 在任务结束后同步清理
- [ ] 保留中的 branch 有明确后续动作，而不是“先放着”
