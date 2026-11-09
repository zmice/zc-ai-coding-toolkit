# 分发审计与评测完善记录

日期：2026-11-09。承接[统一执行方案](optimization-execution-plan-2026-11-06.md)与[最新上游梳理](content-adoption-review-2026-11-09.md)。本记录区分工具落地、宿主发现和模型行为，不把候选文案当作正式技能吸纳。

同日续办状态见 [Review 真实宿主对照记录](review-behavior-validation-2026-11-09.md)：已实现并实际运行 app-server 采集 adapter 和独立 Review 配方。以下“尚未完成 adapter”等表述是本记录第一次验收时的状态，新的行为结论、失败和限制以续办记录为准；全套 16 例与 no-skill 真实对照仍未执行。

## 本次落实

| 项目 | 结果 | 项目提升 |
| --- | --- | --- |
| 分发身份审计 D1 | 已实现 | 三份独立证据逐项比较，能发现总数相同但一漏一多、重复身份、模板泄露；版本或来源不一致、采集不完整时返回 inconclusive |
| 评测对照协议 E1 | 已实现 | baseline/candidate 之外可加入 no-skill；controlledSkills 定义被测技能，系统背景目录仍完整保留并要求一致，避免环境不同造成假结论 |
| 工作区验证接入 | 已实现 | test/verify 运行 fixtures 校验、评测判定器、catalog 预算与分发审计的确定性测试；不在 CI 自动调用模型 |
| Review/UI 内容 C1/C2 | 具体候选完成，未正式采用 | 已冻结 4 个原文件哈希、4 个 review 和 6 个 UI 验收条件，形成可实施文案和来源/许可要求；见[候选稿](content-adoption-candidates-2026-11-09.md) |

入口：`pnpm audit:distribution <evidence.json>`、`pnpm test:distribution`、`pnpm eval:skills validate`、`pnpm test:skill-evals`。输入及退出码见[分发审计](../../tests/skill-distribution/README.md)和[评测协议](../../tests/skill-evals/README.md)。

## 实际宿主发现验证

在独立 Codex home、项目和本地 marketplace 中生成并安装当前 compatibility 插件，由 Codex CLI 0.167.0 的 app-server `skills/list` 返回实际目录；initialize 返回的 codexHome 与隔离目录一致。不是只设置环境变量后假定隔离成立。

| 证据 | 结果 |
| --- | --- |
| 源码预期 / manifest / 宿主插件发现 | 71 / 71 / 71，三个方向均无 missing/extra |
| 实际缓存内容 | 71 个 SKILL.md 哈希均与当前生成物一致 |
| 来源标识 | `working-tree:sha256:184c8a15fba8c72d8db0284800fe035c256a02e7e9a41629de997c0836bd3428` |
| 消费端 | `codex-cli 0.167.0` |
| 完整性 | 发现返回无错误，目标插件技能均 enabled，路径均属于隔离 home |
| 宿主背景技能 | 另有 5 个系统技能，未混入 71 个插件身份统计 |
| 日常环境 | 用户 config 哈希前后一致；仅结束本次启动的 app-server，并卸载隔离插件/marketplace |

背景技能为 imagegen、openai-docs、review-agent、skill-creator、skill-installer，仅是本次观察，未硬编码到判定器。该观察推动增加 controlledSkills：无被测技能对照仍保留背景技能，三组背景目录必须相同。

本地原始证据位于忽略目录 `.cache/catalog-host-VxTgYm/`：`raw-discovery.json`、`audit-input.json`、`audit-result.json`、`receipt.json`；生成与采集脚本为 `.cache/capture-current-catalog.mjs`。这些是本次本机证据，不是随仓库分发的通用采集 adapter。审计器只验证输入契约，证据真实性仍需采集器和原始产物支撑。

## 验证与剩余工作

最终 fan-in 结果：

- `pnpm verify`：exit 0，包测试 394 passed / 1 skipped，评测/catalog/分发审计测试 28 passed，合计 **422 passed / 1 skipped**；唯一跳过仍是既有 Windows symlink 测试。日志：`.cache/verify-adoption-2026-11-09.log`。
- 16 个 fixture 静态结构校验通过；28 个脚本测试包含评测 12、catalog 6、分发审计 10。
- 当前真实宿主证据再次经 `node scripts/skill-distribution-audit.mjs .cache/catalog-host-VxTgYm/audit-input.json` 判定，exit 0，三个方向 missing/extra 均为空。
- 7 份文档的 54 个本地链接、11 个内容路径检查通过；4 个候选目标文件哈希仍与冻结基线一致。`git diff --check` 通过。
- 分发审计与对照协议均经只读审查。审查发现并修复：畸形 effectiveSkills 导致异常、缺少技能身份的加载事件导致 no-skill 假阳性；补充负例后复审关闭两项问题。未知原始事件仍可保留，已知事件缺必要字段则 inconclusive。

本次没有新增安装器或生成器改动，未重复发行物 smoke；11 月 8 日的 MVP 结果仅对应那轮运行时实现。不执行 release:check、提交或发布，也未修改用户未跟踪的 `apps/cli/AGENTS.md`。

尚未完成：真实模型任务的可信事件采集 adapter、旧/候选/无被测技能的行为对照、C1/C2 canonical 合入、桌面运行验收和发布。当前工具可以导入并检查实验记录，但不会发起模型任务，也不能认证人为提供的 host 事件。无对照收益数据时不声称技能变好或变快。

后续先用一个 review 用例完成可信采集和三次重复，再做 UI 用例；保持模型、权限、宿主版本、种子和背景目录一致。对于显式 `$skill` 任务，不使用 no-skill 条件。发现两版行为相同则记录无行为差异；不得以候选文字更长或更短代替收益证明。
