# Codex 更新与插件能力复核

日期：2026-11-06。范围：官方当前契约、PATH 中的 CLI、仓库适配实现；未升级 Codex、安装候选插件或改变用户配置。实施任务见 [执行方案](optimization-execution-plan-2026-11-06.md)。

## 结论与证据层级

插件能力确有扩展，项目需要补适配与验证，但现有兼容格式没有被宣布失效。优先解决状态判定，再验证 portable manifest 和 custom agent 加载；hooks、MCP、npm 分发暂作为按需扩展。

| 层级 | 本轮实证 | 能证明什么 |
| --- | --- | --- |
| 仓库 | HEAD `46defebca23c94fb8ef98fffcd06d3499243e9e8`，zc `0.11.1` | 本地代码基线；上一轮全量验证见总报告 |
| PATH CLI | `codex --version` → `codex-cli 0.156.0` | zc 调用到的 CLI 版本；不能替代桌面内嵌 runtime 版本 |
| 官方当前发布 | changelog 的 2026-11-06 条目为 CLI `0.167.0` | 官方已有更新；没有据此认定本机自动获得能力 |
| 官方插件状态 | `codex plugin list --marketplace zc-toolkit --json` → `zc-toolkit@zc-toolkit`、`0.11.1`、installed/enabled 均 true | 本机该 CLI 可枚举的安装状态 |
| zc 状态 | `node apps/cli/dist/cli/index.js platform plugin codex --status --json`，退出 0 | 官方命令可调用；汇总存在下述信息损失 |
| 桌面/模型行为 | 本轮未单独验证版本、加载、实际调用或模型设置 | 安装成功不能推导所有 skills/agents 已生效 |

CLI status 返回的 `source.path` 位于 marketplace staging；不能未经验证就把它称为实际执行缓存目录。当前 `available: []` 只表示这次没有取得候选版本，不能证明远端没有更新。CLI 直接调用还输出了沙箱临时 PATH alias 的权限 warning，但状态 JSON 和退出码均有效。

## 更新时间线

