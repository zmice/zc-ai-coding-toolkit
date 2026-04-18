# AI Coding Toolkit

> 基于 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 构建的 **SDD+TDD 全流程 AI 编码工具包**，支持 Qoder、Qwen Code、Cursor 和 Codex。

## 核心特性

**三层架构，覆盖 AI 编码全流程：**

- **32 Skills（技能）** — 深度工作流引擎：SDD 规格驱动、TDD 测试驱动、CI/CD 自动化、Debug 系统化调试、安全加固、持续学习……每个 Skill 内置门控、阶段和检查点，模型自主触发
- **27 Commands（指令）** — 快捷启动器：`/sdd-tdd` `/spec` `/build` `/debug` `/quality-review` `/ci` `/commit` 等，一条斜杠命令驱动完整流程
- **8 Agents（智能体）** — 专家团：架构师、代码审查官、安全审计、测试工程师……按需切换，各司其职

核心工作流：**需求 → `/spec` 规格 → `/task-plan` 拆解 → `/build` TDD 实现 → `/quality-review` 审查**，每个阶段门控确认，杜绝跳步。

## 快速开始

### Qoder / Cursor（安装脚本）

```bash
# 克隆仓库
git clone https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git ai-coding
cd ai-coding

# 全局安装（Windows）
./install.ps1 -Global -Force

# 全局安装（Linux/Mac）
./install.sh --global --force

# 仅安装 Qoder（跳过 Cursor）
./install.ps1 -Global -QoderOnly -Force
```

### Qwen Code（扩展方式）

```bash
# 一键安装
qwen extensions install https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git

# 更新
qwen extensions update ai-coding-toolkit

# 卸载
qwen extensions uninstall ai-coding-toolkit

# 管理（查看/启用/禁用）
/extensions manage
```

### Codex（项目级 AGENTS.md）

```bash
# 克隆仓库
git clone https://codeup.aliyun.com/6892c510e5ba87aaf500637d/basic/ai-coding.git ai-coding
cd ai-coding

# 方式 1：安装脚本（推荐）
./install.ps1 -CodexProject /path/to/your/project          # Windows
./install.sh --codex-project /path/to/your/project          # Linux/Mac

# 方式 2：手动复制
cp AGENTS.md /path/to/your/project/AGENTS.md
```

项目级安装会将 `AGENTS.md` 复制到目标项目根目录，并将所有 Skills 部署到 `<project>/.codex/skills/` 目录。Codex 启动时自动读取 `AGENTS.md` 作为上下文。

安装完成后，Qoder/Qwen Code/Codex 会自动发现所有 Skills、Commands 和 Agents。

## 安装内容

### Qoder（安装脚本）

| 类型 | 数量 | 安装位置 |
|------|------|--------|
| Skills（技能） | 32 个 | `~/.qoder/skills/<name>/SKILL.md` |
| Commands（指令） | 27 个 | `~/.qoder/commands/<name>.md` |
| Agents（智能体） | 8 个 | `~/.qoder/agents/<name>.md` |
| Instructions（全局指令） | 1 个 | `~/.qoder/instructions.md` |
| Hooks（持续学习） | 4 事件 | `~/.qoder/hooks/continuous-learning/` |

### Qwen Code（扩展）

| 类型 | 数量 | 安装位置 |
|------|------|--------|
| Skills（技能） | 32 个 | `~/.qwen/extensions/ai-coding-toolkit/skills/` |
| Commands（指令） | 27 个 | `~/.qwen/extensions/ai-coding-toolkit/commands/` |
| Agents（智能体） | 8 个 | `~/.qwen/extensions/ai-coding-toolkit/agents/` |
| Context（上下文） | 1 个 | `QWEN.md`（自动加载到每个会话） |

### Codex（项目级安装）

| 类型 | 数量 | 安装位置 |
|------|------|--------|
| Skills（技能） | 32 个 | `<project>/.codex/skills/<name>/SKILL.md` |
| Context（上下文） | 1 个 | `<project>/AGENTS.md`（Codex 自动读取） |

### Skills vs Commands vs Agents

| 维度 | Skills（技能） | Commands（指令） | Agents（智能体） |
|------|---------------|-----------------|------------------|
| 触发方式 | 模型自主触发 / 手动 `/skill` | 用户在对话框输入 `/name` | 代码变更时自动触发 |
| 内容深度 | 完整工作流指导（门控、阶段、检查点） | 薄调度器（调用 Skill + 关键步骤引导） | 角色定义 + 专业行为准则 |
| 适用场景 | 深度开发任务（SDD/TDD/Debug 全流程） | 快速启动常见任务 | 审查、测试、安全审计 |
| 存储格式 | `SKILL.md`（目录结构） | `<name>.md`（单文件） | `<name>.md`（单文件） |

