import crossSpawn from "cross-spawn";

/**
 * 启动外部 CLI，并在 Windows 上安全解析 npm 生成的 `.cmd` shim
 */
export const spawnCommand: typeof import("node:child_process").spawn = crossSpawn;