以下是与本项目有关的选择性核查，不是全部 release diff。来源：[官方 changelog](https://learn.chatgpt.com/docs/changelog)。

| 时间/版本 | 已核实变化 | 本项目处理 |
| --- | --- | --- |
| 2026-08-07 / 0.147.0 | 已加入 portable Agent Plugins 安装 | 相对 7 月 ADR 的新增能力；并非 0.167 才加入，也不必先全局升级才能开始兼容试验 |
| 2026-09-22 / 0.156.0 | 本机 CLI 对应版本 | 留作兼容基线 |
| 2026-10-29 / 0.166.0 | `doctor --network-only`；恢复/fork 的权限保留修复；changelog 包含省略 skill catalog 描述的选项 | 网络诊断可按版本探测；catalog 评测需记录宿主配置，不能假设所有描述必然进入上下文 |
| 2026-11-06 / 0.167.0 | TUI 从已安装插件加载 mentions；实验性系统代理设置等 | 补显式 mention 用例；不因新发布就修改系统代理或模型默认值 |

hooks 信任流程早于本次版本窗口已经存在。下表标记“当前官方支持”的项目，不统一声称它们刚刚发布；未追溯首发版本的字段保持未知。

## 当前能力与本地差距

官方包装契约来源：[Package your plugin](https://developers.openai.com/plugins/build/plugins)。

| 能力 | 当前官方契约 | 本地实现与决策 |
| --- | --- | --- |
| 可移植清单 | 根 `plugin.json` 为推荐入口；旧 `.codex-plugin/plugin.json` 仍兼容 | 当前只生成兼容清单。先增加可选双格式输出并隔离测试，不直接替换发布产物 |
| OpenAI overlay | 根 `extensions.com.openai` 存在时整体取代兼容 overlay，不合并 | 必须由同一 metadata 对象生成，测试字段不丢失、身份一致和无重复发现 |
| skills | portable 包固定 `skills/`；命名空间取插件稳定 name | 当前 commands 已转同名 skills，方向符合现契约；保持现有调用名 |
| onboarding | 可用 `onboardingSkill` 指向包内 skill | 可作为首次使用入口，需真实 setup 流程验证；不充当自动安装 companion 或授信脚本 |
| MCP | portable `mcp.json` 要声明 server transport；支持插件级工具策略 | 当前没生成，无现成需求则不加入；将来适配不能只把 `.mcp.json` 改名 |
| 分发来源 | marketplace 支持 local/Git/npm；npm 拉取不执行 lifecycle scripts | 现有 Git marketplace 继续使用；不为格式更新同时切分发渠道 |
| hooks | 手工安装的桌面插件可带 hooks；含 hooks 不符合公共目录提交要求 | 当前无 hooks 产物。维持默认纯内容包；有明确需求才做独立可选包 |

以上是格式/分发事实，不能推导每个客户端的相同能力。当前官方插件文档还有 Web/Work/CLI 等表面差异，必须记录测试所用 surface。

### Hooks 的采用条件

[Hooks 文档](https://learn.chatgpt.com/docs/hooks) 明确：插件 hooks 属于非 managed hooks，安装/启用插件不等于信任；定义或脚本变化后需要重新审阅。默认发现 `hooks/hooks.json`，显式配置会替代默认发现；脚本使用 `PLUGIN_ROOT` / `PLUGIN_DATA`，必须存在于执行环境。

若未来采用，只从无外部发送、可关闭的本地诊断场景验证，覆盖未信任、已信任、脚本更新、禁用、超时和 Windows 空格路径。不能把未运行 hook 当作检查通过，不能用 hook 绕过审批或自动执行持续学习/用户记忆写入。

### Custom agents：companion 仍需保留，但可以验证简化

[Subagents 文档](https://learn.chatgpt.com/docs/agent-configuration/subagents) 现在明确以 `~/.codex/agents/` 或项目 `.codex/agents/` 的 standalone TOML 定义角色，必需 `name`、`description`、`developer_instructions`；角色可配置模型/effort、收窄部分工具能力，但不能覆盖父会话 sandbox、approval、provider、MCP。

本地 `renderCodexAgentArtifacts` 已包含这三个必需字段；companion 还生成 `[agents.*]` 注册和默认模型。建议比较“仅 standalone 文件”和“现有注册+文件”两种路径，验证重名、优先级、旧 CLI 和卸载回执后，才决定是否减少 config 写入。保留现有角色模型，模型升级另用行为对照决定。

本地还会输出 `sandbox_mode`，不能把它展示成角色独立沙箱保证；其处理要兼容旧 host 并以父权限实测为准。官方 [Claude 插件迁移指南](https://developers.openai.com/plugins/guides/submit-claude-plugin) 要求公共提交中的 commands/agents 可复用行为转为 skills；这不等价于“所有本地插件 agents 都无效”，也没有证明包内 Markdown agents 能替代 TOML companion。

## 已定位的问题

| 优先级 | 源码证据 | 改进与验收 |
| --- | --- | --- |
| P1 | `apps/cli/src/cli/platform.ts:2048` 起提取版本/路径，未规范化 enabled；`:2107` 起生成结果 | 增加 installed/enabled/availability 的明确状态；缺失记录、disabled、JSON 形状异常不能被“检查完成”掩盖 |
| P1 | 本机 zc 输出 `availableVersion: null`、`updatePending: false` | 保留旧字段兼容，增加 `updateStatus: unknown` 及原因；有可比版本才能判 up-to-date/update-available |
| P1 | `packages/platform-codex/README.md:94` 的“不擅自重装”与 `platform.ts:1884` 起 upgrade 后执行 add 不一致 | 文案描述真实操作；隔离验证升级是否保留 enabled=false、身份与 companion 回执 |
| P2 | `platform.ts:1616` 起只探测 plugin add help，再回退旧 marketplace | 按操作探测 list JSON、available、upgrade；未知能力 fail clearly，避免推测所有子命令都存在 |
| P2 | `docs/adr/0004-codex-marketplace-first-runtime-boundary.md:27`、`:45` 仍把 commands 列为分发面 | 追加 dated amendment，说明 commands→skills、portable、companion 和 hooks 的边界 |

真实状态返回的 `cliResults` 仍保留 installed/enabled 原始值，因此不是数据完全丢失；问题是规范化结果和自动化判定契约不足。

## 本轮核验范围

- 只读 Codex 版本/help/list、zc status 均已执行；没有 marketplace refresh、install、upgrade、remove 或桌面重启。
- 官方页面已打开核查；Markdown 镜像访问失败时使用 HTML 正文，不把失败当作没有更新。
- `codex_capability_audit` 只读复核本地实现、测试和文档，主线程核对官方差异与实际 status；未修改代码。
- 当前只完成研究和方案细化，真实新版 host 兼容、hook 信任和 standalone agent 行为均留在执行方案验收项中。