> **简单记忆**：**Skill** 是「深度教练」，**Command** 是「快捷启动器」，**Agent** 是「专家团成员」。

## 更新方式

### Qoder / Cursor

```bash
# 1. 拉取最新源码
cd ai-coding
git pull

# 2. 重新安装（覆盖更新）
./install.ps1 -Global -Force          # Windows
./install.sh --global --force          # Linux/Mac
```

### Qwen Code

```bash
qwen extensions update ai-coding-toolkit
```

### 更新说明

- **覆盖安装**：安装脚本只覆盖工具包自身的 Skills、Commands、Agents 和 `instructions.md`，不会影响 `~/.qoder/` 或 `~/.cursor/` 下其他自定义文件
- **版本规模**：当前体系包含 **32 Skills + 27 Commands + 8 Agents**，持续迭代中

---

## Qoder 最佳实践

### 一、开发模式选择

Qoder 提供三种主要交互模式，适用于不同场景：

#### 1. Agent 模式（智能体模式）— 主力开发模式

**适用场景：** 功能开发、Bug 修复、重构、任何需要修改代码的任务。

Agent 模式拥有完整的工具访问权限（文件读写、终端、搜索、浏览器等），是日常开发的主力模式。配合本工具包的 Skills，可以实现全流程自动化。

```
推荐用法：
┌─────────────────────────────────────────────────┐
│  你说: /sdd-tdd 实现用户登录功能，支持邮箱+密码   │
│                                                   │
│  Agent 自动执行:                                  │
│  1. /spec  → 写规格说明，列出假设，等你确认        │
│  2. /task-plan  → 拆解为可验证的任务列表，等你确认       │
│  3. /build → 逐个任务 TDD 实现（红→绿→重构）      │
│  4. /quality-review → 五维度代码审查                       │
└─────────────────────────────────────────────────┘
```

**日常开发提示词示例：**

```
# 新功能（完整流程）
/sdd-tdd 实现订单导出功能，支持 CSV 和 Excel 格式，需要分页查询避免内存溢出

# 只需规格（需求不清晰时）
/spec 我想做一个数据同步模块，从 A 系统定时拉取数据到 B 系统

# 直接编码（需求已明确）
/build 按照 spec.md 中的 Task 3，实现 UserService.updateProfile 方法

# Bug 修复
/debug 用户反馈：批量删除超过 100 条时接口超时，日志显示 SQL 查询耗时 30s

# 代码审查
/quality-review 检查最近的 git 变更，重点关注安全性和性能
```

#### 2. Plan 模式（规划模式）— 架构设计

**适用场景：** 大型重构、架构决策、技术选型、需求分析。

Plan 模式是**只读**的，不会修改任何文件，专注于思考和规划。适合在动手之前理清思路。

```
推荐用法：
你说: 我们的前端项目从 Vue 2 迁移到 Vue 3，涉及 200+ 组件，帮我规划迁移方案

Plan 模式输出:
→ 分析当前依赖关系
→ 识别高风险模块
→ 制定分阶段迁移计划
→ 评估每阶段工作量
→ 你确认后，切回 Agent 模式执行
```

**Plan 模式提示词示例：**

```
# 架构设计
帮我设计微服务拆分方案，当前是单体 Spring Boot 应用，日活 10w

# 技术选型
对比 Redis vs Caffeine 做本地缓存的优劣，结合我们的 Spring Boot 项目

# 重构规划
这个 2000 行的 God Class 怎么拆？先分析职责，再给拆分方案

# 需求分析
/spec 分析这个 PRD 文档，找出技术实现的歧义点和风险点
```

#### 3. Ask 模式（问答模式）— 知识咨询

**适用场景：** 代码解读、概念理解、方案咨询、快速问答。

Ask 模式同样是**只读**的，但更轻量。适合快速了解代码或技术问题。

```
推荐用法：
你说: 这个 ConcurrentHashMap 的 computeIfAbsent 在高并发下有什么坑？

Ask 模式: 直接回答，不操作文件
```

**Ask 模式提示词示例：**

