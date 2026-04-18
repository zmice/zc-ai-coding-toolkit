import { spawnSync } from "node:child_process";
import {
  findUnexpectedDirtyPaths,
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

function checkGitState(root, mode) {
  const result = run("git", ["status", "--short", "--untracked-files=all"], {
    cwd: root,
    captureOutput: true
  });
  const dirtyPaths = parseGitStatus(result.stdout);
  const unexpectedPaths = findUnexpectedDirtyPaths(dirtyPaths, mode);

  if (unexpectedPaths.length > 0) {
    throw new Error(
      [
        `Release preflight blocked for mode "${mode}".`,
        "Unexpected dirty paths:",
        ...unexpectedPaths.map((path) => `- ${path}`)
      ].join("\n")
    );
  }

  if (dirtyPaths.length === 0) {
    console.log("\n> git status clean");
    return;
  }

  console.log(`\n> git status allowed for ${mode}`);
  for (const path of dirtyPaths) {
    console.log(`- ${path}`);
  }
}

function printPackageMatrix(root) {
  const packages = loadPublishablePackages(root);
  console.log("\n> publishable packages");
  for (const pkg of packages) {
    console.log(`- ${pkg.name}@${pkg.version} (${pkg.manifestPath})`);
  }
}

function main() {
  const { mode, root, skipCommands } = parseCliArgs(process.argv.slice(2));
  printPackageMatrix(root);

  if (!skipCommands) {
    console.log("\n> pnpm changeset status");
    run("pnpm", ["changeset", "status"], { cwd: root });
    console.log("\n> pnpm verify");
    run("pnpm", ["verify"], { cwd: root });
  } else {
    console.log("\n> skipping command execution");
  }

  checkGitState(root, mode);
  console.log(`\nRelease preflight passed for ${mode}.`);
}

main();
