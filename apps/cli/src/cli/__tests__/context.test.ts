import { mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../index.js";

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  const logSpy = vi.spyOn(console, "log").mockImplementation((...parts: unknown[]) => {
    stdoutLines.push(parts.map(String).join(" "));
  });
  const errorSpy = vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
    stderrLines.push(parts.map(String).join(" "));
  });

  try {
    await createProgram().parseAsync(args, { from: "user" });
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  return {
    stdout: stdoutLines.join("\n"),
    stderr: stderrLines.join("\n"),
  };
}

async function createTempProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "zc-context-test-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "context-test",
      scripts: {
        test: "vitest run",
        build: "tsc",
      },
    }),
    "utf8",
  );
  await writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");
  return root;
}

describe("context CLI", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("prints a dry-run context init plan without writing files", async () => {
    const root = await createTempProject();

    const result = await runCli(["context", "init", "--dir", root, "--json"]);
    const payload = JSON.parse(result.stdout) as {
      dryRun: boolean;
      artifacts: Array<{ relativePath: string; action: string }>;
    };

    expect(result.stderr).toBe("");
    expect(payload.dryRun).toBe(true);
    expect(payload.artifacts.map((artifact) => artifact.relativePath)).toContain("AGENTS.md");
    expect(payload.artifacts.map((artifact) => artifact.relativePath)).toContain(".codex/context/project.md");
    await expect(readFile(join(root, ".codex/context/project.md"), "utf8")).rejects.toThrow();
  });

  it("writes managed project context files and preserves existing AGENTS.md content", async () => {
    const root = await createTempProject();
    await writeFile(join(root, "AGENTS.md"), "# Existing Rules\n\n- Keep me.\n", "utf8");

    const result = await runCli(["context", "init", "--dir", root, "--write", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      dryRun: boolean;
      summary: { creates: number; updates: number; conflicts: number };
    };

    expect(result.stderr).toBe("");
    expect(payload.dryRun).toBe(false);
    expect(payload.summary.conflicts).toBe(0);
    expect(payload.summary.creates).toBeGreaterThan(0);
    expect(payload.summary.updates).toBe(1);

    const agents = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("# Existing Rules");
    expect(agents).toContain("<!-- zc-context:init:start -->");
    expect(agents).toContain("`.codex/context/project.md`");

    const projectContext = await readFile(join(root, ".codex/context/project.md"), "utf8");
    expect(projectContext).toContain("<!-- zc-context:managed -->");
    expect(projectContext).toContain("context-test Project Context");

    const commandsContext = await readFile(join(root, ".codex/context/commands.md"), "utf8");
    expect(commandsContext).toContain("`pnpm test`: `vitest run`");
  });

  it("keeps a second run unchanged when context files are already current", async () => {
    const root = await createTempProject();

    await runCli(["context", "init", "--dir", root, "--write", "--json"]);
    const result = await runCli(["context", "init", "--dir", root, "--json"]);
    const payload = JSON.parse(result.stdout) as {
      summary: { creates: number; updates: number; unchanged: number; conflicts: number };
    };

    expect(result.stderr).toBe("");
    expect(payload.summary).toEqual({
      creates: 0,
      updates: 0,
      unchanged: 5,
      conflicts: 0,
    });
  });

  it("refreshes generatedAt only when detected context inputs change", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T00:00:00.000Z"));
    const root = await createTempProject();

    await runCli(["context", "init", "--dir", root, "--write", "--json"]);
    const firstManifest = JSON.parse(
      await readFile(join(root, ".codex/context/manifest.json"), "utf8"),
    ) as { initializedAt: string; generatedAt: string };

    vi.setSystemTime(new Date("2026-06-12T01:00:00.000Z"));
    const unchangedResult = await runCli(["context", "init", "--dir", root, "--json"]);
    const unchangedPayload = JSON.parse(unchangedResult.stdout) as {
      initializedAt: string;
      generatedAt: string;
      summary: { unchanged: number; updates: number };
    };

    await writeFile(
      join(root, "package.json"),
      JSON.stringify({
        name: "context-test",
        scripts: {
          test: "vitest run",
          build: "tsc",
          lint: "eslint .",
        },
      }),
      "utf8",
    );

    vi.setSystemTime(new Date("2026-06-12T02:00:00.000Z"));
    const refreshedResult = await runCli(["context", "init", "--dir", root, "--json"]);
    const refreshedPayload = JSON.parse(refreshedResult.stdout) as {
      initializedAt: string;
      generatedAt: string;
      summary: { updates: number };
      artifacts: Array<{ relativePath: string; content: string }>;
    };
    const commands = refreshedPayload.artifacts.find((artifact) => artifact.relativePath === ".codex/context/commands.md")?.content ?? "";

    expect(firstManifest).toMatchObject({
      initializedAt: "2026-06-12T00:00:00.000Z",
      generatedAt: "2026-06-12T00:00:00.000Z",
    });
    expect(unchangedPayload.initializedAt).toBe("2026-06-12T00:00:00.000Z");
    expect(unchangedPayload.generatedAt).toBe("2026-06-12T00:00:00.000Z");
    expect(unchangedPayload.summary).toMatchObject({ unchanged: 5, updates: 0 });
    expect(refreshedPayload.initializedAt).toBe("2026-06-12T00:00:00.000Z");
    expect(refreshedPayload.generatedAt).toBe("2026-06-12T02:00:00.000Z");
    expect(refreshedPayload.summary.updates).toBeGreaterThan(0);
    expect(commands).toContain("`pnpm lint`: `eslint .`");
    expect(commands).toContain("Last refreshed at 2026-06-12T02:00:00.000Z.");
  });

  it("resolves the nearest project root when invoked from a subdirectory", async () => {
    const root = await createTempProject();
    const nested = join(root, "src", "feature");
    await mkdir(nested, { recursive: true });
    const originalCwd = process.cwd();

    try {
      process.chdir(nested);
      const result = await runCli(["context", "init", "--json"]);
      const payload = JSON.parse(result.stdout) as { root: string };

      expect(payload.root).toBe(await realpath(root));
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("reports unmanaged context file conflicts without overwriting them", async () => {
    const root = await createTempProject();
    await mkdir(join(root, ".codex/context"), { recursive: true });
    await writeFile(join(root, ".codex/context/project.md"), "# Human notes\n", "utf8");

    const result = await runCli(["context", "init", "--dir", root, "--write", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      summary: { conflicts: number };
      artifacts: Array<{ relativePath: string; action: string }>;
    };

    expect(result.stderr).toContain("存在未受管的上下文文件冲突");
    expect(process.exitCode).toBe(1);
    expect(payload.summary.conflicts).toBe(1);
    expect(payload.artifacts.find((artifact) => artifact.relativePath === ".codex/context/project.md")?.action).toBe("conflict");
    await expect(readFile(join(root, ".codex/context/manifest.json"), "utf8")).rejects.toThrow();
  });
});
