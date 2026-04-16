# 上游依赖版本记录

记录本工具包所依赖/参考的上游项目版本，便于后续迭代升级时对比变更。

> **升级流程**：对比本文件记录的 commit 与上游最新 commit 之间的 diff，评估需要同步的变更。
>
> ```bash
> # 示例：查看 agent-skills 自上次记录以来的变更
> git log --oneline bf2fa69..HEAD
> ```

## 核心上游

本工具包的技能体系基于此项目构建，升级时需重点关注。

| 项目 | Commit | 日期 | 分支 | 说明 |
|------|--------|------|------|------|
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `bf2fa6994407` | 2026-04-12 | main | 技能体系基础（20 Skills, 7 Commands） |

**本地缓存状态**：`.agent-skills-repo/` 目录已同步至上述 commit。

## 架构参考

这些项目提供了设计理念和架构启发，升级频率较低，按需对比即可。

| 项目 | Commit | 日期 | 分支 | 核心启发 |
|------|--------|------|------|---------|
| [obra/superpowers](https://github.com/obra/superpowers) | `c4bbe651cb1b` | 2026-04-15 | main | 两级审查模式、"角色即技能"哲学 |
| [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code) | `7eb7c598fba3` | 2026-04-14 | main | CL v2 Instinct 架构、Agent 膨胀反面教训 |
| [garrytan/gstack](https://github.com/garrytan/gstack) | `230006726732` | 2026-04-14 | main | 战略过滤器、"角色嵌入命令"哲学 |
| [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | `c9a44ae835fa` | 2026-04-16 | main | Karpathy LLM 行为矫正四原则、"先想后做"编码纪律 |

## 本工具包

| 字段 | 值 |
|------|------|
| 名称 | ai-coding-toolkit |
| 版本 | 1.3.1 |
| 组件 | 31 Skills, 25 Commands, 8 Agents |
| 记录日期 | 2026-04-16 |

## 升级检查清单

升级上游依赖时，按以下步骤操作：

1. **对比变更**：使用 GitHub Compare 查看 diff
   - `https://github.com/{owner}/{repo}/compare/{old_commit}...main`
2. **评估影响**：重点关注与本工具包定制部分重叠的文件
3. **同步变更**：合入有价值的改动，保留本地定制
4. **更新本文件**：将新的 commit hash 和日期更新到上方表格
5. **更新版本号**：如有必要，同步更新 `qwen-extension.json` 中的版本号
