// This is an explicit character-budget simulation, not Codex's tokenizer or catalog renderer.
export function auditSkillCatalog(artifacts, options = {}) {
  const { namespace = "", pathPrefix = "", descriptionChars = null,
    budgetChars = null, omitDescriptions = false } = options;
  for (const [key, value] of Object.entries({ descriptionChars, budgetChars })) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
      throw new Error(`${key} must be a non-negative integer`);
    }
  }
  let consumed = 0;
  let truncatedDescriptions = 0;
  const prefixes = new Map();
  const entries = artifacts.filter(({ path }) => /(?:^|\/)skills\/[^/]+\/SKILL\.md$/.test(path.replaceAll("\\", "/")))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
    .map(({ path, content }) => {
      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(content);
      if (!match) throw new Error(`Missing generated skill frontmatter: ${path}`);
      const field = (key) => {
        const raw = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(match[1])?.[1]?.trim();
        if (!raw) throw new Error(`Missing ${key} in ${path}`);
        // Platform generators emit JSON-quoted YAML scalars. Do not silently parse folded YAML.
        if (!raw.startsWith('"')) throw new Error(`Expected generated JSON scalar for ${key}: ${path}`);
        const value = JSON.parse(raw);
        if (typeof value !== "string") throw new Error(`Invalid ${key}: ${path}`);
        return value;
      };
      const name = [namespace, field("name")].filter(Boolean).join(":");
      const original = field("description");
      const description = omitDescriptions ? "" : descriptionChars === null
        ? original : Array.from(original).slice(0, descriptionChars).join("");
      if (!omitDescriptions && description !== original) truncatedDescriptions++;
      if (description) prefixes.set(description, [...(prefixes.get(description) ?? []), name]);
      const displayPath = [pathPrefix.replace(/[\\/]$/, ""), path.replaceAll("\\", "/")].filter(Boolean).join("/");
      const rendered = `- ${name}\n${description}\n${displayPath}\n`;
      const chars = Array.from(rendered).length;
      consumed += chars;
      return { name, path: displayPath, description, chars, bytes: Buffer.byteLength(rendered),
        bodyBytes: Buffer.byteLength(content.slice(match[0].length)),
        overBudget: budgetChars !== null && consumed > budgetChars };
    });
  return {
    measurement: "unicode-code-points-and-utf8-bytes; not tokens",
    scope: "generated-skill-metadata-only; excludes other installed plugins and host instructions",
    ordering: "path-sort simulation; actual host ordering and omissions not observed",
    descriptionMode: omitDescriptions ? "omitted" : descriptionChars === null ? "full" : "prefix",
    descriptionChars, budgetChars, chars: consumed,
    bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    exceedsBudget: budgetChars !== null && consumed > budgetChars,
    truncatedDescriptions,
    prefixCollisions: [...prefixes].filter(([, names]) => names.length > 1).map(([prefix, names]) => ({ prefix, names })),
    overBudgetEntries: entries.filter((entry) => entry.overBudget).map((entry) => entry.name),
    entries,
  };
}
