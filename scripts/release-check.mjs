import { spawnSync } from "node:child_process";
import {
  classifyDirtyPaths,
  loadPublishablePackages,
  parseCliArgs,
  parseGitStatus
} from "./release-check-lib.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: process.env,
    encoding: "utf8",
    stdio: options.captureOutput ? "pipe" : "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }

  return result;
}

function printPathList(title, paths) {
  console.log(title);
  if (paths.length === 0) {
    console.log("- 无");
    return;
  }

  for (const path of paths) {
    console.log(`- ${path}`);
  }
}

function checkGitState(root, mode) {
  const result = run("git", ["status", "--short", "--untracked-files=all"], {
    cwd: root,
    captureOutput: true
  });
  const dirtyPaths = parseGitStatus(result.stdout);
  const { allowedPaths, unexpectedPaths } = classifyDirtyPaths(dirtyPaths, mode);

  if (unexpectedPaths.length > 0) {
    throw new Error(
      [
        `发布预检查已阻止，模式：${mode}。`,
        `允许的脏文件 (Allowed dirty paths): ${allowedPaths.length}`,
        ...allowedPaths.map((path) => `- ${path}`),
        "未预期的脏文件 (Unexpected dirty paths):",
        ...unexpectedPaths.map((path) => `- ${path}`)
      ].join("\n")
    );
  }

  if (dirtyPaths.length === 0) {
    console.log("\n> git status 干净");
    return;
  }

  console.log(`\n> git status 摘要（${mode}）`);
  console.log(`- 允许: ${allowedPaths.length}`);
  console.log("- 未预期: 0");
  console.log("");
  printPathList("> 允许的脏文件 (Allowed dirty paths)", allowedPaths);
}

function printPackageMatrix(root) {
  const packages = loadPublishablePackages(root);
  console.log("\n> 可发布包矩阵 (Publishable packages)");
  for (const pkg of packages) {
    console.log(`- ${pkg.name}@${pkg.version} (${pkg.manifestPath})`);
  }
}

function main() {
  const { mode, root, skipCommands } = parseCliArgs(process.argv.slice(2));
  printPackageMatrix(root);

  if (!skipCommands) {
    console.log("\n> 运行 pnpm changeset status");
    run("pnpm", ["changeset", "status"], { cwd: root });
    console.log("\n> 运行 pnpm verify");
    run("pnpm", ["verify"], { cwd: root });
  } else {
    console.log("\n> 跳过命令执行");
  }

  checkGitState(root, mode);
  console.log(`\n发布预检查通过：${mode}。`);
}

main();
