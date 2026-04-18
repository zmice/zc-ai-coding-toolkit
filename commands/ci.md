---
name: ci
description: 搭建或优化 CI/CD 管道，配置质量门禁、自动化测试和部署策略。
---

调用 ci-cd-and-automation 技能。搭建或优化项目的 CI/CD 自动化管道。

1. **质量门禁** — 配置 Lint → 类型检查 → 单元测试 → 构建 → 集成测试 → 安全审计
2. **CI 工作流** — 编写 GitHub Actions / GitLab CI 配置，PR 和 main 推送触发
3. **测试分层** — 单元测试（快速反馈）、集成测试（数据库/API）、E2E（可选）
4. **部署策略** — Preview 部署、Feature Flag、灰度发布、回滚方案
5. **CI 优化** — 缓存依赖、并行 Job、路径过滤、矩阵构建
6. **环境管理** — 密钥存储在 Secrets Manager，CI 不持有生产凭据

任何门禁都不可跳过。失败就修复，不要禁用规则或跳过测试。

## 使用方式

在 `/ci` 后描述你的 CI/CD 需求，我将根据项目情况配置管道或优化现有流程。

### 示例

```
# 从零搭建 CI
/ci 为这个 Next.js 项目搭建 GitHub Actions CI 管道，包含 lint、测试和构建

# 添加集成测试
/ci 给 CI 添加 PostgreSQL 集成测试，用 Prisma 做数据库迁移

# 优化慢管道
/ci CI 跑了 15 分钟太慢了，帮我优化（缓存、并行、路径过滤）
```
