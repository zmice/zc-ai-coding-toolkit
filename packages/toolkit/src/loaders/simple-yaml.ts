type ParsedScalar = string | number | boolean;

function parseScalar(rawValue: string): ParsedScalar {
  const value = rawValue.trim();

  if (value.startsWith("\"") && value.endsWith("\"")) {
    return value.slice(1, -1);
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseInlineList(rawValue: string): readonly ParsedScalar[] {
  const trimmed = rawValue.trim();

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error("Invalid YAML list syntax");
  }

  const inner = trimmed.slice(1, -1).trim();

  if (inner.length === 0) {
    return [];
  }

  return inner
    .split(",")
    .map((entry) => parseScalar(entry.trim()));
}

export function parseSimpleYaml(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let currentListKey: string | null = null;

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmedRight = rawLine.replace(/\s+$/, "");
    const trimmed = trimmedRight.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const indent = trimmedRight.length - trimmedRight.trimStart().length;

    if (indent === 0) {
      currentListKey = null;
      const separatorIndex = trimmed.indexOf(":");

      if (separatorIndex < 0) {
        throw new Error(`Invalid YAML on line ${lineNumber}: expected key/value pair`);
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (key.length === 0) {
        throw new Error(`Invalid YAML on line ${lineNumber}: empty key`);
      }

      if (rawValue.length === 0) {
        result[key] = [];
        currentListKey = key;
        continue;
      }

      if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
        result[key] = parseInlineList(rawValue);
        continue;
      }

      result[key] = parseScalar(rawValue);
      continue;
    }

    if (indent === 2 && currentListKey !== null && trimmed.startsWith("- ")) {
      const currentValue = result[currentListKey];

      if (!Array.isArray(currentValue)) {
        throw new Error(`Invalid YAML on line ${lineNumber}: expected list for ${currentListKey}`);
      }

      currentValue.push(parseScalar(trimmed.slice(2)));
      continue;
    }

    throw new Error(`Invalid YAML on line ${lineNumber}: unsupported indentation`);
  }

  return result;
}
