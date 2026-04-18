# @zmice/platform-qoder

`@zmice/platform-qoder` 会从 `@zmice/toolkit` 生成并安装面向 Qoder 的工件。

当前输出包括：

- `instructions.md`

此包是平台适配层，提示词内容仍由 `@zmice/toolkit` 维护。

常见用法：

- `zc platform install qoder`
- `zc platform install qoder --plan --format json`

省略 `-o` 时，CLI 会优先把最近项目根解析为安装目录。
