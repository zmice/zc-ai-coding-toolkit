---
name: ci-cd-and-automation
description: CI/CD 管道搭建与自动化。在搭建或修改构建和部署管道时使用。用于自动化质量门禁、配置 CI 测试运行器、制定部署策略。
---

# CI/CD 与自动化

## 概述

自动化质量门禁，确保任何变更都必须通过测试、Lint、类型检查和构建才能进入生产环境。CI/CD 是所有其他技能的执行保障 — 它能一致地、在每一次变更上，捕获人类和 Agent 遗漏的问题。

**左移原则（Shift Left）：** 尽早在管道中捕获问题。Lint 阶段发现的 bug 只花几分钟修；同样的 bug 到生产环境要花几小时。把检查往上游推 — 静态分析先于测试，测试先于 Staging，Staging 先于生产。

**更频繁更安全：** 更小的批次和更频繁的发布降低风险，而非增加风险。3 个变更的部署比 30 个变更的部署更容易调试。频繁发布本身会建立对发布流程的信心。

## 何时使用

- 为新项目搭建 CI 管道
- 添加或修改自动化检查
- 配置部署管道
- 变更应触发自动化验证时
- 调试 CI 失败

## 质量门禁管道

每个变更在合并前必须通过这些门禁：

```
Pull Request 创建
    │
    ▼
┌─────────────────┐
│   LINT 检查      │  eslint, prettier
│   ↓ 通过         │
│   类型检查       │  tsc --noEmit
│   ↓ 通过         │
│   单元测试       │  jest/vitest
│   ↓ 通过         │
│   构建           │  npm run build
│   ↓ 通过         │
│   集成测试       │  API/数据库测试
│   ↓ 通过         │
│   E2E（可选）    │  Playwright/Cypress
│   ↓ 通过         │
│   安全审计       │  npm audit
│   ↓ 通过         │
│   Bundle 体积    │  bundlesize 检查
└─────────────────┘
    │
    ▼
  可以审查
```

**任何门禁都不可跳过。** Lint 失败就修 Lint — 不要禁用规则。测试失败就修代码 — 不要跳过测试。

## GitHub Actions 配置

### 基础 CI 管道

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: 安装依赖
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: 类型检查
        run: npx tsc --noEmit

      - name: 测试
        run: npm test -- --coverage

      - name: 构建
        run: npm run build

      - name: 安全审计
        run: npm audit --audit-level=high
```

### 数据库集成测试

```yaml
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: ci_user
          POSTGRES_PASSWORD: ${{ secrets.CI_DB_PASSWORD }}
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: 运行迁移
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
      - name: 集成测试
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://ci_user:${{ secrets.CI_DB_PASSWORD }}@localhost:5432/testdb
```

> **注意：** 即使是 CI 专用的测试数据库，也要使用 GitHub Secrets 管理凭据，而非硬编码。这能养成好习惯，防止测试凭据被意外复用到其他场景。

### E2E 测试

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: 安装 Playwright
        run: npx playwright install --with-deps chromium
      - name: 构建
        run: npm run build
      - name: 运行 E2E 测试
        run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## CI 失败反馈循环

CI 与 AI Agent 的强大之处在于反馈循环。当 CI 失败时：

```
CI 失败
    │
    ▼
复制失败输出
    │
    ▼
反馈给 Agent：
"CI 管道失败了，错误信息如下：
[粘贴具体错误]
修复问题并在本地验证后再推送。"
    │
    ▼
Agent 修复 → 推送 → CI 再次运行
```

**常见模式：**

```
Lint 失败   → Agent 运行 `npm run lint --fix` 并提交
类型错误    → Agent 读取错误位置并修复类型
测试失败    → Agent 按 debugging-and-error-recovery 技能排查
构建错误    → Agent 检查配置和依赖
```

## 部署策略

### Preview 部署

每个 PR 获得一个 Preview 部署用于手动测试：

```yaml
# PR 时部署 Preview（Vercel/Netlify 等）
deploy-preview:
  runs-on: ubuntu-latest
  if: github.event_name == 'pull_request'
  steps:
    - uses: actions/checkout@v4
    - name: 部署 Preview
      run: npx vercel --token=${{ secrets.VERCEL_TOKEN }}
