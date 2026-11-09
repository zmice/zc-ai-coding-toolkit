// Adapted from heydamir/unslop (97daa3e), CC BY 4.0.
// Changes: bounded CLI, confined HTTP service, isolated frames, and cleanup.
// Attribution and license: ../references/LICENSE-unslop.txt
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { browserKit, chromePath, createFrameWorkspace, createStoryServer, intOption } from "./runtime.mjs";

const usage = "usage: node story.mjs <story.html> <new-output-dir> [--wide --fps N --scale 1|2 --timeout-ms N]; node story.mjs --check";
function parseArgs(argv) {
  if (argv.length === 1 && ["--help", "--check"].includes(argv[0])) return { mode: argv[0] };
  const positional = [];
  const options = { wide: false, fps: 30, outputScale: 1, timeoutMs: 180000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--wide") { options.wide = true; continue; }
    const match = /^--(fps|scale|timeout-ms)(?:=(.*))?$/.exec(arg);
    if (match) {
      const raw = match[2] ?? argv[++i];
      if (raw === undefined) throw new Error(arg + " requires a value");
      const [min, max] = { fps: [1, 60], scale: [1, 2], "timeout-ms": [1000, 600000] }[match[1]];
      const value = intOption(arg, raw, min, max);
      options[{ fps: "fps", scale: "outputScale", "timeout-ms": "timeoutMs" }[match[1]]] = value;
    } else if (arg.startsWith("-")) throw new Error("unknown option: " + arg);
    else positional.push(arg);
  }
  if (positional.length !== 2) throw new Error(usage);
  return { ...options, input: positional[0], outDir: resolve(positional[1]) };
}
function checkFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { timeout: 3000, windowsHide: true, stdio: "ignore" });
  if (result.error || result.status !== 0) throw new Error("ffmpeg missing or unavailable");
}
function report(outDir, data) { writeFileSync(join(outDir, "report.json"), JSON.stringify(data, null, 2) + "\n"); }
async function main() {
const args = parseArgs(process.argv.slice(2));
if (args.mode === "--help") { console.log(usage); return; }
if (args.mode === "--check") {
  const kit = await browserKit();
  if (!kit.chromium) throw new Error("Playwright Chromium API unavailable");
  const chrome = chromePath() ?? kit.chromium.executablePath();
  if (!chrome || !existsSync(chrome)) throw new Error("Chromium binary unavailable");
  checkFfmpeg();
  console.log(JSON.stringify({ playwright: true, ffmpeg: true, chromePath: chrome }));
  return;
}
const { input, outDir, wide, fps, outputScale, timeoutMs } = args;
if (existsSync(outDir)) throw new Error("output directory already exists");
const file = realpathSync(input);
if (!statSync(file).isFile() || statSync(file).size > 4_000_000 || !/\.html?$/i.test(file)) throw new Error("story must be HTML up to 4 MB");
const root = dirname(file);
const html = readFileSync(file, "utf8");
const warnings = [];
const warn = (message) => { warnings.push(message); console.warn("warning: " + message); };
// A meta tag is valid HTML whatever order its attributes are in and
// whichever quotes they use, so read the tag first, then its attributes.
const meta = (name) => {
  for (const [, attrs] of html.matchAll(/<meta\s+([^>]*)>/gi)) {
    const get = (attr) =>
      new RegExp(`(?:^|\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
        .exec(attrs)
        ?.slice(1)
        .find((value) => value !== undefined);
    if (get("name")?.toLowerCase() === name) return get("content");
  }
  return undefined;
};
const steps = (meta("unslop-steps") ?? "")
  .split(",")
  .map((step) => step.trim())
  .filter(Boolean);
if (steps.length === 0 || steps.length > 9 || steps.some((step) => step.length > 80)) throw new Error("unslop-steps must list 1 to 9 steps of at most 80 characters");
const frameRaw = meta("unslop-frame") ?? "0 0 960";
const frame = frameRaw.split(/\s+/).filter(Boolean);
const [frameX, frameY, frameWidth] = frame.map(Number);
if (frame.length !== 3 || frame.some((value) => !Number.isFinite(Number(value))) || frameWidth < 100 || frameWidth > 3000 || Math.abs(frameX) > 5000 || Math.abs(frameY) > 5000) throw new Error("unslop-frame must be x y width, width 100..3000 and coordinates within 5000");
const count = (pattern) => html.match(pattern)?.length ?? 0;
const swaps = count(/class="(?:[^"]*\s)?swap(?:\s[^"]*)?"/g);
if (swaps > 8) warn(`${swaps} swaps, use swaps sparingly, only where the words change, at most eight in a story`);
if (/border-radius\s*:[^;}"]*\b9{3,4}px/i.test(html)) warn("pills: write their radius as half the height, like 23px, not 9999px, or the corner only changes in the last frame");
if (/\b100vh\b/i.test(html)) warn("the story page renders 1440 wide and at least 900 tall, so do not size things from 100vh");
const slops = count(/\sdata-slop\b/g);
if (slops > 5) warn(`${slops} data-slop marks, at most five, on the clearest examples that sit apart from each other`);
const radii = count(/\sdata-radius\b/g);
if (radii && (radii < 2 || radii > 4)) warn(`${radii} data-radius marks, data-radius goes on two to four buttons and cards whose corners change`);
const stacks = new Map();
for (const [, name] of html.matchAll(/\sdata-gap(?:\s*=\s*"([^"]*)")?/g)) stacks.set(name || "main", (stacks.get(name || "main") ?? 0) + 1);
stacks.forEach((blocks, name) => {
  if (blocks < 5 || blocks > 7) warn(`data-gap="${name}" has ${blocks} blocks, ${blocks - 1} gaps, aim for four to six measured gaps per stack`);
});
const kindOf = (text) => (/spac/i.test(text) ? "spacing" : /detail|radius|corner/i.test(text) ? "details" : null);

const FRAME = wide ? { width: 1920, height: 1080 } : { width: 1080, height: 1080 };
const PAGE_WIDTH = 1440;
const MARGIN = 72;
const scale = (FRAME.width - MARGIN) / frameWidth;
const offsetX = MARGIN / scale - frameX;
const offsetY = MARGIN / scale - frameY;
const padLeft = Math.max(0, offsetX);
const padTop = Math.max(0, offsetY);
const left = Math.min(0, offsetX) * scale;
const top = Math.min(0, offsetY) * scale;
const pageWidth = Math.max(PAGE_WIDTH + padLeft, Math.ceil((FRAME.width - left) / scale) + 2);
const padRight = pageWidth - PAGE_WIDTH - padLeft;
const pageHeight = Math.max(900 + padTop, Math.ceil((FRAME.height - top) / scale) + 2);

const stage = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: ${FRAME.width}px; height: ${FRAME.height}px; overflow: hidden; background: #111; }
  #story-layer { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
  #story-layer > * { position: absolute; }
  #story-layer .s-fade { opacity: 0; transition: opacity 240ms ease; }
  #story-layer.s-on .s-fade { opacity: 1; }
  #story-layer .s-x { transform: scaleX(0); transition: transform 520ms cubic-bezier(0.65, 0, 0.35, 1), background-color 300ms ease; }
  #story-layer .s-y { transform: scaleY(0); transition: transform 520ms cubic-bezier(0.65, 0, 0.35, 1), background-color 300ms ease; }
  #story-layer.s-on .s-x { transform: scaleX(1); }
  #story-layer.s-on .s-y { transform: scaleY(1); }
  #story-layer .s-tag { font: 500 15px/30px ui-monospace, "Geist Mono", "SF Mono", Menlo, monospace; height: 30px; padding: 0 12px; border-radius: 999px; white-space: nowrap; color: #fff; background: #ff4d6a; font-variant-numeric: tabular-nums; transition: opacity 220ms ease 100ms, background-color 300ms ease, color 300ms ease; }
  #story-layer.s-fixed .s-tag { background: #f5f5f5; color: #111; }
  #story-layer .s-ink { background: #ff4d6a; }
  #story-layer .s-hair { background: rgba(255,77,106,0.55); }
  #story-layer .s-fill { background: rgba(255,77,106,0.1); }
  #story-layer.s-fixed .s-ink { background: rgba(255,255,255,0.92); }
  #story-layer.s-fixed .s-hair { background: rgba(255,255,255,0.24); }
  #story-layer.s-fixed .s-fill { background: rgba(255,255,255,0.05); }
  #story-layer .s-box { border: 1.5px solid #ff4d6a; background: rgba(255,77,106,0.07); transform: scale(1.03); transition: opacity 220ms ease, transform 260ms ease, border-color 300ms ease, background-color 300ms ease; }
  #story-layer.s-on .s-box { transform: scale(1); }
  #story-layer.s-fixed .s-box { border-color: rgba(255,255,255,0.92); background: rgba(255,255,255,0.04); }
  #story-layer .s-corner { width: 8px; height: 8px; background: #fff; border: 1px solid #ff4d6a; }
  .credit { position: absolute; right: 28px; bottom: 24px; z-index: 20; padding: 7px 12px; border-radius: 999px; font: 500 15px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0.01em; color: rgba(255,255,255,0.86); background: rgba(12,12,14,0.62); box-shadow: 0 0 0 1px rgba(255,255,255,0.1); backdrop-filter: blur(8px); }
  iframe { position: absolute; left: ${left}px; top: ${top}px; border: 0; width: ${pageWidth}px; height: ${pageHeight}px; transform-origin: 0 0; transform: scale(${scale}); background: transparent; }
</style></head><body>
  <iframe id="page" src="/__story/${encodeURIComponent(file.slice(root.length + 1))}"></iframe>
  <div id="story-layer"></div>
  <div class="credit">unslop by @heydamir · adapted</div>
  <script>
    window.__stage = { conf: { scale: ${scale}, x: ${left}, y: ${top} } };
  </script>
</body></html>`;

const runtime = `
(() => {
  const red = "#ff4d6a";
  const spring = "cubic-bezier(0.3, 1.12, 0.45, 1)";
  const ease = "cubic-bezier(0.45, 0, 0.2, 1)";
  const layout = ["padding", "margin", "gap", "row-gap", "column-gap", "width", "height", "min-width", "min-height", "max-width", "max-height", "top", "right", "bottom", "left", "inset", "font-size", "line-height", "letter-spacing", "font-weight", "transform", "translate", "scale", "rotate", "border-width", "outline-width", "flex-basis", "grid-template-columns", "grid-template-rows"];
  const tint = ["color", "background-color", "border-color", "outline-color", "fill", "stroke", "stroke-dashoffset", "stroke-width", "box-shadow", "text-shadow", "border-radius", "opacity", "filter", "backdrop-filter", "clip-path", "text-decoration-color", "-webkit-text-fill-color"];
  const transition = [...layout.map((p) => p + " 700ms " + spring + " var(--wave, 0ms)"), ...tint.map((p) => p + " 900ms " + ease + " var(--wave, 0ms)")].join(", ");
  const rise = "cubic-bezier(0.17, 0.84, 0.44, 1)";
  const steps = ${JSON.stringify(steps)};
  let css = \`
    :root { interpolate-size: allow-keywords; }
    html.story-live *, html.story-live *::before, html.story-live *::after { transition: \${transition} !important; }
    .swap { display: inline-grid; justify-items: start; align-items: start; vertical-align: top; overflow: visible; }
    div.swap, p.swap, h1.swap, h2.swap, h3.swap, li.swap { display: grid; }
    .swap > .from, .swap > .to { grid-area: 1 / 1; }
    .swap > .to { opacity: 0; pointer-events: none; }
    .swap > .to .ch { display: inline-block; opacity: 0; transform: translateY(40%); filter: blur(8px); }
    html.story-live .swap > .to .ch { transition: opacity 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms), transform 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms), filter 700ms \${rise} calc(var(--wave, 0ms) + 140ms + var(--ci) * 16ms) !important; }
    [data-in] { opacity: 0; transform: translateY(10px) scale(0.98); }
  \`;
  steps.forEach((_, index) => {
    const k = index + 1;
    css += \`
      html.s\${k} .swap[data-at="\${k}"] > .from { opacity: 0; filter: blur(10px); transform: translateY(-14px); }
      html.s\${k} .swap[data-at="\${k}"] > .to { opacity: 1; }
      html.s\${k} .swap[data-at="\${k}"] > .to .ch { opacity: 1; transform: none; filter: none; }
      html.s\${k} [data-in="\${k}"] { opacity: 1; transform: none; }
      html.s\${k} [data-out="\${k}"] { opacity: 0; max-height: 0 !important; max-width: 0 !important; margin-top: 0 !important; margin-bottom: 0 !important; padding: 0 !important; border-width: 0 !important; }
    \`;
  });

  function letters(node) {
    let index = 0;
    const walk = (el) => {
      [...el.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
            const word = document.createElement("span");
            word.style.display = "inline-block";
            word.style.whiteSpace = "nowrap";
            [...part].forEach((char) => {
              const span = document.createElement("span");
              span.className = "ch";
              span.style.setProperty("--ci", index++);
              span.textContent = char;
              word.appendChild(span);
            });
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName.toLowerCase() !== "svg") {
          walk(child);
        }
      });
    };
    walk(node);
  }

  const conf = window.parent.__stage.conf;
  function layer() {
    return window.parent.document.getElementById("story-layer");
  }

  const box = (el) => el.getBoundingClientRect();
  const sx = (x) => conf.x + x * conf.scale;
  const sy = (y) => conf.y + y * conf.scale;
  function put(className, style, html) {
    const node = window.parent.document.createElement("div");
    node.className = className;
    Object.assign(node.style, style);
    if (html) node.innerHTML = html;
    layer().appendChild(node);
    return node;
  }
  const rect = (left, top, width, height) => ({ left: sx(left) + "px", top: sy(top) + "px", width: width * conf.scale + "px", height: height * conf.scale + "px" });

  function audit() {
    document.querySelectorAll("[data-slop]").forEach((el, index) => {
      const b = box(el);
      if (b.width < 4 || b.bottom < 0 || b.top > innerHeight) return;
      const pad = 8 / conf.scale;
      const wrap = put("s-fade", { ...rect(b.left - pad, b.top - pad, b.width + pad * 2, b.height + pad * 2), transitionDelay: index * 70 + "ms" });
      wrap.innerHTML = '<div class="s-box" style="position:absolute;inset:0"></div>' +
        [["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([x, y]) => '<span class="s-corner" style="position:absolute;' + x + ':-4px;' + y + ':-4px"></span>').join("") +
        '<span class="s-tag" style="position:absolute;left:0;top:-40px">' + el.dataset.slop + "</span>";
    });
  }

  function spacing() {
    const groups = new Map();
    document.querySelectorAll("[data-gap]").forEach((el) => {
      const key = el.dataset.gap || "main";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    const stageWidth = window.parent.innerWidth;
    const several = groups.size > 1;
    const pairs = [];
    groups.forEach((list) => {
      const items = list.filter((el) => box(el).height > 0 && box(el).top < innerHeight).sort((a, b) => box(a).top - box(b).top);
      for (let i = 1; i < items.length; i++) {
        if (box(items[i]).top - box(items[i - 1]).bottom <= 2) continue;
        pairs.push({ group: items, above: items[i - 1], below: items[i], nodes: {
          fill: put("s-fill s-x", {}), top: put("s-hair s-x", {}), bottom: put("s-hair s-x", {}),
          ruler: put("s-ink s-y", {}), capTop: put("s-ink s-x", {}), capBottom: put("s-ink s-x", {}),
          tag: put("s-tag s-fade", {}),
        } });
      }
    });
    return () => {
      for (const { group, above, below, nodes } of pairs) {
        const a = box(above);
        const b = box(below);
        const left = sx(Math.min(...group.map((el) => box(el).left)));
        const ruler = Math.max(14, left - 20);
        const top = sy(a.bottom);
        const size = Math.max(0, (b.top - a.bottom) * conf.scale);
        const value = Math.round(b.top - a.bottom);
        const right = several ? sx(Math.max(...group.map((el) => box(el).right))) + 24 : stageWidth;
        const start = several ? ruler - 8 : 0;
        const band = { left: start + "px", width: right - start + "px", transformOrigin: ruler - start + "px 50%" };
        Object.assign(nodes.fill.style, band, { top: top + "px", height: size + "px" });
        Object.assign(nodes.top.style, band, { top: top + "px", height: "1px" });
        Object.assign(nodes.bottom.style, band, { top: top + size - 1 + "px", height: "1px" });
        Object.assign(nodes.ruler.style, { left: ruler + "px", top: top + "px", width: "1.5px", height: size + "px", transformOrigin: "50% 0" });
        Object.assign(nodes.capTop.style, { left: ruler - 4 + "px", top: top + "px", width: "9px", height: "1.5px" });
        Object.assign(nodes.capBottom.style, { left: ruler - 4 + "px", top: top + size - 1.5 + "px", width: "9px", height: "1.5px" });
        const room = ruler - 10 > 64;
        Object.assign(nodes.tag.style, { left: (room ? ruler - 10 : ruler + 12) + "px", top: top + size / 2 - 15 + "px", translate: room ? "-100% 0" : "0 0" });
        const text = value + "px";
        if (nodes.tag.textContent !== text) nodes.tag.textContent = text;
        const hidden = value < 4 ? "0" : "";
        Object.values(nodes).forEach((node) => {
          if (node.style.visibility !== (hidden ? "hidden" : "")) node.style.visibility = hidden ? "hidden" : "";
        });
      }
    };
  }

  function details() {
    const items = [...document.querySelectorAll("[data-radius]")].filter((el) => box(el).bottom > 0 && box(el).top < innerHeight).map((el) => {
      const wrap = put("s-fade", {}, '<div class="s-box" style="position:absolute;inset:0"></div>');
      return { el, wrap, outline: wrap.firstChild, tag: put("s-tag s-fade", {}) };
    });
    return () => {
      for (const { el, wrap, outline, tag } of items) {
        const b = box(el);
        const radius = Math.round(Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, b.width / 2, b.height / 2));
        const pad = 5 / conf.scale;
        Object.assign(wrap.style, rect(b.left - pad, b.top - pad, b.width + pad * 2, b.height + pad * 2));
        outline.style.borderRadius = radius * conf.scale + 5 + "px";
        Object.assign(tag.style, { left: sx(b.left) + "px", top: sy(b.bottom) + 12 + "px" });
        const text = "r " + radius;
        if (tag.textContent !== text) tag.textContent = text;
      }
    };
  }

  const kinds = { audit, spacing, details };
  const managed = new WeakMap();
  let current = null;
  let stepping = false;

  window.__story = {
    install() {
      const style = document.createElement("style");
      style.id = "story-style";
      style.textContent = css;
      document.head.appendChild(style);
      document.querySelectorAll(".swap > .to").forEach(letters);
      document.querySelectorAll("[data-out]").forEach((el) => {
        const b = box(el);
        if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
        el.style.overflow = "hidden";
        el.style.maxHeight = Math.ceil(b.height) + "px";
        el.style.maxWidth = Math.ceil(b.width) + "px";
      });
      document.querySelectorAll("body *").forEach((el) => {
        const b = box(el);
        const wave = Math.round(Math.min(420, Math.max(0, b.top) / innerHeight * 320 + Math.max(0, b.left) / innerWidth * 100));
        el.style.setProperty("--wave", wave + "ms");
      });
      document.querySelectorAll("*").forEach((el) => {
        if (getComputedStyle(el).animationName !== "none") el.style.animationPlayState = "paused";
      });
      document.documentElement.offsetHeight;
      document.documentElement.classList.add("story-live");
      const follow = () => {
        if (current && !stepping) current();
        requestAnimationFrame(follow);
      };
      requestAnimationFrame(follow);
    },
    reset() {
      const root = document.documentElement;
      root.classList.remove("story-live", ...steps.map((_, index) => "s" + (index + 1)));
      layer().className = "";
      layer().innerHTML = "";
      current = null;
      root.offsetHeight;
      root.classList.add("story-live");
    },
    tick(ms) {
      stepping = true;
      for (const animation of [...document.getAnimations(), ...window.parent.document.getAnimations()]) {
        if (!managed.has(animation)) {
          if (animation.playState !== "running") continue;
          managed.set(animation, ms);
          animation.pause();
        }
        const time = ms - managed.get(animation);
        const end = animation.effect ? animation.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(end) && time >= end) animation.finish();
        else animation.currentTime = time;
      }
      if (current) current();
    },
    step(k) {
      document.documentElement.classList.add("s" + k);
    },
    show(kind) {
      const node = layer();
      node.className = "";
      node.innerHTML = "";
      const update = (kinds[kind] || (() => {}))();
      current = typeof update === "function" ? update : null;
      if (current) current();
      node.offsetHeight;
      node.classList.add("s-on");
    },
    settle() {
      layer().classList.add("s-on", "s-fixed");
    },
    clear() {
      layer().classList.remove("s-on");
    },
  };
})();
`;

mkdirSync(outDir);
let browser, server, workspace, encoder, failed;
let timedOut = false;
const controller = new AbortController();
const abort = (error) => {
  if (controller.signal.aborted) return;
  controller.abort(error);
  browser?.close().catch(() => {});
  encoder?.kill();
  server?.close();
};
const onSigint = () => abort(new Error("interrupted"));
const onSigterm = () => abort(new Error("terminated"));
process.once("SIGINT", onSigint);
process.once("SIGTERM", onSigterm);
const timer = setTimeout(() => { timedOut = true; abort(new Error("timeout")); }, timeoutMs);
try {
  checkFfmpeg();
  const { chromium } = await browserKit();
  const chrome = chromePath();
  workspace = createFrameWorkspace();
  const frames = workspace.path;
  server = createStoryServer(root, stage);
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ ...(chrome ? { executablePath: chrome } : {}), timeout: Math.min(30000, timeoutMs) });
  if (controller.signal.aborted) throw controller.signal.reason;
  const FRAME_COUNT_LIMIT = 900;
  const FPS = fps;
  const LENGTH = 10;
  let total = 0;
  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: outputScale });
  page.setDefaultTimeout(Math.min(30000, timeoutMs));
  page.setDefaultNavigationTimeout(Math.min(30000, timeoutMs));
  await page.goto(`${base}/__stage.html`, { waitUntil: "networkidle" });
  const frame = page.frames().find((item) => item !== page.mainFrame());
  await frame.waitForLoadState("networkidle");
  await frame.evaluate(async () => {
    const families = new Set();
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = [...sheet.cssRules];
      } catch {}
      const walk = (list) => list.forEach((rule) => {
        if (rule.cssRules) walk([...rule.cssRules]);
        const value = rule.style && rule.style.fontFamily;
        if (value) value.split(",").forEach((name) => families.add(name.trim().replace(/^["']|["']$/g, "")));
      });
      walk(rules);
    }
    await Promise.all([...families].flatMap((family) => [400, 500, 600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px "${family}"`).catch(() => null))));
    await document.fonts.ready;
  });
  await frame.addStyleTag({ content: `html { padding: ${padTop}px ${padRight}px 0 ${padLeft}px !important; }` });
  await frame.addScriptTag({ content: runtime });
  await frame.evaluate(() => window.__story.install());
  await page.waitForTimeout(300);

  const slop = await frame.evaluate(() => document.querySelectorAll("[data-slop]").length);
  const call = (name, value) => () => frame.evaluate(([name, value]) => window.__story[name](value), [name, value]);
  const plan = [];
  const at = (time, run) => plan.push({ time, run });
  let cursor = 0.5;
  if (slop) {
    at(cursor, call("show", "audit"));
    at(cursor + 0.9, call("clear"));
    cursor += 1.1;
  }
  const blocks = steps.map((name) => (kindOf(name) ? 1.75 : 1.25));
  const fit = Math.min(1, (LENGTH - cursor - 1.6) / blocks.reduce((sum, block) => sum + block, 0));
  steps.forEach((name, index) => {
    const kind = kindOf(name);
    if (kind) {
      at(cursor, call("show", kind));
      at(cursor + 0.35 * fit, call("step", index + 1));
      at(cursor + 1.35 * fit, call("settle"));
      at(cursor + 1.7 * fit, call("clear"));
    } else {
      at(cursor, call("step", index + 1));
    }
    cursor += blocks[index] * fit;
  });
  total = cursor + 1.6;
  plan.sort((a, b) => a.time - b.time);

  let next = 0;
  const frameCount = Math.round(total * FPS) + 1;
  if (frameCount > FRAME_COUNT_LIMIT) throw new Error("frame count exceeds 900");
  for (let index = 0; index < frameCount; index++) {
    if (controller.signal.aborted) throw controller.signal.reason;
    const now = index / FPS;
    while (next < plan.length && plan[next].time <= now + 1e-6) await plan[next++].run();
    await frame.evaluate((ms) => window.__story.tick(ms), now * 1000);
    await page.screenshot({ path: join(frames, "f-" + String(index).padStart(5, "0") + ".jpg"), type: "jpeg", quality: 92 });
  }
  await browser.close();
  browser = null;
  if (controller.signal.aborted) throw controller.signal.reason;
  await new Promise((done, reject) => {
    encoder = spawn("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(frames, "f-%05d.jpg"), "-vf", "scale=" + FRAME.width * outputScale + ":" + FRAME.height * outputScale + ":flags=lanczos", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", join(outDir, "story.mp4")], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    encoder.stderr.on("data", (chunk) => { errorText = (errorText + chunk).slice(-4000); });
    encoder.once("error", reject);
    encoder.once("close", (code) => code === 0 ? done() : reject(new Error("ffmpeg failed: " + errorText)));
  });
  if (controller.signal.aborted) throw controller.signal.reason;
  report(outDir, { status: "ok", input: file, output: "story.mp4", steps, fps, scale: outputScale, width: FRAME.width * outputScale, height: FRAME.height * outputScale, frames: frameCount, durationSeconds: total, warnings });
  console.log("saved " + join(outDir, "story.mp4"));
} catch (error) {
  failed = error;
  report(outDir, { status: "failed", error: String(error?.message ?? error), timedOut, warnings });
} finally {
  clearTimeout(timer);
  process.off("SIGINT", onSigint);
  process.off("SIGTERM", onSigterm);
  encoder?.kill();
  await browser?.close().catch(() => {});
  if (server?.listening) await new Promise((done) => server.close(done));
  workspace?.cleanup();
}
if (failed) throw failed;
}
main().catch((error) => { console.error(error?.message ?? String(error)); process.exitCode = 1; });
