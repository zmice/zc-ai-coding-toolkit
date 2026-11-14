import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
type RoleReceipt = { readonly artifacts: readonly { readonly path: string; readonly sha256: string }[] };

function isCodexAgentFile(path: string): boolean {
  return /(?:^|[\\/])agents[\\/]zc-[^\\/]+\.toml$/iu.test(path);
}

function comparablePath(path: string): string {
  const absolute = resolve(path);
  return process.platform === "win32" ? absolute.toLowerCase() : absolute;
}

function isReceiptOwned(path: string, content: string, receipt: RoleReceipt | null): boolean {
  const owned = receipt?.artifacts.find(entry => comparablePath(entry.path) === comparablePath(path));
  const hash = createHash("sha256").update(content, "utf8").digest("hex");
  return owned?.sha256 === hash;
}

async function readExisting(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// A new generated model policy must not erase user-edited role settings.
export async function assertCodexAgentWritesOwned(
  artifacts: readonly { path: string; content: string }[],
  receipt: RoleReceipt | null,
): Promise<void> {
  for (const artifact of artifacts) {
    if (!isCodexAgentFile(artifact.path)) continue;
    const existing = await readExisting(artifact.path);
    if (existing === null) continue;
    if (!isReceiptOwned(artifact.path, existing, receipt)) {
      throw new Error(`保留用户自定义 agent 配置，未覆盖：${artifact.path}。文件与安装回执不符或没有归属回执；请先人工合并角色更新。`);
    }
  }
}

// Check the entire removal batch before the caller deletes any role file.
export async function assertCodexAgentDeletesOwned(
  paths: readonly string[],
  receipt: RoleReceipt | null,
): Promise<void> {
  for (const path of paths) {
    if (!isCodexAgentFile(path)) continue;
    const existing = await readExisting(path);
    if (existing === null) continue;
    if (!isReceiptOwned(path, existing, receipt)) {
      throw new Error(`保留用户自定义 agent 配置，未删除：${path}。文件与安装回执不符或没有归属回执；请先人工合并角色更新。`);
    }
  }
}
