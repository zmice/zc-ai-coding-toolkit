const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

export type LogLevel = keyof typeof LOG_LEVELS;

function getGlobalLevel(): LogLevel {
  const env = process.env["ZC_LOG_LEVEL"];
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return "info";
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  private log(level: LogLevel, msg: string): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[getGlobalLevel()]) return;
    const tag = level.toUpperCase().padEnd(5);
    process.stderr.write(`[${timestamp()}] [${tag}] [${this.name}] ${msg}\n`);
  }

  debug(msg: string): void { this.log("debug", msg); }
  info(msg: string): void { this.log("info", msg); }
  warn(msg: string): void { this.log("warn", msg); }
  error(msg: string): void { this.log("error", msg); }
}

/**
 * 创建一个带模块名的 Logger 实例
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}
