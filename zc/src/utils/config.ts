import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ZcConfig {
  /** 默认 CLI 工具 (codex | qwen-code) */
  defaultCli: string;
  /** 默认模型 */
  model: string;
  /** Skills 目录路径 */
  skillsDir: string;
  /** 日志级别 */
  logLevel: "debug" | "info" | "warn" | "error";
}

const DEFAULT_CONFIG: ZcConfig = {
  defaultCli: "codex",
  model: "",
  skillsDir: "",
  logLevel: "info",
};

const ENV_MAP: Record<string, keyof ZcConfig> = {
  ZC_DEFAULT_CLI: "defaultCli",
  ZC_MODEL: "model",
  ZC_SKILLS_DIR: "skillsDir",
  ZC_LOG_LEVEL: "logLevel",
};

/**
 * 从 ~/.zc/config.json 加载配置，支持环境变量覆盖（ZC_ 前缀）。
 * 配置文件不存在时返回默认值，不会报错。
 */
export async function loadConfig(): Promise<ZcConfig> {
  const configPath = join(homedir(), ".zc", "config.json");

  let fileConfig: Partial<ZcConfig> = {};
  try {
    const raw = await readFile(configPath, "utf-8");
    fileConfig = JSON.parse(raw) as Partial<ZcConfig>;
  } catch {
    // config file doesn't exist or is invalid — use defaults
  }

  const merged: ZcConfig = { ...DEFAULT_CONFIG, ...fileConfig };

  // 环境变量覆盖
  for (const [envKey, configKey] of Object.entries(ENV_MAP)) {
    const val = process.env[envKey];
    if (val !== undefined && val !== "") {
      (merged as unknown as Record<string, string>)[configKey] = val;
    }
  }

  return merged;
}
