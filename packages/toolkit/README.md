# @zmice/toolkit

`@zmice/toolkit` 是整个仓库的内容事实源。

它维护三类资产：

- `skills`
- `commands`
- `agents`

任何面向 AI 的内容改动，默认都应先落到这里，而不是平台包或根目录入口文件。

## 内容模型

每个资产目录使用：

- `meta.yaml`
- `body.md`
- 可选 `assets/`

关键治理字段包括：

- `tier`
- `audience`
- `stability`
- `source`
- `requires / suggests / conflicts_with / supersedes`

## 内容清单

### Commands

- `api`：API — 设计和审查 API 接口，确保一致性、易用性和向后兼容性。
- `build`：构建 — 按 TDD 的 Red-Green-Refactor 循环进行增量构建，确保每次只完成一个任务且系统始终可编译、可测试。
- `careful`：预警 — 激活 Careful 模式，AI 在执行任何危险命令前显示风险警告并要求确认。
- `ci`：CI/CD — 搭建或优化 CI/CD 管道，配置质量门禁、自动化测试和部署策略。
- `commit`：提交 — 引导规范化 Git 提交，确保原子提交、描述性消息和提交前检查。
- `ctx-health`：上下文 — 管理和刷新对话上下文，防止长会话质量下降，执行上下文健康检查并输出压缩摘要。
- `debug`：调试 — 使用系统化方法诊断和修复 Bug，遵循 Prove-It 模式：先复现，再定位，最后修复。
- `doc`：文档 — 生成项目文档或架构决策记录（ADR），确保知识可传递。
- `freeze`：锁定 — 锁定指定目录或文件，禁止 AI 编辑，保护关键文件不被意外修改。
- `guard`：防护 — 同时激活 Careful + Freeze 的组合防护，适用于操作生产环境，提供最高级别的安全保护。
- `idea`：想法 — 将模糊的想法或需求细化为具体、可执行的技术方案，通过结构化提问帮你理清思路。
- `learn`：学习 — 手动触发当前会话的模式提取与学习，分析观察数据，提取可复用的 instincts 并持久化。
- `migrate`：迁移 — 规划和执行代码迁移或 API 废弃，确保平滑过渡，不破坏现有功能。
- `onboard`：上手 — 系统化地理解陌生代码库，通过目录扫描、入口定位、依赖分析和模式识别快速建立全局认知。
- `perf`：性能 — 分析代码性能瓶颈并提供优化方案，从测量开始，用数据驱动优化决策。
- `plan-review`：方案评审 — 从产品、工程、设计、DevEx 多个角度评审 Spec/Plan，发现单一视角容易遗漏的问题。
- `product-analysis`：产品分析 — 将模糊需求收敛为可落地的执行方案，先明确价值、范围、验收标准，再决定是否进入完整交付。
- `qa`：浏览器质检 — 执行真实浏览器自动化 QA 测试，覆盖用户流程、交互、可访问性。
- `quality-review`：审查 — 对代码变更进行五维度系统化审查，输出结构化中文审查报告。
- `retro`：复盘 — 触发 Sprint 回顾，统计产出数据、总结决策效果、识别瓶颈、输出改进清单。
- `sdd-tdd`：工作流 — 启动完整的 SDD+TDD 开发流程，从需求分析到规格编写、任务拆解、TDD 增量构建和代码审查，全流程门控推进。
- `secure`：安全 — 对代码进行安全审计和加固，识别漏洞并提供修复方案。
- `ship`：发布 — 发布上线前的系统化检查清单，确保代码已准备好部署到生产环境。
- `simplify`：简化 — 分析代码并进行简化重构，降低复杂度，提升可读性和可维护性。
- `spec`：规格 — 先澄清需求与假设，再为给定的功能或场景编写结构化技术规格说明。
- `start`：开始 — 统一任务开始入口，先评估任务，再在 6 条固定 workflow 中选择合适的路线和默认入口。
- `task-plan`：计划 — 将需求或 Spec 拆解为可执行的原子任务列表，并标注依赖、上下文和验证步骤。
- `ui`：界面 — 前端 UI 开发辅助，涵盖组件设计、样式实现、响应式布局和可访问性。
- `verify`：验证 — 在声明工作完成之前运行验证命令确认实际状态，遵循“证据先于断言”铁律。

