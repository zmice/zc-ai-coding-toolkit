import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const platformNames = ["codex", "qwen", "claude", "opencode"];

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
  };
}

async function importWorkspaceModule(relativePath) {
  return import(pathToFileURL(join(root, relativePath)).href);
}

function bytesToKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function measure(content) {
  return {
    bytes: Buffer.byteLength(content),
    lines: content.split("\n").length,
  };
}

function classifyArtifact(path) {
  const normalized = path.replace(/\\/g, "/");

  if (
    normalized.endsWith("/AGENTS.md") ||
    normalized.endsWith("/CLAUDE.md") ||
    normalized.endsWith("/QWEN.md") ||
    normalized === "AGENTS.md" ||
    normalized === "CLAUDE.md" ||
    normalized === "QWEN.md"
  ) {
    return "entry";
  }

  if (normalized.includes("/commands/") || normalized.startsWith("commands/")) {
    return "commands";
  }

  if (normalized.includes("/skills/") || normalized.startsWith("skills/")) {
    return "skills";
  }

  if (normalized.includes("/agents/") || normalized.startsWith("agents/")) {
    return "agents";
  }

  if (
    normalized.endsWith("config.toml") ||
    normalized.endsWith("plugin.json") ||
    normalized.endsWith("qwen-extension.json") ||
    normalized.endsWith("marketplace.json")
  ) {
    return "metadata";
  }

  return "other";
}

function summarizeArtifacts(artifacts) {
  const buckets = {
    entry: { artifacts: 0, bytes: 0, lines: 0 },
    commands: { artifacts: 0, bytes: 0, lines: 0 },
    skills: { artifacts: 0, bytes: 0, lines: 0 },
    agents: { artifacts: 0, bytes: 0, lines: 0 },
    metadata: { artifacts: 0, bytes: 0, lines: 0 },
    other: { artifacts: 0, bytes: 0, lines: 0 },
  };

  for (const artifact of artifacts) {
    const bucket = buckets[classifyArtifact(artifact.path)];
    const size = measure(artifact.content);
    bucket.artifacts += 1;
    bucket.bytes += size.bytes;
    bucket.lines += size.lines;
  }

  return buckets;
}

function summarizePlan(platform, plan) {
  const artifacts = plan.artifacts.map((artifact) => {
    const size = measure(artifact.content);
    return {
      path: artifact.path,
      category: classifyArtifact(artifact.path),
      ...size,
    };
  });
  const totalBytes = artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
  const totalLines = artifacts.reduce((sum, artifact) => sum + artifact.lines, 0);

  return {
    platform,
    artifactCount: artifacts.length,
    matchedAssets: plan.matchedAssets.length,
    totalBytes,
    totalLines,
    byCategory: summarizeArtifacts(plan.artifacts),
    largestArtifacts: [...artifacts]
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 10),
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Content Context Budget Audit",
    "",
    `Workspace: \`${relative(process.cwd(), root) || "."}\``,
    "",
    "This is a read-only audit of generated platform artifacts. It measures the current default generation plans and helps decide whether content should be filtered by `tier`, `audience`, or platform exposure before installation.",
    "",
    "| Platform | Matched Assets | Artifacts | Total | Entry | Commands | Skills | Agents | Metadata |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const platform of result.platforms) {
    const buckets = platform.byCategory;
    lines.push(
      [
        `| ${platform.platform}`,
        platform.matchedAssets,
        platform.artifactCount,
        bytesToKiB(platform.totalBytes),
        bytesToKiB(buckets.entry.bytes),
        bytesToKiB(buckets.commands.bytes),
        bytesToKiB(buckets.skills.bytes),
        bytesToKiB(buckets.agents.bytes),
        bytesToKiB(buckets.metadata.bytes),
      ].join(" | ") + " |",
    );
  }

  lines.push("", "## Largest Artifacts", "");

  for (const platform of result.platforms) {
    lines.push(`### ${platform.platform}`, "");
    for (const artifact of platform.largestArtifacts.slice(0, 5)) {
      lines.push(
        `- \`${artifact.path}\` (${artifact.category}): ${bytesToKiB(artifact.bytes)}, ${artifact.lines} lines`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## Reading The Result",
    "",
    "- `entry` is the first file a platform loads, such as `AGENTS.md`, `CLAUDE.md`, or `QWEN.md`.",
    "- `skills` includes Codex command-alias skills and workflow skills, so it is usually the largest bucket.",
    "- If entry or skills budgets grow too quickly, prefer filtering default installs by `tier`, `audience`, and platform exposure rather than shortening source content blindly.",
  );

  return `${lines.join("\n")}\n`;
}

async function createPlan(platform, manifest) {
  const moduleMap = {
    codex: {
      path: "packages/platform-codex/dist/index.js",
      create: "createCodexGenerationPlan",
    },
    qwen: {
      path: "packages/platform-qwen/dist/index.js",
      create: "createQwenGenerationPlan",
    },
    claude: {
      path: "packages/platform-claude/dist/index.js",
      create: "createClaudeGenerationPlan",
    },
    opencode: {
      path: "packages/platform-opencode/dist/index.js",
      create: "createOpenCodeGenerationPlan",
    },
  }[platform];
  const platformModule = await importWorkspaceModule(moduleMap.path);

  return platformModule[moduleMap.create](manifest, {
    manifestSource: manifest.source,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  await importWorkspaceModule("apps/cli/scripts/ensure-internal-builds.mjs");
  const toolkit = await importWorkspaceModule("packages/toolkit/dist/index.js");
  const loadedManifest = await toolkit.loadToolkitManifest();
  const manifest = {
    source: loadedManifest.contentRoot,
    assets: loadedManifest.assets.map((asset) => ({
      id: asset.id,
      kind: asset.meta.kind,
      name: asset.meta.name,
      platforms: asset.meta.platforms ?? platformNames,
      title: asset.meta.title,
      summary: asset.meta.description,
      body: asset.body,
      tools: asset.meta.tools,
      requires: asset.meta.requires,
    })),
  };

  const platforms = [];

  for (const platform of platformNames) {
    platforms.push(summarizePlan(platform, await createPlan(platform, manifest)));
  }

  const result = {
    contentRoot: loadedManifest.contentRoot,
    platforms,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(renderMarkdown(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
