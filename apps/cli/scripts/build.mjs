import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanPackageDist } from "./safe-dist.mjs";
import { buildReceiptPath, recordBuildReceipt, sourceSnapshot } from "../../../scripts/release-tarball.mjs";

const cliRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(cliRoot, "..", "..");
const before = sourceSnapshot(workspaceRoot);
rmSync(buildReceiptPath(workspaceRoot), { force: true });

await import("./ensure-internal-builds.mjs");
cleanPackageDist(workspaceRoot, "apps/cli");

for (const [command, args] of [
  [process.execPath, [resolve(cliRoot, "node_modules/typescript/bin/tsc"), "-p", resolve(cliRoot, "tsconfig.json")]],
  [process.execPath, [resolve(cliRoot, "scripts/vendor-internal-packages.mjs"), "--built"]]
]) {
  const result = spawnSync(command, args, { cwd: cliRoot, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`CLI build failed with exit code ${result.status ?? 1}`);
  }
}
recordBuildReceipt(workspaceRoot, before);
