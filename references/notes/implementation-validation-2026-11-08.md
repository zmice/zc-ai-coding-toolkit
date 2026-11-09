# 实施、Codex 升级与验收记录

日期：2026-11-08。承接 [执行方案](optimization-execution-plan-2026-11-06.md)，用户已授权处理完善及升级 Codex。工作树保留本轮变更，尚未提交、发布或同步 marketplace。原有未跟踪 `apps/cli/AGENTS.md` 未改动。

## 已落地的行为

| 切片 | 结果 | 当前边界 |
| --- | --- | --- |
| T1a 上游状态 | 新增 `report --with-remote --strict` 与 `collection_summary`；采集失败仍先输出报告，再非零退出；默认兼容 best-effort | 采集完整不代表审阅批准，source path 缺口单列 |
| T1b 插件状态 | 新增 installed/enabled/updateStatus/reason；无 available 版本显示 unknown；组合状态不把 disabled 当作完成 | 现有 updatePending 字段保留兼容；不要单独用 false 推断最新 |
| T1b 升级保护 | 升级前读取全局 installed，按完整 pluginId 检查；禁用、启用状态未知、同名身份不明时在变更前停止 | 官方 `plugin add` 仍会启用被禁用插件，保护由 zc 实施 |
| T2 评测基础设施 | 16 个 review/debug/build/UI fixtures、独立 oracle、事件导入判定器、三次重复对照汇总、静态 CI 接入 | 未提供真实模型 host adapter；没有把单元测试当作模型行为通过 |
| T3 portable 生成 | `generate --plugin-manifest-format portable` 可选增加根 plugin.json，兼容 overlay 同源生成；旧 root 清单冲突在写入前停止 | 默认仍 compatibility；发布产物未切换 |
| T4 catalog 审计 | 安装产物、目录 metadata、正文分别测量；可配置 namespace/path、描述截短或省略、字符预算和碰撞报告 | 只报 Unicode code points / UTF-8 bytes；不是 tokens 或宿主实际遗漏名单 |
| T6 文档 | 修正项目地图失效路径、更新 ADR0004 与 CLI/平台使用说明 | 发布前 release:check 尚未执行，本轮不发布 |

T5 内容优化仍保留原行为。Unslop 的 UI polish/no-op 分流、长正文裁剪及 review 细化均需要 T2 的真实 baseline/candidate 证据后采用；本轮没有直接安装或复制未审阅上游脚本，也没有修改 source identity 或批准新的 snapshot。

## Codex 升级与宿主证据

通过 npm 官方 registry 确认 stable 为 0.167.0，执行 `npm install -g @openai/codex@0.167.0 --registry=https://registry.npmjs.org`。PATH CLI 从 0.156.0 升为 **0.167.0**；`codex --version` 已核实。依据：[官方更新日志](https://learn.chatgpt.com/docs/changelog)、[CLI 文档](https://learn.chatgpt.com/docs/cli)。没有升级或重启 Desktop，不能推断其嵌入 runtime 随之变化。

| 验证 | 结果与证据 |
| --- | --- |
| 当前日常插件只读状态 | CLI 0.167.0；zc-toolkit 0.11.1，installed=true、enabled=true、available=[]；新 zc 报 updateStatus=unknown、reason=available-version-unknown |
| 当前 companion 只读状态 | `--status --with-agents` 报 overallStatus=partial、agents=needs-sync：10 个 agent 文件均 up-to-date，config.toml 为 drifted。日常配置未覆盖，不把插件启用等同于 companion 全部同步 |
| portable 本地生命周期 | 隔离 home/project，安装 0.0.1→刷新为 0.0.2→禁用→官方 add→卸载；15 步成功；日常 config hash 前后相同 |
| 官方禁用后 add 行为 | 实测 enabled 从 false 变 true，作为 zc 升级保护的依据 |
| 实际 skills 发现 | 独立 app-server 的 skills/list 返回 enabled 的 `zc-smoke:hello`，pluginId、cache 路径均指向隔离 home |
| Git marketplace 生命周期 | 通过本次构建的 zc 执行隔离安装、状态、Git upgrade；禁用后 zc upgrade 非零退出且配置 hash 不变；移除插件和 marketplace 成功，日常 config hash 不变 |
| standalone TOML 自动发现 | config/read 未给出有效 agents 记录；证据不足，不删除 companion、不声称角色模型或权限生效 |
| Desktop、旧 CLI、真实模型触发/任务执行 | not-run；当前本地加载验证不能代替这些维度 |

测试运行只使用仓库 `.cache/` 中的独立 home/project，未复制登录凭据。实际返回的插件 cache 路径及配置 hash 作为隔离证据。临时回执：`.cache/codex-host-DmNvsr/result.json`、同目录 `discovery.json`、`.cache/codex-git-yc8JSI/result.json`。这些为本机测试证据，不是发布资产。首次对 local marketplace 调用 Git upgrade 被宿主拒绝，随后改用本地 list/add 验证；Git upgrade 单独通过 Git 来源验证。

CLI 回退仅需重新安装已记录旧版本 `@openai/codex@0.156.0`，不依赖修改日常配置。本轮没有实际回退。平台生成默认格式保持不变；portable 候选可用独立空目录重新生成 compatibility 版本。

## 测量与验收

默认完整描述、无额外路径前缀的 Codex plugin catalog：71 个 skill，8754 个 Unicode code points、15750 UTF-8 bytes，完整描述重复 0。仅包含本项目生成的 skill metadata，不包含其他插件、宿主说明或实际模型 token 开销。CLI 示例：

```sh
node scripts/content-budget-audit.mjs --codex-plugin --json
node scripts/content-budget-audit.mjs --codex-plugin --description-chars 24 --catalog-budget-chars 8000 --json
node scripts/content-budget-audit.mjs --codex-plugin --omit-descriptions --catalog-path-prefix /test/cache/zc-toolkit --json
pnpm eval:skills validate
```

定向验证已通过：upstream 35 项、platform 88 项、Codex generator 17 项、评测 runner 8 项、catalog 6 项；16 个 fixture 静态校验通过。实现审查已修复并复核同名插件误匹配，以及评测 summary 信任导入 outcome 而未重新判定证据的问题。最终 fixture 复核还恢复了三类明确负例的误触发检查，并为 review 正例提供实际有缺陷的前后对照，避免无依据地要求产生 finding。

最终验证：

- `pnpm verify`：exit 0；包测试 394 passed / 1 skipped，加评测与 catalog 13 passed（当时共 407 passed）。唯一跳过为既有 Windows symlink 测试。首轮暴露新增参数未同步 CLI surface 预期，修正后完整重跑通过。
- 最终 fixture 小修后定向重跑 `node --test tests/skill-evals/runner.test.mjs scripts/content-budget-audit.test.mjs`：14/14 passed；`node scripts/skill-evals.mjs validate`：16/16 passed。运行时源码未再变化。
- `pnpm verify:mvp`：exit 0，`Workspace MVP verification passed`。
- CLI portable plan：包含根 `plugin.json` 和 `.codex-plugin/plugin.json`；离线上游 JSON smoke：collection_summary.status=not-requested。
- `git diff --check`：exit 0。验证日志留在 `.cache/verify-final-2026-11-08.log`、`.cache/verify-mvp-2026-11-08.log`。

仍未执行：真实模型 A/B、Desktop/旧 host 矩阵、角色实际 spawn 档位验证、T5 内容采用、发布前检查和发布。这些边界不会因上述静态或 CLI 测试通过而转为通过。
