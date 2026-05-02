# CI/CD 与自动化

## 角色定位

把质量门禁自动化，让每次变更都能被一致地构建、测试和验证。CI/CD 的目标不是堆检查，而是用最小可维护管道拦住真实风险。

## 何时使用

- 新建或修改 CI pipeline。
- 添加 lint、test、build、typecheck、安全扫描或发布门禁。
- 调试 CI 失败。
- 需要把本地验证提升成团队共享门禁。
- 部署、preview、release 或 rollback 流程需要自动化。

## 快速路径

1. 明确要防的风险：格式、类型、测试、构建、发布、供应链、回滚。
2. 先找现有 CI 文件和 package scripts，不重写整条流水线。
3. 设计最小门禁：install/cache -> lint/format -> typecheck -> test -> build。
4. 只在风险需要时增加 integration / E2E / security / bundle / deploy。
5. 本地先跑等价命令，再改 CI。
6. 对 CI 失败读取完整日志，定位失败阶段和根因。
7. 记录门禁语义：smoke、full verify、release check 不要混名。

## 最小可维护门禁

默认顺序：

```text
install/cache -> lint/format -> typecheck -> unit test -> build
```

升级门禁前必须说明：

- 它防什么风险。
- 运行成本和维护成本。
- 失败时谁能修、怎么修。
- 是否需要 secrets、服务依赖或浏览器环境。

## CI 失败处理

```text
CI failure loop:
1. Preserve log.
2. Identify failing job and command.
3. Reproduce locally when practical.
4. Fix root cause.
5. Run local proof.
6. Re-run CI / explain why CI is the remaining proof.
```

不要用跳过测试、禁用规则或放宽门禁来掩盖失败。确需降级门禁时，必须写明风险和恢复计划。

## 部署与发布门禁

发布管道至少要明确：

- 触发条件：PR、main、tag、manual approval。
- 环境：preview、staging、production。
- secrets 来源和最小权限。
- rollback 或 feature flag 策略。
- release 前后验证命令。

高风险发布优先使用小批次、preview、staging、feature flag 和可回滚路径，而不是一次性大改。

## 输出契约

```text
CI/CD plan:
- Risk addressed:
- Existing pipeline:
- Proposed gate:
- Commands:
- Secrets/services:
- Failure handling:
- Rollback:
- Verification:
```

推荐结论：

```text
Recommendation: <add / change / defer / remove gate> because <风险、成本和被放弃替代方案>。
```

如果新增门禁的维护成本高于它防住的风险，默认先不加。
