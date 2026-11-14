const replacement = "[REDACTED]";
const urlPattern = /\b[a-z][a-z\d+.-]*:\/\/[^\s"'<>`]+/gi;

function isSensitiveKey(key: string): boolean {
  let decoded = key;
  try { decoded = decodeURIComponent(key.replace(/\+/g, " ")); } catch { /* Use the original key. */ }
  return /(?:token|key|password|passwd|pwd|secret|signature|sig|auth|authorization|credential|credentials)$/.test(decoded.replace(/[^a-z\d]/gi, "").toLowerCase());
}

function sanitizeUrl(raw: string): string {
  const schemeEnd = raw.indexOf("://") + 3;
  const authorityEnd = raw.slice(schemeEnd).search(/[/?#]/);
  const boundary = authorityEnd < 0 ? raw.length : schemeEnd + authorityEnd;
  const authority = raw.slice(schemeEnd, boundary);
  const at = authority.lastIndexOf("@");
  let safe = raw.slice(0, schemeEnd) + (at >= 0 ? `${replacement}@${authority.slice(at + 1)}` : authority);
  let suffix = raw.slice(boundary);
  const fragment = suffix.indexOf("#");
  if (fragment >= 0) suffix = suffix.slice(0, fragment) + `#${replacement}`;
  const query = suffix.indexOf("?");
  if (query >= 0) {
    const fragmentAt = suffix.indexOf("#");
    const queryEnd = fragmentAt < 0 ? suffix.length : fragmentAt;
    const pairs = suffix.slice(query + 1, queryEnd).split(/([&;])/);
    for (let index = 0; index < pairs.length; index += 2) {
      const equals = pairs[index]!.indexOf("=");
      if (equals >= 0 && isSensitiveKey(pairs[index]!.slice(0, equals))) {
        pairs[index] = `${pairs[index]!.slice(0, equals + 1)}${replacement}`;
      }
    }
    suffix = suffix.slice(0, query + 1) + pairs.join("") + suffix.slice(queryEnd);
  }
  safe += suffix;
  return safe;
}

/** Redact credentials from user-visible command text and captured process output. */
export function sanitizeCommandText(value: string): string {
  const withUrls = value.replace(urlPattern, sanitizeUrl).replace(/\bBearer\s+[^\s"',;]+/gi, `Bearer ${replacement}`);
  const withFields = withUrls.replace(/\b((?:(?:api|access|refresh|client|private|secret|id)[_-]?)?(?:token|key|secret|password|passwd|pwd|signature|sig|auth|authorization|credential|credentials))(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&;,"'{}()[\]]+)/gi,
    (_match, key: string, separator: string) => `${key}${separator}${replacement}`);
  return withFields.replace(/"([^"\\]+)"(\s*:\s*)"(?:\\.|[^"\\])*"/g,
    (match, key: string, separator: string) => isSensitiveKey(key) ? `"${key}"${separator}"${replacement}"` : match);
}

export function sanitizeCommandArgs(args: readonly string[]): readonly string[] {
  return args.map(sanitizeCommandText);
}
