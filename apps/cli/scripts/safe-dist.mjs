import { lstatSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const same = (a, b) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
const inside = (root, candidate) => {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

/** Delete only a canonical package dist within the specified workspace. */
export function cleanPackageDist(workspaceRoot, packagePath) {
  if (!isAbsolute(workspaceRoot) || !/^(?:apps\/cli|packages\/(?:toolkit|platform-(?:core|qwen|codex|claude|opencode)))$/.test(packagePath)) {
    throw new Error("invalid managed build output");
  }
  const workspace = realpathSync(workspaceRoot);
  const packageRoot = resolve(workspaceRoot, packagePath);
  const canonicalPackage = realpathSync(packageRoot);
  if (!inside(workspace, canonicalPackage) || !same(canonicalPackage, resolve(workspace, packagePath))) {
    throw new Error(`package path redirected outside managed workspace: ${packagePath}`);
  }
  const target = join(packageRoot, "dist");
  let info;
  try { info = lstatSync(target); } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`build output is redirected: ${target}`);
  const canonicalTarget = realpathSync(target);
  if (!same(canonicalTarget, join(canonicalPackage, "dist")) || !inside(canonicalPackage, canonicalTarget)) {
    throw new Error(`build output escapes managed package: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}
