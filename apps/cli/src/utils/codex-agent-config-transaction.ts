import { readFile, rm, writeFile } from "node:fs/promises";

type Snapshot = { readonly path: string; readonly content: Buffer | null };

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function snapshot(path: string): Promise<Snapshot> {
  try {
    return { path, content: await readFile(path) };
  } catch (error) {
    if (isMissing(error)) return { path, content: null };
    throw error;
  }
}

async function restore(saved: Snapshot): Promise<void> {
  const current = await snapshot(saved.path);
  if (
    (saved.content === null && current.content === null)
    || (saved.content !== null && current.content !== null && current.content.equals(saved.content))
  ) {
    return;
  }
  if (saved.content === null) {
    await rm(saved.path, { force: true });
    try {
      await readFile(saved.path);
      throw new Error(`Rollback verification failed: ${saved.path} still exists.`);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return;
  }
  await writeFile(saved.path, saved.content);
  if (!(await readFile(saved.path)).equals(saved.content)) {
    throw new Error(`Rollback verification failed: ${saved.path} differs from its snapshot.`);
  }
}

// Covers ordinary write failures only. An interrupted process may require manual recovery.
export async function withCodexAgentConfigReceiptRollback<T>(
  configPaths: readonly string[],
  receiptPath: string,
  write: () => Promise<T>,
): Promise<T> {
  const paths = [...new Set([...configPaths, receiptPath])];
  const before = await Promise.all(paths.map(snapshot));
  try {
    return await write();
  } catch (writeError) {
    const restoreErrors: unknown[] = [];
    for (const saved of before) {
      try {
        await restore(saved);
      } catch (error) {
        restoreErrors.push(error);
      }
    }
    if (restoreErrors.length > 0) {
      const reason = writeError instanceof Error
        ? writeError.message.replace(/[\r\n\t]/g, " ").slice(0, 300)
        : "unknown write error";
      throw new AggregateError(
        [writeError, ...restoreErrors],
        `Codex agent sync failed (${reason}) and config/receipt rollback could not be verified: ${paths.join(", ")}`,
      );
    }
    throw writeError;
  }
}