```
# 代码解读
解释一下 src/auth/JwtFilter.java 的处理流程

# 概念理解
什么是 CQRS 模式？在我们这个项目里适合用吗？

# 快速查询
项目里哪些地方用了 @Transactional？有没有嵌套事务的风险？

# 方案咨询
接口幂等性通常怎么实现？推荐哪种方案？
```

#### 模式选择速查表

| 场景 | 推荐模式 | 原因 |
|------|---------|------|
| 开发新功能 | Agent + `/sdd-tdd` | 需要完整的规格→计划→编码→审查流程 |
| 修 Bug | Agent + `/debug` | 需要读写文件、运行测试 |
| 大型重构规划 | Plan | 先想清楚再动手，避免走弯路 |
| 技术选型讨论 | Plan | 只读分析，对比方案 |
| 代码审查 | Agent + `/quality-review` | 需要读取文件内容进行分析 |
| 快速问答 | Ask | 不需要操作文件，快速获取答案 |
| 理解陌生代码 | Ask | 只读解释，不修改 |

---

### 二、专家团模式（自定义智能体）

本工具包内置多个专家智能体，在 Qoder 设置中可切换：

| 智能体 | 角色 | 何时切换 |
|--------|------|---------|
| **product-owner** | 产品负责人 | 产品战略、需求拆解、用户故事、验收标准 |
| **architect** | 架构师 | 系统设计、技术选型、数据库架构、模块边界 |
| **code-reviewer** | 代码审查官 | 代码审查、重构建议、开发者体验评审 |
| **security-auditor** | 安全审计专家 | 处理认证/授权、用户输入、敏感数据时 |
| **test-engineer** | 测试工程师 | 需要写测试、评估覆盖率、设计测试策略 |
| **backend-specialist** | 后端专家 | 后端架构、API 实现、数据处理、服务端逻辑 |
| **frontend-specialist** | 前端专家 | 组件设计、响应式布局、无障碍、前端性能 |
| **performance-engineer** | 性能工程师 | 性能剖析、瓶颈定位、benchmark 验证 |

**使用方式：**

```
方式 1: 在 Qoder 右下角切换智能体（推荐常驻 Agent 模式 + 按需切换）
方式 2: 在默认 Agent 中直接用命令触发对应能力：
  → /quality-review  触发代码审查（等效于切换到 code-reviewer）
  → /secure  触发安全审计（等效于切换到 security-auditor）
```

**专家团协作示例：**

```
场景：开发一个支付接口

1. [默认 Agent] /sdd-tdd 实现支付宝支付回调接口
   → Agent 执行 Spec → Plan → Build(TDD) → Review

2. [切换 security-auditor] 审计刚才实现的支付回调，重点检查：
   - 签名验证是否严格
   - 是否存在重放攻击风险
   - 金额校验是否到位

3. [切换 test-engineer] 补充边界测试：
   - 签名篡改场景
   - 金额不一致场景
   - 并发重复通知场景

4. [切回默认 Agent] 根据审计和测试反馈修复问题
```

---

### 三、模型选择建议

| 任务类型 | 推荐模型 | 理由 |
|---------|---------|------|
| **复杂功能开发** | Claude Sonnet 4 / Claude Opus | 长上下文理解强，代码质量高，遵循指令好 |
| **日常编码** | Claude Sonnet 4 | 速度与质量的最佳平衡 |
| **快速问答/解释** | Claude Sonnet 4 | 响应快，足够准确 |
| **大型重构/架构** | Claude Opus | 复杂推理能力强，适合多文件关联分析 |
| **简单修改/格式化** | Claude Sonnet 4 | 无需大模型，速度优先 |

**模型使用原则：**

1. **默认用 Sonnet** — 90% 的任务 Sonnet 足够好，且更快更便宜
2. **复杂推理升级 Opus** — 跨文件重构、架构决策、难以定位的 Bug
3. **不要用模型补偿坏上下文** — 上下文质量比模型选择重要 10 倍
4. **观察质量下降信号** — 如果输出开始出现幻觉或偏离，先换会话再换模型

---

### 四、提示词最佳实践

#### 黄金法则：上下文质量 > 模型选择 > 提示词技巧

#### 1. 结构化需求（推荐格式）

```
## 背景
[简要说明业务上下文，1-2 句]

## 目标
[明确要实现什么，可测试的成功标准]

## 约束
- [技术约束：框架、版本、依赖]
- [业务约束：性能要求、兼容性]
- [不要做什么]

## 参考
- [相关文件路径]
- [类似功能的已有实现]
```

**示例：**

