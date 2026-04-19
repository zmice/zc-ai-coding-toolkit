import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const targetRoot = resolve(root, "packages/toolkit/src/content");
const defaultPlatforms = ["qwen", "codex", "claude", "opencode"];

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function resetKindDirectory(kindDir) {
  if (existsSync(kindDir)) {
    rmSync(kindDir, { recursive: true, force: true });
  }
  ensureDir(kindDir);
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    return { meta: {}, body: source };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex < 0) {
    return { meta: {}, body: source };
  }

  const frontmatter = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5).replace(/^\n+/, "");
  const meta = {};
  let currentListKey = null;

  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.startsWith("- ") && currentListKey) {
      meta[currentListKey] ??= [];
      meta[currentListKey].push(trimmed.slice(2).trim());
      continue;
    }

    currentListKey = null;
    const separator = trimmed.indexOf(":");
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!value) {
      currentListKey = key;
      meta[key] = [];
      continue;
    }
    meta[key] = value;
  }

  return { meta, body };
}

function firstParagraph(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const collected = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if (line.startsWith("#") || line.startsWith("---")) {
      continue;
    }
    collected.push(line);
    if (collected.join(" ").length >= 160) {
      break;
    }
  }

  return collected.join(" ").trim();
}

function firstHeading(source) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("#")) {
      return line.replace(/^#+\s*/, "").trim();
    }
  }
  return "";
}

function yamlBlock(meta) {
  const lines = [
    `kind: ${meta.kind}`,
    `name: ${meta.name}`,
    `title: ${meta.title}`,
    `description: ${meta.description}`
  ];

  if (meta.tags?.length) {
    lines.push("tags:");
    for (const tag of meta.tags) {
      lines.push(`  - ${tag}`);
    }
  }

  if (meta.tools?.length) {
    lines.push("tools:");
    for (const tool of meta.tools) {
      lines.push(`  - ${tool}`);
    }
  }

  lines.push("platforms:");
  for (const platform of defaultPlatforms) {
    lines.push(`  - ${platform}`);
  }

  return `${lines.join("\n")}\n`;
}

function writeAssetUnit(kindDirectory, name, meta, body) {
  const unitDir = join(kindDirectory, name);
  ensureDir(join(unitDir, "assets"));
  writeFileSync(join(unitDir, "meta.yaml"), yamlBlock(meta), "utf8");
  writeFileSync(join(unitDir, "body.md"), body.trim() + "\n", "utf8");
  writeFileSync(join(unitDir, "assets/.gitkeep"), "", "utf8");
}

function importSkills() {
  const sourceDir = resolve(root, "skills");
  const targetDir = join(targetRoot, "skills");
  resetKindDirectory(targetDir);

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourceFile = join(sourceDir, entry.name, "SKILL.md");
    if (!existsSync(sourceFile)) {
      continue;
    }

    const source = readFileSync(sourceFile, "utf8");
    const { meta, body } = parseFrontmatter(source);

    writeAssetUnit(
      targetDir,
      entry.name,
      {
        kind: "skill",
        name: entry.name,
        title: meta.name || titleCase(entry.name),
        description:
          meta.description || firstParagraph(body) || `${titleCase(entry.name)} skill`,
        tags: []
      },
      body
    );
  }
}

function importCommands() {
  const sourceDir = resolve(root, "commands");
  const targetDir = join(targetRoot, "commands");
  resetKindDirectory(targetDir);

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") {
      continue;
    }

    const name = entry.name.replace(/\.md$/, "");
    const source = readFileSync(join(sourceDir, entry.name), "utf8");
    const { meta, body } = parseFrontmatter(source);
    writeAssetUnit(
      targetDir,
      name,
      {
        kind: "command",
        name,
        title: meta.name || firstHeading(body) || titleCase(name),
        description: meta.description || firstParagraph(body) || `${titleCase(name)} command`
      },
      body
    );
  }
}

function importAgents() {
  const sourceDir = resolve(root, "agents");
  const targetDir = join(targetRoot, "agents");
  resetKindDirectory(targetDir);

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || entry.name === "README.md") {
      continue;
    }

    const name = entry.name.replace(/\.md$/, "");
    const source = readFileSync(join(sourceDir, entry.name), "utf8");
    const { meta, body } = parseFrontmatter(source);
    writeAssetUnit(
      targetDir,
      name,
      {
        kind: "agent",
        name,
        title: meta.name || firstHeading(body) || titleCase(name),
        description: meta.description || firstParagraph(body) || `${titleCase(name)} agent`,
        tools: Array.isArray(meta.tools) ? meta.tools : []
      },
      body
    );
  }
}

function main() {
  ensureDir(targetRoot);
  importSkills();
  importCommands();
  importAgents();
  console.log(`Imported legacy root content into ${targetRoot}`);
}

main();
