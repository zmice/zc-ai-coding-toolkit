// Adapted from heydamir/unslop (97daa3e), CC BY 4.0.
// Changes: bounded CLI, output report, warnings, and cleanup.
// Attribution and license: ../references/LICENSE-unslop.txt
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { browserKit, chromePath, intOption, reportUrl, reportMessage } from "./runtime.mjs";
const usage = "usage: node snapshot.mjs <url-or-local-file> <new-output-dir> [--width N --height N --dark|--light --timeout-ms N]; node snapshot.mjs --check";
function parseArgs(argv) {
  if(argv.length===1 && ["--help","--check"].includes(argv[0])) return {mode:argv[0]};
  const positional=[], options={width:1440,height:810,scheme:"no-preference",timeoutMs:60000};
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==="--dark" || arg==="--light") { if(options.scheme!=="no-preference") throw new Error("choose one color scheme"); options.scheme=arg.slice(2); continue; }
    const match=/^--(width|height|timeout-ms)(?:=(.*))?$/.exec(arg);
    if(match) { const raw=match[2]??argv[++i]; if(raw===undefined) throw new Error(arg+" needs a value"); const [min,max]={width:[320,3840],height:[240,2160],"timeout-ms":[1000,300000]}[match[1]]; options[{width:"width",height:"height","timeout-ms":"timeoutMs"}[match[1]]]=intOption(arg,raw,min,max); }
    else if(arg.startsWith("-")) throw new Error("unknown option: "+arg);
    else positional.push(arg);
  }
  if(positional.length!==2) throw new Error(usage);
  return {...options,input:positional[0],outDir:resolve(positional[1])};
}
function report(dir,data) { writeFileSync(join(dir,"report.json"),JSON.stringify(data,null,2)+"\n"); }
async function main() {
  const args=parseArgs(process.argv.slice(2));
  if(args.mode==="--help") { console.log(usage); return; }
  if(args.mode==="--check") { const kit=await browserKit(); if(!kit.chromium) throw new Error("Playwright Chromium API unavailable"); const chrome=chromePath() ?? kit.chromium.executablePath(); if(!chrome || !existsSync(chrome)) throw new Error("Chromium binary unavailable"); console.log(JSON.stringify({playwright:true,chromePath:chrome})); return; }
  const {input,outDir,width,height,scheme,timeoutMs}=args;
  if(existsSync(outDir)) throw new Error("output directory already exists");
  let target;
  if(/^https?:\/\//i.test(input)) target=new URL(input).href;
  else if(existsSync(input)) { const file=resolve(input); const stat=statSync(file); if(!stat.isFile()||stat.size>10_000_000) throw new Error("local file must be at most 10 MB"); target=pathToFileURL(file).href; }
  else if(/^[a-z][a-z0-9+.-]*:/i.test(input)) throw new Error("only HTTP(S) URLs and local files are supported");
  else throw new Error("local file not found");
  mkdirSync(outDir);
  const warnings=[];
  let browser,failed,timedOut=false;
  const controller=new AbortController();
  const abort=(reason)=>{if(controller.signal.aborted)return;controller.abort(reason);browser?.close().catch(()=>{});};
  const onSigint=()=>abort(new Error("interrupted")), onSigterm=()=>abort(new Error("terminated"));
  process.once("SIGINT",onSigint);process.once("SIGTERM",onSigterm);
  const timer=setTimeout(()=>{timedOut=true;abort(new Error("timeout"));},timeoutMs);
  try {
    const {chromium}=await browserKit(), chrome=chromePath();
    browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),timeout:Math.min(30000,timeoutMs)});
    if(controller.signal.aborted) throw controller.signal.reason;
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme });
  page.setDefaultTimeout(Math.min(30000,timeoutMs));
  page.setDefaultNavigationTimeout(Math.min(30000,timeoutMs));
  page.on("requestfailed",request=>warnings.push({code:"resource_failed",url:reportUrl(request.url())}));
  page.on("response",response=>{if(response.status()>=400) warnings.push({code:"http_error",status:response.status(),url:reportUrl(response.url())});});
  await page.goto(target, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const root = document.scrollingElement || document.documentElement;
    let last = root.scrollHeight;
    for (let step = 0; step < 30 && root.scrollTop < 20_000; step++) {
      window.scrollBy(0, window.innerHeight);
      await pause(150);
      const grown = root.scrollHeight;
      if (grown <= last && root.scrollTop + window.innerHeight >= grown) break;
      last = grown;
    }
    window.scrollTo(0, 0);
    const loaded = (image) =>
      new Promise((done) => {
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
      });
    const pending = [...document.images].filter((image) => !image.complete);
    await Promise.race([Promise.all(pending.map(loaded)), pause(5000)]);
  });
  const features = await page.evaluate(() => ({ canvas: document.querySelectorAll("canvas").length, shadowDom: [...document.querySelectorAll("*")].filter(el => el.shadowRoot).length, forms: document.querySelectorAll("input,textarea,select").length, redacted: document.querySelectorAll('input[type="password"],input[type="file"]').length, active: document.querySelectorAll("iframe,object,embed,form,[onclick],[onload]").length }));
  const html = await page.evaluate(async ([label, scheme]) => {
    const LIMIT = 3_000_000;
    const absolute = (value, base = location.href) => {
      try {
        return new URL(value, base).href;
      } catch {
        return value;
      }
    };
    const inlined = new Map();
    const inline = async (href) => {
      if (!href || href.startsWith("data:")) return href;
      if (!inlined.has(href)) {
        inlined.set(
          href,
          fetch(href)
            .then((response) => (response.ok ? response.blob() : null))
            .then((blob) =>
              blob && blob.size < LIMIT
                ? new Promise((done) => {
                    const reader = new FileReader();
                    reader.onload = () => done(reader.result);
                    reader.readAsDataURL(blob);
                  })
                : href,
            )
            .catch(() => href),
        );
      }
      return inlined.get(href);
    };
    const urls = async (css, base) => {
      const found = [...css.matchAll(/url\((['"]?)(?!data:)([^)'"]+)\1\)/g)];
      let result = css;
      for (const [whole, , value] of found) {
        if (/^(#|%23)/.test(value.trim())) continue;
        const data = await inline(absolute(value.trim(), base));
        result = result.split(whole).join(`url("${data}")`);
      }
      return result;
    };

    const css = [];
    for (const sheet of document.styleSheets) {
      const owner = sheet.ownerNode;
      let text = "";
      let base = location.href;
      if (sheet.href) {
        base = sheet.href;
        text = await fetch(sheet.href).then((response) => (response.ok ? response.text() : "")).catch(() => "");
      } else if (owner && owner.textContent.trim()) {
        text = owner.textContent;
      }
      if (!text) {
        try {
          text = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
        } catch {}
      }
      const media = sheet.media && sheet.media.mediaText;
      css.push(media && media !== "all" ? `@media ${media} {\n${text}\n}` : text);
      css[css.length - 1] = await urls(css[css.length - 1], base);
    }

    const copy = document.documentElement.cloneNode(true);
    const inputs = [...document.querySelectorAll("input")];
    copy.querySelectorAll("input").forEach((node,i) => { const source=inputs[i]; if (!source) return; if(source.type==="file" || source.type==="password") node.removeAttribute("value"); else node.setAttribute("value",source.value); if(source.checked) node.setAttribute("checked",""); else node.removeAttribute("checked"); });
    const areas=[...document.querySelectorAll("textarea")];
    copy.querySelectorAll("textarea").forEach((node,i) => { if(areas[i]) node.textContent=areas[i].value; });
    // Freeze the browser's selected image before removing responsive markup.
    const images = document.querySelectorAll("img");
    copy.querySelectorAll("img").forEach((node, index) => {
      const selected = images[index].currentSrc;
      if (selected) node.setAttribute("src", selected);
    });
    copy.querySelectorAll("script, noscript, link[rel='stylesheet'], link[rel='preload'], link[rel='modulepreload'], style").forEach((node) => node.remove());
    copy.querySelectorAll("[srcset]").forEach((node) => node.removeAttribute("srcset"));
    copy.querySelectorAll("source").forEach((node) => node.remove());
    copy.querySelectorAll("[loading]").forEach((node) => node.removeAttribute("loading"));
    for (const node of copy.querySelectorAll("img[src], video[poster], image")) {
      const attr = node.tagName === "VIDEO" ? "poster" : node.tagName.toLowerCase() === "image" ? "href" : "src";
      const value = node.getAttribute(attr);
      if (value) node.setAttribute(attr, await inline(absolute(value)));
    }
    copy.querySelectorAll("a[href]").forEach((node) => node.setAttribute("href", absolute(node.getAttribute("href"))));
    for (const node of copy.querySelectorAll("[style*='url(']")) {
      node.setAttribute("style", await urls(node.getAttribute("style"), location.href));
    }
    const style = document.createElement("style");
    let text = css.join("\n");
    if (scheme === "dark" || scheme === "light") {
      const other = scheme === "dark" ? "light" : "dark";
      text = text
        .replace(new RegExp(`prefers-color-scheme\\s*:\\s*${scheme}`, "g"), "min-width: 0px")
        .replace(new RegExp(`prefers-color-scheme\\s*:\\s*${other}`, "g"), "max-width: 0px");
      const meta = document.createElement("meta");
      meta.name = "color-scheme";
      meta.content = scheme;
      copy.querySelector("head").prepend(meta);
    }
    style.textContent = text;
    copy.querySelector("head").appendChild(style);
    if (label) {
      const meta = document.createElement("meta");
      meta.name = "unslop-pass";
      meta.content = label;
      copy.querySelector("head").prepend(meta);
    }
    return "<!doctype html>\n" + copy.outerHTML;
  }, ["", scheme]);
  if(controller.signal.aborted) throw controller.signal.reason;
  writeFileSync(join(outDir,"reference.html"),html);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:join(outDir,"source.png")});
  for(const [code,count] of Object.entries(features)) if(count) warnings.push({code,count});
  const external=[...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)/gi)].map(match=>match[1]);
  if(external.length) warnings.push({code:"external_reference",count:external.length,urls:[...new Set(external.map(reportUrl))].slice(0,30)});
  report(outDir,{status:"ok",input:reportUrl(target),output:["reference.html","source.png"],viewport:{width,height,scheme},warnings});
  console.log("saved "+outDir);
  } catch(error) { failed=error; report(outDir,{status:"failed",error:reportMessage(error?.message??error),timedOut,warnings}); }
  finally { clearTimeout(timer); process.off("SIGINT",onSigint);process.off("SIGTERM",onSigterm);await browser?.close().catch(()=>{}); }
  if(failed) throw failed;
}
main().catch(error=>{console.error(reportMessage(error?.message??error));process.exitCode=1;});