```
## 背景
我们的数据同步服务需要支持增量同步，目前只有全量同步，数据量大时太慢。

## 目标
实现基于时间戳的增量同步，只同步上次同步后变更的数据。

## 约束
- 使用已有的 Spring Boot + MyBatis 技术栈
- 需要兼容现有的全量同步，通过配置切换
- 单次同步数据量可能达到 100 万条，需要分批处理
- 不修改现有数据库表结构

## 参考
- 现有全量同步：src/main/java/com/xx/sync/FullSyncService.java
- 数据源配置：src/main/resources/application-sync.yml
```

#### 2. 渐进式交互（不要一次说太多）

```
❌ 错误：一次性丢出 2000 字需求
   → AI 容易遗漏细节，输出质量下降

✅ 正确：分阶段推进
   第 1 轮: /spec 简要描述需求 → AI 列出假设 → 你确认/修正
   第 2 轮: /task-plan → AI 拆解任务 → 你审核优先级
   第 3 轮: /build → 逐个实现 → 你验收每个切片
```

#### 3. 提供锚点（减少幻觉）

```
❌ "帮我写一个缓存工具类"
   → AI 可能瞎编 API，不符合你的项目风格

✅ "参考 src/utils/RedisHelper.java 的风格，实现一个本地缓存工具类，
    使用 Caffeine 库，需要支持过期时间和最大容量配置"
   → 有锚点文件 + 明确技术选型 + 具体功能要求
```

#### 4. 反馈要具体

```
❌ "不对，重写"
   → AI 不知道哪里不对，可能改对的地方

✅ "第 45 行的异常处理有问题：
    1. 不应该吞掉 SQLException，需要向上抛出
    2. 日志级别应该是 error 不是 warn
    3. 需要记录 SQL 语句便于排查"
   → 精确定位 + 具体原因 + 期望行为
```

#### 5. 用斜杠命令驱动（而非自然语言指挥流程）

```
❌ "先分析需求，然后拆任务，再一个个实现，最后做代码审查"
   → 容易跳过步骤或流程混乱

✅ /sdd-tdd 实现用户权限管理模块
   → 自动按门控流程推进，每个阶段等你确认
```

---

### 五、实战案例

#### 案例 1：从零开发一个功能

```
你: /sdd-tdd 实现文件上传功能，支持图片和 PDF，最大 10MB，
    需要压缩图片并生成缩略图，存储到 MinIO

Agent [/spec 阶段]:
  ASSUMPTIONS:
  1. 使用 Spring Boot + MinIO SDK
  2. 图片压缩使用 Thumbnailator
  3. 缩略图尺寸为 200x200
  4. 需要文件类型白名单校验
  → 确认这些假设吗？

你: 确认，补充一点：缩略图尺寸支持配置化

Agent [/task-plan 阶段]:
  Task 1: FileUploadController - 接收文件，校验类型和大小
  Task 2: ImageCompressService - 图片压缩和缩略图生成
  Task 3: MinioStorageService - 文件存储到 MinIO
  Task 4: 集成测试 - 完整上传流程验证
  → 确认任务划分？

你: OK，开始

Agent [/build 阶段]:
  [Task 1] 先写测试 → 实现 Controller → 测试通过 → 提交
  [Task 2] 先写测试 → 实现压缩服务 → 测试通过 → 提交
  ...
  [质量检查点] 4 个 Task 后执行 mini-review

Agent [/quality-review 阶段]:
  ✅ 正确性: 文件类型校验完整
  ⚠️ 安全性: 建议对文件名做 sanitize 防止路径遍历
  ⚠️ 性能: 大文件压缩建议异步处理
  → 修复建议 ...
```

#### 案例 2：定位和修复 Bug

```
你: /debug 生产环境报错：用户批量导入时偶尔出现
    "Duplicate entry for key 'uk_email'"，但导入的数据中没有重复邮箱

Agent [Stop-the-Line]:
  1. STOP — 不做任何其他修改
  2. 分析:
     - 检查 uk_email 唯一索引定义
     - 检查批量导入代码的并发处理
     - 检查是否有 retry 机制导致重复插入
  3. 定位根因: 批量导入使用 @Async，两个线程同时处理同一批数据
  4. 写复现测试（Prove-It Pattern）
  5. 修复: 加分布式锁 + 幂等校验
  6. 回归测试通过
```

#### 案例 3：代码审查

