import { cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(cliRoot, "..", "..");
const vendorRoot = join(cliRoot, "vendor");
const tmpRoot = join(workspaceRoot, ".tmp");

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
  ["packages/platform-claude/dist", "packages/platform-claude/dist"],
  ["packages/platform-claude/templates", "packages/platform-claude/templates"],
  ["packages/platform-claude/package.json", "packages/platform-claude/package.json"],
  ["packages/platform-opencode/dist", "packages/platform-opencode/dist"],
  ["packages/platform-opencode/templates", "packages/platform-opencode/templates"],
  ["packages/platform-opencode/package.json", "packages/platform-opencode/package.json"],
  ["packages/platform-core/dist", "node_modules/@zmice/platform-core/dist"],
  ["packages/platform-core/package.json", "node_modules/@zmice/platform-core/package.json"],
  ["packages/platform-core/dist", "../dist/node_modules/@zmice/platform-core/dist"],
  ["packages/platform-core/package.json", "../dist/node_modules/@zmice/platform-core/package.json"],
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
  const destination = join(activeVendorRoot, toRelativePath);

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

  for (const [fromRelativePath] of copyEntries) {
    await assertExists(fromRelativePath);
  }

  const tempVendorRoot = createTempVendorRoot();
  const backupVendorRoot = createBackupVendorRoot();
  activeVendorRoot = tempVendorRoot;

  await cleanupQuietly(tempVendorRoot);
  await cleanupQuietly(backupVendorRoot);
  await mkdir(tempVendorRoot, { recursive: true });

  for (const [fromRelativePath, toRelativePath] of copyEntries) {
    await copyEntry(fromRelativePath, toRelativePath);
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
