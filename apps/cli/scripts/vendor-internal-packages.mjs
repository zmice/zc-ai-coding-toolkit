import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(cliRoot, "..", "..");
const vendorRoot = join(cliRoot, "vendor");

const copyEntries = [
  ["packages/toolkit/dist", "packages/toolkit/dist"],
  ["packages/toolkit/src/content", "packages/toolkit/src/content"],
  ["packages/toolkit/templates", "packages/toolkit/templates"],
  ["packages/toolkit/package.json", "packages/toolkit/package.json"],
  ["packages/platform-qwen/dist", "packages/platform-qwen/dist"],
  ["packages/platform-qwen/templates", "packages/platform-qwen/templates"],
  ["packages/platform-qwen/package.json", "packages/platform-qwen/package.json"],
  ["packages/platform-codex/dist", "packages/platform-codex/dist"],
  ["packages/platform-codex/templates", "packages/platform-codex/templates"],
  ["packages/platform-codex/package.json", "packages/platform-codex/package.json"],
  ["packages/platform-qoder/dist", "packages/platform-qoder/dist"],
  ["packages/platform-qoder/templates", "packages/platform-qoder/templates"],
  ["packages/platform-qoder/package.json", "packages/platform-qoder/package.json"],
  ["packages/platform-core/dist", "node_modules/@zmice/platform-core/dist"],
  ["packages/platform-core/package.json", "node_modules/@zmice/platform-core/package.json"],
  ["references/upstreams.yaml", "references/upstreams.yaml"],
];

async function assertExists(relativePath) {
  const absolutePath = join(workspaceRoot, relativePath);

  try {
    await stat(absolutePath);
  } catch {
    throw new Error(
      `Missing build input: ${relativePath}. Build internal workspace packages before building apps/cli.`
    );
  }
}

async function copyEntry(fromRelativePath, toRelativePath) {
  const source = join(workspaceRoot, fromRelativePath);
  const destination = join(vendorRoot, toRelativePath);

  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

async function main() {
  await rm(vendorRoot, { recursive: true, force: true });
  await mkdir(vendorRoot, { recursive: true });

  for (const [fromRelativePath] of copyEntries) {
    await assertExists(fromRelativePath);
  }

  for (const [fromRelativePath, toRelativePath] of copyEntries) {
    await copyEntry(fromRelativePath, toRelativePath);
  }
}

await main();
