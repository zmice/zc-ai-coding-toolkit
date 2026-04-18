import { exec } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";

const execAsync = promisify(exec);

export interface PlatformInfo {
  os: "macos" | "linux" | "windows-wsl" | "windows-native" | "unknown";
  tmux: { available: boolean; version?: string };
  git: { available: boolean; version?: string };
  node: { version: string; meetsMinimum: boolean };
}

async function checkCommand(cmd: string): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(cmd);
    return { available: true, version: stdout.trim() };
  } catch {
    return { available: false };
  }
}

async function detectOS(): Promise<PlatformInfo["os"]> {
  const os = platform();
  if (os === "darwin") return "macos";
  if (os === "linux") {
    // Check if running in WSL
    try {
      const { stdout } = await execAsync("cat /proc/version");
      if (stdout.toLowerCase().includes("microsoft") || stdout.toLowerCase().includes("wsl")) {
        return "windows-wsl";
      }
    } catch { /* ignore */ }
    return "linux";
  }
  if (os === "win32") return "windows-native";
  return "unknown";
}

export async function detectPlatform(): Promise<PlatformInfo> {
  const os = await detectOS();
  const tmux = await checkCommand("tmux -V");
  const git = await checkCommand("git --version");

  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);

  return {
    os,
    tmux: { available: tmux.available, version: tmux.version },
    git: { available: git.available, version: git.version?.replace("git version ", "") },
    node: { version: nodeVersion, meetsMinimum: major >= 20 },
  };
}
