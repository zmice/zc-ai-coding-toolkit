import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export class SessionManager {
  /**
   * 创建一个新的 tmux session
   * @returns session name
   */
  async createSession(name: string): Promise<string> {
    await execAsync(`tmux new-session -d -s ${this.sanitize(name)}`);
    return name;
  }

  /**
   * 在 session 中创建新的 window/pane 并执行命令
   * @returns pane identifier (session:window.pane)
   */
  async createPane(sessionName: string, command: string): Promise<string> {
    const safe = this.sanitize(sessionName);
    // Create a new window in the session
    const windowIndex = await this.getWindowCount(safe);
    await execAsync(`tmux new-window -t ${safe} -n worker-${windowIndex}`);
    const paneId = `${safe}:${windowIndex}`;
    if (command) {
      await this.sendKeys(paneId, command);
    }
    return paneId;
  }

  /**
   * 向指定 pane 发送按键/命令
   */
  async sendKeys(paneId: string, keys: string): Promise<void> {
    // Escape single quotes in keys
    const escaped = keys.replace(/'/g, "'\\''");
    await execAsync(`tmux send-keys -t '${paneId}' '${escaped}' Enter`);
  }

  /**
   * 捕获指定 pane 的当前输出
   */
  async captureOutput(paneId: string, lines = 100): Promise<string> {
    const { stdout } = await execAsync(
      `tmux capture-pane -t '${paneId}' -p -S -${lines}`
    );
    return stdout;
  }

  /**
   * 关闭指定 pane/window
   */
  async killPane(paneId: string): Promise<void> {
    try {
      await execAsync(`tmux kill-window -t '${paneId}'`);
    } catch {
      // pane may already be dead
    }
  }

  /**
   * 关闭整个 session
   */
  async killSession(sessionName: string): Promise<void> {
    try {
      await execAsync(`tmux kill-session -t ${this.sanitize(sessionName)}`);
    } catch {
      // session may already be dead
    }
  }

  /**
   * 列出所有活跃的 zc sessions
   */
  async listSessions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync("tmux list-sessions -F '#{session_name}'");
      return stdout
        .trim()
        .split("\n")
        .filter((s) => s.startsWith("zc-"));
    } catch {
      return [];
    }
  }

  /**
   * 检查 tmux 是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync("tmux -V");
      return true;
    } catch {
      return false;
    }
  }

  private async getWindowCount(sessionName: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `tmux list-windows -t ${sessionName} -F '#{window_index}'`
      );
      const windows = stdout.trim().split("\n").filter(Boolean);
      return windows.length;
    } catch {
      return 0;
    }
  }

  private sanitize(name: string): string {
    // tmux session names: alphanumeric, dash, underscore
    return name.replace(/[^a-zA-Z0-9_-]/g, "-");
  }
}
