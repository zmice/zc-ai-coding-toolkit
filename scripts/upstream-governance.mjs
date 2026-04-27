#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = resolve(root, "apps/cli/dist/cli/upstream.js");

if (!existsSync(modulePath)) {
  console.error("未找到 `apps/cli/dist/cli/upstream.js`。请先运行 `pnpm build`。");
  process.exit(1);
}

const { createUpstreamProgram } = await import(pathToFileURL(modulePath).href);

const argv = process.argv.filter((arg, index) => !(index === 2 && arg === "--"));

await createUpstreamProgram().parseAsync(argv);
