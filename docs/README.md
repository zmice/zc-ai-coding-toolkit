# Docs Guide

`docs/` 只保留长期有效、值得在 GitHub 仓库中持续阅读的文档。

它不是：

- 一次性任务计划堆放区
- 冲刺过程记录区
- 临时讨论草稿区

## 目录说明

### `docs/usage-guide.md`

面向使用者的长期说明：

- 如何安装和更新 `zc`
- 如何给不同平台安装内容
- 如何查看安装状态和执行更新

### `docs/release-guide.md` / `docs/release-checklist.md`

面向维护者的发布文档：

- 发版前检查
- 版本提升
- 发布流程

### `docs/adr/`

架构决策记录：

- 为什么这样设计
- 为什么拒绝另一些设计

### `docs/architecture/`

长期技术和治理文档，例如：

- monorepo 分层
- 平台能力矩阵
- 命名与来源追溯
- workflow 路由
- 上游治理
- 中文化规则

## 新增文档前先问

这份文档在 3 个月后是否仍值得阅读？

- 如果答案是“是”，可以进入 `docs/`
- 如果答案是“否”，不要放进仓库长期文档层

## 推荐阅读顺序

### 对使用者

1. [README.md](../README.md)
2. [usage-guide.md](usage-guide.md)
3. [apps/cli/README.md](../apps/cli/README.md)

### 对贡献者

1. [README.md](../README.md)
2. [../CONTRIBUTING.md](../CONTRIBUTING.md)
3. [architecture/project-context.md](architecture/project-context.md)

### 对维护者

1. [release-guide.md](release-guide.md)
2. [release-checklist.md](release-checklist.md)
3. [architecture/platform-capability-matrix.md](architecture/platform-capability-matrix.md)
4. [architecture/release-versioning.md](architecture/release-versioning.md)
