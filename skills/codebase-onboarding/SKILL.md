---
name: codebase-onboarding
description: Use when entering an unfamiliar codebase or starting work on a new project. Systematically explores project structure, identifies entry points, maps dependencies, and produces a concise project overview that serves as context for subsequent development tasks.
---

# Codebase Onboarding

## Overview

系统化地理解一个陌生代码库。通过四步流程快速建立对项目的全局认知，输出可作为后续开发上下文的项目概览。

**目标：在最短时间内，从"完全不了解"到"能有效贡献代码"。**

## When to Use

- 第一次接触一个代码库
- 加入一个新项目的开发
- 需要理解一个遗留系统以进行修改
- 为代码库生成上下文文档供 AI 代理使用
- 执行 `/onboard` 命令时

## 四步流程

### 步骤 1：目录结构扫描

**目标：** 建立项目的"地图"。

```
项目根目录
    │
    ├── 识别项目类型（前端/后端/全栈/库/CLI/移动端）
    ├── 识别构建系统（package.json / Cargo.toml / go.mod / pom.xml 等）
    ├── 识别目录约定（src/ vs lib/ vs app/，测试位置，配置位置）
    └── 识别关键配置文件（.env, docker-compose, CI 配置等）
```

**扫描清单：**
- [ ] 项目根目录的文件列表
- [ ] 主要源码目录结构（2-3 层深度）
- [ ] package.json / requirements.txt / go.mod 等依赖文件
- [ ] README 或项目文档
- [ ] CI/CD 配置
- [ ] Docker / 容器配置

### 步骤 2：入口点定位

**目标：** 找到"程序从哪里开始"。

根据项目类型定位入口点：

| 项目类型 | 典型入口点 |
|---------|-----------|
| Web 前端 | `index.html`, `main.tsx`, `App.tsx`, `pages/` |
| Node.js 后端 | `index.ts`, `server.ts`, `app.ts`, `main` in package.json |
| Python 后端 | `main.py`, `app.py`, `manage.py`, `wsgi.py` |
| Go 项目 | `main.go`, `cmd/` 目录 |
| Java 项目 | `Application.java`, `Main.java`, `@SpringBootApplication` |
| CLI 工具 | `bin/`, `cli.ts`, `__main__.py` |
| 库 | `index.ts`, `lib.rs`, `__init__.py`（导出的公共 API）|

**还需定位：**
- 路由定义（URL → 处理函数的映射）
- 数据库模型/Schema 定义
- 配置加载点

### 步骤 3：依赖关系图

**目标：** 理解模块之间如何协作。

```
分析要点：
├── 外部依赖 — 项目用了哪些第三方库？核心依赖是什么？
├── 内部模块 — 主要模块/包有哪些？各自职责是什么？
├── 数据流向 — 数据从哪里进入，经过哪些处理，到哪里输出？
└── 关键接口 — 模块间通过什么接口通信？
```

**重点关注：**
- 核心业务逻辑所在的模块
- 数据访问层（数据库、API 调用）
- 中间件 / 拦截器 / 管道
- 共享的工具函数和类型定义

### 步骤 4：架构模式识别

**目标：** 理解项目遵循的设计思想。

识别并记录：
- **架构模式** — MVC / 分层 / 微服务 / 单体 / 六边形 / CQRS
- **状态管理** — Redux / Zustand / Context / Vuex / 服务端 Session
- **错误处理模式** — 异常 / Result 类型 / 错误码 / 中间件
- **测试策略** — 测试框架、测试目录结构、Mock 策略
- **代码风格** — 命名约定、文件组织、注释风格

## 输出格式

生成项目概览文档：

```markdown
# 项目概览：[项目名称]

## 基本信息
- 项目类型：[前端/后端/全栈/库/CLI]
- 技术栈：[语言、框架、关键依赖]
- 构建工具：[构建系统和命令]
- 测试框架：[测试工具和运行命令]

## 目录结构
[关键目录及其用途，2-3 层]

## 入口点
- 应用入口：[文件路径]
- 路由定义：[文件路径]
- 数据模型：[文件路径]

## 核心模块
| 模块 | 位置 | 职责 |
|------|------|------|
| [名称] | [路径] | [一句话描述] |

## 数据流
[简要描述数据从输入到输出的主要路径]

## 架构模式
- 整体架构：[模式名称]
- 状态管理：[方案]
- 错误处理：[模式]

## 开发命令
- 安装依赖：[命令]
- 启动开发：[命令]
- 运行测试：[命令]
- 构建产物：[命令]

## 注意事项
[任何不明显但重要的项目约定或陷阱]
```

## 深度级别

根据需要调整探索深度：

| 级别 | 耗时 | 适用场景 | 输出 |
|------|------|---------|------|
| **快速** | 2-5 分钟 | 小型项目、快速了解 | 基本信息 + 目录结构 + 入口点 |
| **标准** | 10-15 分钟 | 中型项目、准备开发 | 完整概览文档 |
| **深度** | 20-30 分钟 | 大型/遗留项目 | 完整概览 + 模块详细分析 + 依赖图 |

## 与其他技能的衔接

- **context-engineering** — 生成的概览文档可作为上下文输入，提升后续任务质量
- **brainstorming-and-design** — 在陌生代码库上开始新功能前，先 onboard 再 brainstorm
- **spec-driven-development** — 理解现有架构后，规格编写更精准
- **context-budget-audit** — 概览文档的大小需要考虑上下文预算

## 最佳实践

- **先读 README** — 项目维护者写的文档通常比代码探索更高效
- **检查近期提交** — `git log --oneline -20` 揭示项目当前的活跃区域
- **找到测试** — 测试文件往往是理解模块行为的最佳文档
- **不要试图理解一切** — 聚焦与当前任务相关的部分
- **记录不确定项** — 标记需要进一步了解的地方，不要猜测

## Red Flags

- 跳过 onboarding 直接修改陌生代码
- 试图一次性理解整个代码库（应聚焦相关部分）
- 不读 README 和文档就开始探索代码
- 假设项目遵循"标准"模式而不验证
- 生成的概览文档过长（应保持简洁，概览而非详解）
