import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(cliRoot, "..", "..");
const vendorRoot = join(cliRoot, "vendor");
const tmpRoot = join(cliRoot, ".vendor-tmp");
const cliDistRoot = join(cliRoot, "dist");

const copyEntries = [
  { from: "packages/toolkit/dist", to: "packages/toolkit/dist", root: "vendor" },
  { from: "packages/toolkit/src/content", to: "packages/toolkit/src/content", root: "vendor" },
  { from: "packages/toolkit/templates", to: "packages/toolkit/templates", root: "vendor" },
  { from: "packages/toolkit/package.json", to: "packages/toolkit/package.json", root: "vendor" },
  { from: "packages/platform-qwen/dist", to: "packages/platform-qwen/dist", root: "vendor" },
  { from: "packages/platform-qwen/templates", to: "packages/platform-qwen/templates", root: "vendor" },
  { from: "packages/platform-qwen/package.json", to: "packages/platform-qwen/package.json", root: "vendor" },
  { from: "packages/platform-codex/dist", to: "packages/platform-codex/dist", root: "vendor" },
  { from: "packages/platform-codex/templates", to: "packages/platform-codex/templates", root: "vendor" },
  { from: "packages/platform-codex/package.json", to: "packages/platform-codex/package.json", root: "vendor" },
  { from: "packages/platform-claude/dist", to: "packages/platform-claude/dist", root: "vendor" },
  { from: "packages/platform-claude/templates", to: "packages/platform-claude/templates", root: "vendor" },
  { from: "packages/platform-claude/package.json", to: "packages/platform-claude/package.json", root: "vendor" },
  { from: "packages/platform-opencode/dist", to: "packages/platform-opencode/dist", root: "vendor" },
  { from: "packages/platform-opencode/templates", to: "packages/platform-opencode/templates", root: "vendor" },
  { from: "packages/platform-opencode/package.json", to: "packages/platform-opencode/package.json", root: "vendor" },
  { from: "packages/platform-core/dist", to: "node_modules/@zmice/platform-core/dist", root: "vendor" },
  { from: "packages/platform-core/package.json", to: "node_modules/@zmice/platform-core/package.json", root: "vendor" },
  { from: "packages/platform-core/dist", to: "node_modules/@zmice/platform-core/dist", root: "cli-dist" },
  { from: "packages/platform-core/package.json", to: "node_modules/@zmice/platform-core/package.json", root: "cli-dist" },
  { from: "references/upstreams.yaml", to: "references/upstreams.yaml", root: "vendor" },
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

function resolveTargetRoot(rootKind) {
  if (rootKind === "cli-dist") {
    return cliDistRoot;
  }

  return activeVendorRoot;
}

async function copyEntry(entry) {
  const source = join(workspaceRoot, entry.from);
  const destination = join(resolveTargetRoot(entry.root), entry.to);

  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

let activeVendorRoot = vendorRoot;

function createTempVendorRoot() {
  return join(tmpRoot, `zc-vendor-${process.pid}-${Date.now()}`);
}

function createBackupVendorRoot() {
  return join(tmpRoot, `zc-vendor-backup-${process.pid}-${Date.now()}`);
}

async function cleanupQuietly(path) {
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures for temporary paths. A stale temp directory is safer than failing release builds.
  }
}

async function main() {
  await import("./ensure-internal-builds.mjs");
  await mkdir(tmpRoot, { recursive: true });

  for (const entry of copyEntries) {
    await assertExists(entry.from);
  }

  const tempVendorRoot = createTempVendorRoot();
  const backupVendorRoot = createBackupVendorRoot();
  activeVendorRoot = tempVendorRoot;

  await cleanupQuietly(tempVendorRoot);
  await cleanupQuietly(backupVendorRoot);
  await mkdir(tempVendorRoot, { recursive: true });

  for (const entry of copyEntries) {
    await copyEntry(entry);
  }

  try {
    await rename(vendorRoot, backupVendorRoot);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const code = String(error.code);
      if (code !== "ENOENT") {
        throw error;
      }
    } else {
      throw error;
    }
  }

  await rename(tempVendorRoot, vendorRoot);
  await cleanupQuietly(backupVendorRoot);
}

await main();