### Skills

- `api-and-interface-design`：API 与接口设计 — 指导稳定的 API 与接口设计，适用于模块边界、公共接口和前后端契约。
- `brainstorming-and-design`：方案探索 — 在创造性工作前先探索用户意图、需求和设计方向，再进入实现。
- `branch-finish-and-cleanup`：分支收尾与清理 — 在任务结束后统一处理 merge、PR、保留、丢弃和 worktree 清理。
- `browser-qa-testing`：浏览器质检 — 对运行中的应用执行真实浏览器 QA 测试，覆盖流程、视觉、可访问性和控制台网络监控。
- `ci-cd-and-automation`：CI/CD 自动化 — 用于构建或修改 CI/CD 管道、质量门禁和自动化部署流程。
- `code-review-and-quality`：代码审查与质量 — 在合并前做多维度代码审查，检查正确性、可读性、架构、安全和性能。
- `code-simplification`：代码简化 — 在不改变行为的前提下进行简化重构，降低不必要复杂度。
- `codebase-onboarding`：代码库导览 — 进入陌生代码库时快速建立全局认知并沉淀后续可复用的项目上下文。
- `context-budget-audit`：上下文审计 — 审计 agent、skills、rules 和说明文档对上下文窗口的占用，识别膨胀和冗余。
- `context-engineering`：上下文工程 — 优化会话上下文配置，适用于新会话、任务切换和输出质量下降时。
- `continuous-learning`：持续学习 — 基于 Hook 观察会话行为，提炼 instincts 并逐步演化为可复用的 skills 或 commands。
- `debugging-and-error-recovery`：调试与恢复 — 用系统化方法定位并修复根因，避免凭直觉试错。
- `deprecation-and-migration`：迁移与废弃 — 管理旧系统、旧 API 或旧功能的迁移与下线。
- `developer-experience-audit`：开发者体验审计 — 从 onboarding、安装链和首次成功路径出发，对真实 DevEx 做实测审计。
- `documentation-and-adrs`：文档与 ADR — 记录关键决策和长期文档，沉淀未来工程师和代理需要的上下文。
- `engineering-principles`：工程原则 — 在规格、实现、审查和验证前先校准工程行为原则。
- `frontend-ui-engineering`：前端界面工程 — 构建具备真实产品质感的前端界面、组件和布局。
- `git-workflow-and-versioning`：Git 工作流 — 规范提交、分支、冲突解决和多并行流组织方式。
- `idea-refine`：想法细化 — 通过结构化发散和收敛过程，在进入规格阶段前先把核心想法打磨清楚。
- `incremental-implementation`：增量实现 — 以薄切片循环持续交付变更，保持系统始终可运行、可验证。
- `multi-perspective-review`：多视角评审 — 在实现前从产品、工程、设计和开发者体验四个视角审视 Spec 或 Plan。
- `parallel-agent-dispatch`：并行调度 — 在多个独立任务可并行时，通过上下文隔离和结果汇总实现 fan-out/fan-in。
- `performance-optimization`：性能优化 — 在 profiling 或性能指标提示存在瓶颈时，用数据驱动方式优化性能。
- `planning-and-task-breakdown`：任务拆解 — 将规格或清晰需求拆成有依赖、有验证步骤的实现任务。
- `release-documentation-sync`：发布后文档同步 — 在发布后核对 README、升级说明和行为变更记录，避免文档 drift。
- `review-response-and-resolution`：审查响应与问题收敛 — 收到 review 反馈后分类问题、安排修复顺序并补充验证，直到问题收敛。
- `safety-guardrails`：安全护栏 — 在 AI 执行潜在破坏性操作时施加 Careful、Freeze、Guard 三种安全模式。
- `sdd-tdd-workflow`：SDD+TDD 工作流 — 编排从 Brainstorm 到 Commit 的完整开发生命周期，并带门控推进。
- `security-and-hardening`：安全加固 — 处理用户输入、认证、数据存储和外部集成时的安全风险与加固策略。
- `shipping-and-launch`：发布上线 — 为部署前检查、监控、灰度发布和回滚方案做准备。
- `source-driven-development`：官方文档实现 — 要求实现决策以官方文档为依据，避免凭记忆编码。
- `spec-driven-development`：规格驱动开发 — 在实现前先把需求收敛成结构化规格和验收标准。
- `sprint-retrospective`：迭代回顾 — 在开发周期结束后做结构化回顾，输出可执行改进项。
- `subagent-driven-development`：子代理驱动开发 — 在任务彼此独立时为每个任务派发全新子代理，并配套两阶段审查。
- `team-orchestration`：团队编排 — 使用 zc CLI 结合 tmux 和 git worktree 组织多个 AI CLI 并行协作。
- `test-driven-development`：测试驱动开发 — 先写失败测试，再让测试变绿，并在过程中持续重构。
- `using-agent-skills`：技能发现 — 在会话开始或不确定该用哪个 skill 时，负责发现、选择并调用合适技能。
- `verification-before-completion`：完成前验证 — 在声明完成、修复成立或结果通过前，先运行验证命令并读取输出。