```
你: /quality-review 检查 PR #142 的变更，这是数据库分页查询优化

Agent [五维度审查]:
  ## 审查摘要
  **结论:** REQUEST CHANGES

  ### Critical
  - OrderMapper.xml:45 — SQL 注入风险，排序字段直接拼接 ${orderBy}
    → 修复: 使用白名单校验排序字段

  ### Important
  - PageHelper 配置缺少 reasonable=true，page=-1 会查全表
  - 缺少慢查询的单元测试

  ### 做得好的地方
  - 正确使用了覆盖索引避免回表
  - 分页参数校验完整
```

#### 案例 4：想法细化到落地

```
你: /idea 我想给我们的管理后台加一个操作审计日志功能

Agent [idea-refine]:
  让我帮你细化这个想法：

  1. 核心问题：为什么需要审计日志？
     → 合规要求？安全追溯？数据恢复？

  2. 关键决策：
     - 记录粒度：操作级 vs 字段级变更
     - 存储方案：同库表 vs 独立库 vs ES
     - 实现方式：AOP 拦截 vs 事件驱动

  3. 建议方案：
     [方案 A] AOP + 注解，轻量，快速落地
     [方案 B] 事件驱动 + 独立存储，可扩展，但复杂度高

你: 用方案 A，先快速落地

你: /sdd-tdd 基于方案 A 实现操作审计日志
   → 自动进入完整开发流程 ...
```

---

### 六、27 个命令速查

| 命令 | 用途 | 典型场景 |
|------|------|---------|
| `/sdd-tdd` | 完整开发流程 | 新功能、新项目 |
| `/spec` | 写规格说明 | 需求模糊时先理清 |
| `/task-plan` | 拆解任务 | 规格确认后拆解 |
| `/build` | TDD 编码 | 逐个任务实现 |
| `/quality-review` | 代码审查 | 合并前审查 |
| `/debug` | 系统化调试 | Bug、错误、异常 |
| `/verify` | 完成前验证 | 证据先于断言 |
| `/onboard` | 代码库入门 | 理解陌生项目 |
| `/ctx-health` | 上下文管理 | 长会话质量下降 |
| `/simplify` | 代码简化 | 重构复杂代码 |
| `/perf` | 性能优化 | 慢查询、大文件 |
| `/secure` | 安全加固 | 认证、输入、密钥 |
| `/api` | API 设计 | 新增接口 |
| `/doc` | 文档/ADR | 架构决策记录 |
| `/ship` | 发布上线 | 部署前检查 |
| `/ci` | CI/CD 管道 | 搭建、优化自动化管道 |
| `/commit` | 规范化提交 | 原子提交、描述性消息 |
| `/migrate` | 迁移废弃 | 替换旧系统 |
| `/ui` | 前端工程 | 组件、布局、交互 |
| `/idea` | 想法细化 | 模糊创意→具体方案 |
| `/retro` | Sprint 回顾 | 开发周期结束后回顾 |
| `/careful` | 危险命令预警 | 操作生产环境/关键资源 |
| `/freeze` | 文件/目录锁定 | 锁定关键文件防误改 |
| `/guard` | 全面防护模式 | careful + freeze 组合 |
| `/qa` | 浏览器 QA 测试 | 前端真实浏览器验证 |
| `/plan-review` | 多视角评审 | 产品/工程/设计/DevEx |
| `/learn` | 持续学习 | 提取模式、巩固本能 |

---

### 七、高效使用要点

1. **开新功能用 `/sdd-tdd`**，不要跳过 Spec 和 Plan 阶段
2. **复杂任务拆小**，每个对话聚焦一个明确目标
3. **提供锚点文件**，减少 AI 幻觉（"参考 xxx 文件的风格"）
4. **及时开新会话**，感觉质量下降时果断重开
5. **用命令驱动流程**，不要用自然语言指挥复杂流程
6. **反馈要具体**，说清楚哪里不对、为什么不对、期望什么
7. **审查偏差日志**，不要逐行审查 AI 生成的代码
8. **信任工具链**，类型检查和 lint 比肉眼可靠

---

## zc CLI — 多 AI CLI 团队编排运行时

> **让多个 AI CLI 组队干活。** 将 Codex、Qwen Code 等 AI 编码工具编排为协作团队，并行处理开发任务。