```

### Feature Flag

Feature Flag 将部署与发布解耦。在 Flag 后面部署未完成或有风险的功能：

- **发布代码但不启用。** 尽早合并到 main，准备好再开启。
- **不用重新部署就能回滚。** 关闭 Flag 而非回滚代码。
- **金丝雀发布新功能。** 先对 1% 用户开放，再 10%，再 100%。
- **A/B 测试。** 对比有无该功能的行为差异。

```typescript
// 简单的 Feature Flag 模式
if (featureFlags.isEnabled('new-checkout-flow', { userId })) {
  return renderNewCheckout();
}
return renderLegacyCheckout();
```

**Flag 生命周期：** 创建 → 测试启用 → 金丝雀 → 全量发布 → 移除 Flag 和死代码。永久存在的 Flag 是技术债 — 创建时就定好清理日期。

### 分阶段灰度发布

```
PR 合并到 main
    │
    ▼
  Staging 部署（自动）
    │ 手动验证
    ▼
  生产部署（手动触发或 Staging 通过后自动）
    │
    ▼
  监控错误（15 分钟窗口）
    │
    ├── 检测到错误 → 回滚
    └── 正常 → 完成
```

### 回滚方案

每次部署都应可逆：

```yaml
# 手动回滚工作流
name: Rollback
on:
  workflow_dispatch:
    inputs:
      version:
        description: '要回滚到的版本'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: 回滚部署
        run: |
          # 部署指定的上一个版本
          npx vercel rollback ${{ inputs.version }}
```

## 环境管理

```
.env.example       → 已提交（开发者模板）
.env                → 不提交（本地开发）
.env.test           → 已提交（测试环境，无真实密钥）
CI secrets          → 存储在 GitHub Secrets / Vault
Production secrets  → 存储在部署平台 / Vault
```

CI 永远不应持有生产密钥。CI 测试使用独立的密钥。

## CI 之外的自动化

### Dependabot / Renovate

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
```

### Build Cop 角色

指定专人负责保持 CI 绿色。当构建失败时，Build Cop 负责修复或回滚 — 而非导致失败的人。这能防止在"别人会修的"的假设下，坏构建不断累积。

### PR 检查

- **必须审查：** 合并前至少 1 个 Approval
- **必须通过状态检查：** CI 必须通过才能合并
- **分支保护：** 禁止对 main 进行 force-push
- **自动合并：** 所有检查通过且已批准时，自动合并

## CI 优化

当管道超过 10 分钟时，按影响从大到小依次应用：

```
CI 管道太慢？
├── 缓存依赖
│   └── 使用 actions/cache 或 setup-node 的 cache 选项
├── 并行运行 Job
│   └── 将 lint、typecheck、test、build 拆分为独立并行 Job
├── 只运行变更相关的检查
│   └── 使用路径过滤跳过无关 Job（如纯文档 PR 跳过 E2E）
├── 矩阵构建
│   └── 将测试套件分片到多个 Runner
├── 优化测试套件
│   └── 将慢测试移出关键路径，改为定时运行
└── 使用更大的 Runner
    └── GitHub 大规格 Runner 或自托管 Runner
```

**示例：缓存 + 并行**
```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage
```

## 常见借口

| 借口 | 现实 |
|------|------|
| "CI 太慢了" | 优化管道（见上方 CI 优化），不要跳过它。5 分钟的管道能省下几小时的调试。 |
| "这个改动很小，跳过 CI 吧" | 小改动也会搞坏构建。而且小改动 CI 本来就很快。 |
| "这个测试是 Flaky 的，重跑就好" | Flaky 测试掩盖真实 bug，浪费所有人的时间。修掉它。 |
| "以后再加 CI" | 没有 CI 的项目会累积坏状态。第一天就搭建。 |
| "手动测试就够了" | 手动测试无法扩展，也不可重复。能自动化的就自动化。 |

## 危险信号

- 项目没有 CI 管道
- CI 失败被忽略或静音
- 为了让管道通过而禁用测试
- 生产部署不经过 Staging 验证
- 没有回滚机制
- 密钥存储在代码或 CI 配置文件中（而非密钥管理器）
- CI 运行时间很长但无人优化

## 验证清单

搭建或修改 CI 后确认：

- [ ] 所有质量门禁就位（lint、类型、测试、构建、审计）
- [ ] 管道在每个 PR 和 main 推送时运行
- [ ] 失败阻止合并（分支保护已配置）
- [ ] CI 结果反馈到开发循环
- [ ] 密钥存储在密钥管理器中，不在代码里
- [ ] 部署有回滚机制
- [ ] 管道在 10 分钟内完成测试套件
