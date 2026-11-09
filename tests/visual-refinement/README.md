# Visual Refinement 验证

默认测试不调用模型、不启动浏览器、不安装可选依赖：

```powershell
pnpm test:visual-refinement
```

先构建 workspace，生成校验会读取平台包的 `dist`。`pnpm verify` 会按正确顺序执行构建与这些测试。

- `tools.test.mjs`：HTTP 路径边界、符号链接、临时目录所有权、参数、不覆盖输出、报告 URL 脱敏。
- `distribution.test.mjs`：四平台技能与附件逐字节校验，以及 Claude 当前不分发技能的边界。
- `behavior-cases.test.mjs`：独立输入与 oracle 的结构检查，不执行模型也不证明行为达标。

本地受限文件系统不能创建符号链接时，相应用例明确报告 skip。`CI` 已设置时这些权限错误仍会使测试失败，不降低持续集成的安全门禁。

## 手动工具集成

在已有 Playwright 的目录运行测试脚本的绝对路径；需要已安装的 Chrome/Chromium、ffmpeg 与 ffprobe。Chrome 可通过 `CHROME_PATH` 指定。

```powershell
node <repo>/tests/visual-refinement/browser-smoke.mjs --execute
```

它在 `.cache/visual-browser-*` 下创建自己拥有的输入、输出与临时目录，实际生成参考副本和 MP4，验证已有帧目录保留及启动失败、超时后的清理。`receipt.json` 固定源码哈希并记录结果。环境不允许浏览器或回环 HTTP 时保留失败结果，不自动申请提权。此检查只证明合成页面上的工具集成，不是产品视觉验收。

## 手动首轮行为对照

Windows 专项实验使用 [评测脚本](../../scripts/skill-evals-visual-study.mjs)，必须从仓库根运行并显式选择场景、臂和现有 Codex 可执行文件：

```powershell
node scripts/skill-evals-visual-study.mjs <case-id> <baseline|candidate> <absolute-codex.exe> --execute
```

场景见 [behavior-cases.json](behavior-cases.json)。它使用真实模型调用，创建隔离临时 home 和只读 fixture；在复制登录信息前执行拒读探针，失败就停止。临时登录副本在 `finally` 删除；强制终止可能绕过清理，需核查该次运行自己拥有的 `home/auth.json`。不要将凭据或原始宿主事件提交到仓库。

`complete` 仅说明调用结束，必须独立检查 oracle。首轮方案、静态改写、真实实现、浏览器验收与发布分别记账。本轮结果见 [行为记录](../../references/notes/visual-refinement-behavior-2026-11-09.md)与[实现记录](../../references/notes/visual-refinement-implementation-2026-11-09.md)。