| 特性 | 说明 |
|------|------|
| 🤖 多 CLI 适配 | 统一适配 Codex CLI、Qwen Code，通过适配器层无缝切换 |
| 🚀 任务并行编排 | 多 Worker 并行执行，自动分派、状态追踪、失败回滚 |
| 🧠 智能技能匹配 | 关键词（中英文）/ AI 智能匹配 / 手动指定三种模式 |
| 🌿 Worktree 隔离 | 每个 Worker 在独立 git worktree 中执行，互不干扰 |
| 💬 团队消息通信 | 内置 Mailbox，Worker 间实时消息传递与广播 |

### 安装

```bash
# npm 全局安装（推荐）
npm install -g @zmice/zc

# 验证
zc --version
zc doctor
```

<details>
<summary>从源码安装</summary>

```bash
git clone <repo-url>
cd ai-coding/zc
npm install && npm run build
npm link
```

</details>

### 快速上手

```bash
# 单任务运行
zc run "实现用户注册功能"

# 启动团队 — 2 个 Worker 并行处理
zc team start -w "w1:codex,w2:qwen-code" -t "实现登录API" -t "编写登录页面"

# 查看状态 / 发送消息 / 关闭团队
zc team status <name>
zc msg send w1 "优先处理API端点"
zc team shutdown <name>
```

### 系统要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20 | 运行时环境 |
| git | 任意 | Worktree 隔离执行 |
| tmux | 任意 | 团队模式会话管理（macOS / Linux / WSL） |

> 完整文档见 [`@zmice/zc` README](./zc/README.md)

---

## 目录结构

```
ai-coding/
├── skills/                           # 32 个 Skill（Qoder 原生格式）
│   ├── sdd-tdd-workflow/SKILL.md     # 整合入口（25 个命令）
│   ├── spec-driven-development/      # /spec
│   ├── planning-and-task-breakdown/  # /task-plan
│   ├── incremental-implementation/   # /build
│   ├── test-driven-development/      # /build (TDD)
│   ├── code-review-and-quality/      # /quality-review
│   ├── context-engineering/          # /ctx-health
│   ├── debugging-and-error-recovery/ # /debug
│   ├── code-simplification/          # /simplify
│   ├── performance-optimization/     # /perf
│   ├── security-and-hardening/       # /secure
│   ├── api-and-interface-design/     # /api
│   ├── documentation-and-adrs/       # /doc
│   ├── shipping-and-launch/          # /ship
│   ├── ci-cd-and-automation/         # /ci
│   ├── deprecation-and-migration/    # /migrate
│   ├── frontend-ui-engineering/      # /ui
│   ├── idea-refine/                  # /idea
│   ├── sprint-retrospective/         # /retro
│   ├── safety-guardrails/            # /careful /freeze /guard
│   ├── browser-qa-testing/           # /qa
│   ├── multi-perspective-review/     # /plan-review
│   ├── continuous-learning/          # /learn（Hook 驱动持续学习）
│   ├── git-workflow-and-versioning/  # /commit + Git 纪律
│   ├── source-driven-development/    # 基于官方文档的实现规范
│   └── using-agent-skills/           # 技能发现元规则
├── agents/                           # 8 个自定义智能体
│   ├── architect.md
│   ├── backend-specialist.md
│   ├── code-reviewer.md
│   ├── frontend-specialist.md
│   ├── performance-engineer.md
│   ├── product-owner.md
│   ├── security-auditor.md
│   └── test-engineer.md
├── instructions.md                   # 全局指令（Qoder）
├── QWEN.md                           # 全局指令（Qwen Code 扩展上下文）
├── qwen-extension.json               # Qwen Code 扩展清单
├── AGENTS.md                            # 全局指令（Codex 项目级上下文）
├── install.ps1                       # Windows 安装脚本（Qoder/Cursor）
├── install.sh                        # Linux/Mac 安装脚本（Qoder/Cursor）
└── .gitignore
```

## 致谢与参考

本工具包基于 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 构建，角色体系设计参考了以下标杆项目：

| 项目 | 核心启发 |
|------|---------|
| [obra/superpowers](https://github.com/obra/superpowers) | 两级审查模式（Deep/Quick Review）、"角色即技能"哲学 |
| [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | Continuous Learning v2 Instinct 架构、Agent 膨胀反面教训 |
| [garrytan/gstack](https://github.com/garrytan/gstack) | 战略过滤器、"角色嵌入命令"哲学 |
| [Daz - How I Work with AI Coding Agents](https://daz.is/blog/how-i-work-with-ai-coding-agents/) | 三阶段审查、40% 法则等实践 |

> 各上游项目的版本追踪详见 [UPSTREAM.md](UPSTREAM.md)，升级时请参照其中的检查清单。
