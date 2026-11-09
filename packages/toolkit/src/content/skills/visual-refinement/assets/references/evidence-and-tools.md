# 整屏证据、参考副本与展示工具

来源：Damir Sokolovsky，`unslop` 的采集/展示流程，固定提交 `97daa3eb365670ea3f87ed85356cbfcee18105a5`，CC BY 4.0；本文改写了输入边界和验收要求。许可与变更声明见 [LICENSE-unslop.txt](LICENSE-unslop.txt)。

优先在真实应用中记录整屏、窄屏、关键状态、路由、数据、主题、语言、viewport 和时间。前后截图必须用同一条件；浏览器中另查 console、失败请求、主要交互、焦点、滚动、响应式与 reduced motion。截图不能替代真实行为。只有 URL 或本地 HTML 时可生成参考副本；只有截图时只能人工重建静态方案稿。这两种输入均不证明业务逻辑、权限或源码已恢复。

发行态工具路径（无 `assets/` 前缀）：

```text
node scripts/snapshot.mjs <url-or-local-file> <new-output-dir> [--width N --height N --dark|--light --timeout-ms N]
node scripts/story.mjs <story.html> <new-output-dir> [--wide --fps N --scale 1|2 --timeout-ms N]
```

两者支持 `--help` 和 `--check`，不会自动安装依赖；使用前先检查环境。snapshot 需要 Playwright 和 Chrome/Chromium，输出 `reference.html`、`source.png`、`report.json`。新输出目录必须不存在。它是**参考副本**，不是安全净化器，也不保证完全离线；核对资源失败、未内联链接、表单、Canvas、Shadow DOM 和运行态内容与现场的差异，不把不可信副本部署到受信任域名。

story 还需要 ffmpeg，输入单独的 story HTML，输出新目录中的 `story.mp4`、`report.json`。仅在需要展示改造过程时制作；展示 HTML/数据/动画不混入产品代码。工具没有 `--play` 契约。视频播放成功不代表产品验收通过。

## 运行与 story 格式

从已有 Playwright 的项目目录执行脚本的绝对路径；脚本同时尝试从自身目录查找依赖。Chrome 可用 `CHROME_PATH` 指定，或使用 Playwright 已安装的 Chromium。`--check` 只检查依赖和二进制，不启动浏览器，也不证明当前沙箱允许本地 HTTP。输出父目录应已存在；输出目录必须全新，失败报告也保留在该目录，重试用另一个目录。

story 使用自己编写、可信的独立 HTML。将它与必要素材放入专用目录，服务只开放该目录及内部普通文件；不要将包含凭据或无关文件的工程根当作素材目录。它仍会执行 HTML 的主动内容和外部请求，不是运行任意下载页面的安全沙箱。

最小三轮格式如下。每一轮将 `s1`、`s2`、`s3` 累计加到 `html`，因此后续样式需保留前轮结果。步骤名称决定展示标签；Spacing 和 Details 会启用对应测量效果。

```html
<!doctype html>
<meta charset="utf-8">
<meta name="unslop-steps" content="Spacing, Color, Details">
<meta name="unslop-frame" content="0 0 960">
<style>
  body { margin: 0; padding: 32px; font: 20px system-ui; }
  .panel { width: 800px; padding: 12px; background: #eee; border-radius: 28px; }
  .s1 .panel { padding: 24px; }
  .s2 .panel { background: #e4ede8; }
  .s3 .panel { border-radius: 12px; }
</style>
<section class="panel" data-radius><h1>真实产品标题</h1><p>真实内容或明确标注的演示数据</p></section>
```

`unslop-frame` 是源页面的 `x y width` 裁剪范围；视频默认正方形，`--wide` 为横版。可选标记：相邻块使用同名 `data-gap` 展示间距，`data-radius` 展示圆角，`data-slop` 标注待调整区域；`data-in="2"` / `data-out="2"` 表示第二轮出现／退出。文字更换使用 `.swap[data-at="2"]`，内部 `.from` 和 `.to` 承载前后文字。标记只是演示效果，不是产品缺陷判定。报告中的构图建议属于展示提示，可按页面目的取舍。

snapshot 报告会移除 URL 用户信息、query 和 fragment，但 HTML／图片仍可能含业务内容和主动链接。需要分享时单独检查产物，不将日志脱敏等同于整份快照脱敏。
