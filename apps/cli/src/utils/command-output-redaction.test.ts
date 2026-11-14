import { describe, expect, it } from "vitest";
import { sanitizeCommandArgs, sanitizeCommandText } from "./command-output-redaction.js";

describe("command output redaction", () => {
  const secret = "SYNTHETIC_SECRET_42";

  it("redacts URL userinfo, sensitive query parameters and fragments", () => {
    const input = `git https://user:${secret}@example.test/repo?token=${secret}&mode=read&api_key=${secret}#${secret}`;
    const output = sanitizeCommandText(input);
    expect(output).not.toContain(secret);
    expect(output).toContain("mode=read");
    expect(output).toContain("[REDACTED]");
  });

  it("redacts credentials from args without mutating spawn arguments", () => {
    const args = ["plugin", "marketplace", "add", `https://user:${secret}@example.test/repo?signature=${secret}#${secret}`];
    const safe = sanitizeCommandArgs(args);
    expect(safe.join(" ")).not.toContain(secret);
    expect(args[3]).toContain(secret);
  });

  it("redacts standalone credential fields and authorization headers", () => {
    const output = sanitizeCommandText(`password=${secret} Authorization: Bearer ${secret} auth=${secret}`);
    expect(output).not.toContain(secret);
  });

  it("preserves JSON syntax when a URL contains a sensitive query", () => {
    const raw = JSON.stringify({ url: `https://example.test/x?X-Amz-Signature=${secret}`, token: secret, next: 1 });
    const safe = sanitizeCommandText(raw);
    expect(safe).not.toContain(secret);
    expect(JSON.parse(safe)).toMatchObject({ next: 1 });
  });
});
