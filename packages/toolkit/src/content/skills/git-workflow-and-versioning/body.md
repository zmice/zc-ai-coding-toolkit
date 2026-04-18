# Git 工作流与版本管理

## 概述

Git 是你的安全网。把提交当存档点，把分支当沙箱，把历史当文档。AI Agent 高速生成代码的环境下，规范的版本控制是保持变更可管理、可审查、可回滚的核心机制。

## 何时使用

始终使用。所有代码变更都经过 git。

## 核心原则

### 主干开发（推荐）

保持 `main` 始终可部署。在短生命周期的 feature 分支上工作，1-3 天内合回。长期存活的开发分支是隐性成本 — 它们会分叉、产生合并冲突、延迟集成。DORA 研究持续表明，主干开发与高效能工程团队强相关。

```
main ──●──●──●──●──●──●──●──●──●──  （始终可部署）
        ╲      ╱  ╲    ╱
         ●──●─╱    ●──╱    ← 短生命周期 feature 分支（1-3 天）
```

这是推荐的默认策略。使用 gitflow 或长期分支的团队可以调整原则（原子提交、小变更、描述性消息）以适配自己的分支模型 — 提交纪律比具体的分支策略更重要。

- **开发分支是成本。** 分支每多存活一天，合并风险就多一分。
- **发布分支可以接受。** 当需要稳定发布版本而 main 继续前进时。
- **Feature Flag > 长期分支。** 优先使用 flag 部署未完成的功能，而非在分支上放几周。

### 1. 早提交，勤提交

每个成功的增量都应有自己的提交。不要积累大量未提交的变更。

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

目标每次提交/PR 约 100 行。超过 1000 行的变更应拆分。参见 `code-review-and-quality` 中的拆分策略。

```
~100 行  → 容易审查，容易回滚
~300 行  → 单个逻辑变更可以接受
~1000 行 → 必须拆分为更小的变更
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
- 保持分支短生命周期（1-3 天内合并）— 长期分支是隐性成本
- 合并后删除分支
- 优先使用 Feature Flag 而非长期分支来管理未完成的功能

### 分支命名

```
feature/<简短描述>   → feature/task-creation
fix/<简短描述>       → fix/duplicate-tasks
chore/<简短描述>     → chore/update-deps
refactor/<简短描述>  → refactor/auth-module
```

## Git Worktree 并行开发

当多个 AI Agent 需要并行工作时，使用 git worktree 同时运行多个分支：

```bash
# 为 feature 分支创建 worktree
git worktree add ../project-feature-a feature/task-creation
git worktree add ../project-feature-b feature/user-settings

# 每个 worktree 是独立目录，各自有自己的分支
# Agent 可以并行工作互不干扰
ls ../
  project/              ← main 分支
  project-feature-a/    ← task-creation 分支
  project-feature-b/    ← user-settings 分支

# 完成后合并并清理
git worktree remove ../project-feature-a
```

优势：
- 多个 Agent 可以同时工作在不同功能上
- 无需切换分支（每个目录有自己的分支）
- 实验失败时直接删除 worktree — 不会丢失任何东西
- 变更相互隔离，直到显式合并

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

这个模式意味着你永远不会丢失超过一个增量的工作。如果 Agent 走偏了，`git reset --hard HEAD` 就能回到上一个成功状态。

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

```json
// package.json（使用 lint-staged + husky）
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

## 生成文件处理

- **提交生成文件** 仅在项目需要时（如 `package-lock.json`、Prisma 迁移）
- **不提交** 构建产物（`dist/`、`.next/`）、环境文件（`.env`）、IDE 配置（`.vscode/settings.json`，除非共享）
- **配置 `.gitignore`** 覆盖：`node_modules/`、`dist/`、`.env`、`.env.local`、`*.pem`

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
| “分支太麻烦” | 短生命周期分支是免费的，能防止工作冲突。长期分支才是问题 — 1-3 天内合并。 |
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
