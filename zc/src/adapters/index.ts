import { registerAdapter, getAdapter, listAdapters } from "./types.js";
import { CodexAdapter } from "./codex.js";
import { QwenCodeAdapter } from "./qwen-code.js";

// Auto-register built-in adapters
registerAdapter(new CodexAdapter());
registerAdapter(new QwenCodeAdapter());

export { getAdapter, listAdapters };
export type { CLIAdapter, SpawnOptions, WorkerProcess } from "./types.js";
