import { spawnSync } from "node:child_process";
import { assertPublishReady, verifyReleaseReceipt, runNpm } from "./release-tarball.mjs";

const root = process.cwd();
const receipt = verifyReleaseReceipt(root);
assertPublishReady(root, receipt);
runNpm(root, ["publish", receipt.tarball, "--ignore-scripts", "--access", "public"]);
const tag = `${receipt.name}@${receipt.version}`;
const tagged = spawnSync("git", ["tag", tag, receipt.head], { cwd: root, stdio: "inherit", env: process.env });
if (tagged.status !== 0) {
  throw new Error(`npm published ${tag}, but local git tag creation failed; create or inspect this tag before pushing.`);
}