### Agents

- `architect`：架构师 — 负责系统设计决策、技术选型评估、模块边界划分和架构权衡分析。
- `backend-specialist`：后端工程师 — 专注服务端实现模式、中间件设计、数据访问层、错误处理和缓存策略。
- `code-reviewer`：代码审查 — 在代码完成后进行七维度代码审查，并给出重构建议与 DX 评估。
- `frontend-specialist`：前端工程师 — 专注组件设计、状态管理、响应式布局、可访问性和前端性能优化。
- `performance-engineer`：性能工程师 — 专注性能剖析、瓶颈定位、优化方案设计和 benchmark 验证。
- `product-owner`：产品负责人 — 负责需求洞察、功能优先级、需求拆解和验收标准定义。
- `security-auditor`：安全审计 — 专注漏洞检测、威胁建模和安全编码实践。
- `test-engineer`：测试工程师 — 负责测试策略设计、测试编写和覆盖率分析。

## 命名模型

内容命名拆成三层：

- `source identity`
  - 对齐 upstream 原始对象
- `workspace identity`
  - 本仓库内部稳定 id
- `display title`
  - 面向用户展示的标题，当前默认中文优先

不要为了显示名去破坏 `source.origin_*` 与 upstream 的映射关系。

## 修改规则

- 内容源码只改 `src/content/`
- 不把平台产物回写成内容真相
- 内容改动默认配套更新治理字段和关系图
- 不要破坏 `source.upstream` 与 `references/upstreams.yaml` 的一致性

## 查询能力

当前 `zc toolkit` 支持：

- `lint`
- `show`
- `search`
- `recommend`

`<query>` 同时支持：

- 完整资产 ID，例如 `command:build`
- 唯一名称，例如 `build`

当前 `toolkit recommend` 已能返回：

- workflow family
- workflow role
- 推荐起始入口

## 内容层入口模型

当前统一任务开始入口在内容层，不在 CLI 层：

- `command:start`
- `command:product-analysis`

需要注意：

- `command:start` 是 canonical command，不是现成的 `zc start`
- `command:product-analysis` 是 `product-analysis` workflow 的默认入口
- `command:sdd-tdd` 只负责 `full-delivery` workflow

## 与其他层的关系

- `apps/cli` 读取 toolkit，但不拥有内容
- `packages/platform-*` 消费 toolkit 生成平台产物
- `references` 只做上游治理，不作为运行时内容真相

## 常用命令

```bash
pnpm --dir packages/toolkit test
pnpm --dir packages/toolkit build

node ../../apps/cli/dist/cli/index.js toolkit lint --json
node ../../apps/cli/dist/cli/index.js toolkit show <query>
node ../../apps/cli/dist/cli/index.js toolkit search <keyword>
node ../../apps/cli/dist/cli/index.js toolkit recommend <query>
```

## 进一步阅读

- [../../docs/architecture/toolkit-content-optimization.md](../../docs/architecture/toolkit-content-optimization.md)
- [../../docs/architecture/toolkit-naming-and-source-identity.md](../../docs/architecture/toolkit-naming-and-source-identity.md)
- [../../docs/architecture/workflow-entry-routing.md](../../docs/architecture/workflow-entry-routing.md)
