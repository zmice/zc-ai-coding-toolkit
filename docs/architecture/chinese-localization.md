# Spec: 中文化输出与 AI 引导适配

## Objective

在不影响实际功能执行、平台契约和文件格式要求的前提下，将仓库中的用户可见输出、文档引导和 AI 提示资产尽可能中文化。

目标用户：

- 直接使用 `zc` CLI 的中文用户
- 阅读仓库文档和平台产物的中文用户
- 使用 toolkit 提示资产与 AI 协作的中文用户

成功标准：

- 用户可见说明、错误提示、状态输出默认优先中文
- AI 面向最终用户的引导语默认优先中文
- 命令名、文件名、JSON 键、平台要求的固定字面量保持兼容，不因中文化破坏功能

## Commands

- 安装依赖：`pnpm install`
- 根级验证：`pnpm verify`
- 包级验证：
  - `pnpm --dir apps/cli test`
  - `pnpm --dir apps/cli build`
  - `pnpm --dir packages/toolkit verify`
- 发布检查：`pnpm changeset status`

## Project Structure

- `apps/cli/src/cli`
  - CLI 用户可见输出、帮助文案、错误信息
- `packages/toolkit/src/content`
  - skills / commands / agents 的正文与元数据
- `packages/platform-*`
  - 面向不同平台生成的模板与安装提示
- `README.md`
  - 仓库级说明
- `docs/architecture`
  - 长期保留的中文化规则与边界文档

## Code Style

```ts
console.log("平台安装完成。");
console.error("未找到团队状态，请确认名称是否正确。");
throw new Error("缺少必填参数：平台名称");
```

约定：

- 用户可见文本优先中文
- 必须保留的技术标识使用原文：如 `zc platform install qwen`
- 中英文混排时，中文负责解释，英文负责保留命令、路径、键名、平台名

## Testing Strategy

- 单元/集成测试：
  - 保持现有 `apps/cli`、`packages/toolkit`、`packages/platform-*` 验证链通过
- 文案回归检查：
  - 针对 CLI 输出和平台模板增加代表性断言
- 契约保护：
  - 文件名、导出路径、JSON 键、命令名、平台产物名不得因中文化变化

## Boundaries

- Always:
  - 中文化所有用户可见说明、帮助、状态提示、错误解释
  - 保持命令、参数、文件名、模板占位符、平台关键字稳定
  - 对“AI 应输出给用户看的内容”在提示资产中加入中文优先约束
- Ask first:
  - 是否引入双语输出模式
  - 是否修改外部平台 README/安装说明的默认语言
  - 是否对现有 meta 字段（如 `description`）进行大规模中文重写
- Never:
  - 修改命令名或子命令名为中文
  - 修改平台要求的固定产物名，如 `QWEN.md`、`AGENTS.md`、`qwen-extension.json`
  - 修改 JSON 键、schema 字段名、代码 API 标识符为中文

## Success Criteria

- `apps/cli` 中用户可见输出优先中文，英文仅保留在技术标识位
- `packages/toolkit` 中面向用户的 command/agent/skill 引导优先中文
- `packages/platform-*` 模板中对最终用户展示的说明优先中文
- `README.md` 与长期文档保持中文为主
- `pnpm verify` 继续通过
- `pnpm changeset status` 继续正常

## Open Questions

- 是否需要后续增加 `--lang zh|en` 之类的显式语言切换能力
- 是否要把 toolkit 中仍然偏英文的 skill 正文全部中文化，还是只优先处理用户入口与高频资产
