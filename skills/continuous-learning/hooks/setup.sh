#!/bin/bash
# continuous-learning/hooks/setup.sh
# 一键安装持续学习 hooks 到 Qoder / Qwen Code
#
# 用法:
#   bash setup.sh                    # 自动检测平台
#   bash setup.sh --platform qoder   # 指定平台
#   bash setup.sh --platform qwen-code
#   bash setup.sh --uninstall        # 卸载 hooks

set -euo pipefail

# ─── 颜色 ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }

# ─── 参数解析 ──────────────────────────────────────────
PLATFORM=""
UNINSTALL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --platform) PLATFORM="$2"; shift 2 ;;
    --uninstall) UNINSTALL=true; shift ;;
    *) err "未知参数: $1"; exit 1 ;;
  esac
done

# ─── 前置检查 ──────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  warn "jq 未安装。hooks 脚本需要 jq 解析 JSON。"
  echo "  macOS:   brew install jq"
  echo "  Linux:   apt install jq / yum install jq"
  echo "  Windows: scoop install jq / choco install jq"
  echo ""
fi

# ─── 平台检测 ──────────────────────────────────────────
detect_platform() {
  if [ -n "$PLATFORM" ]; then
    echo "$PLATFORM"
    return
  fi

  # 检测 Qoder
  if [ -d "${HOME}/.qoder" ]; then
    echo "qoder"
    return
  fi

  # 检测 Qwen Code
  if [ -d "${HOME}/.qwen-code" ] || [ -d "${HOME}/.config/qwen-code" ]; then
    echo "qwen-code"
    return
  fi

  # 默认 Qoder
  echo "qoder"
}

PLATFORM=$(detect_platform)
info "检测到平台: ${PLATFORM}"

# ─── 路径配置 ──────────────────────────────────────────
case "$PLATFORM" in
  qoder)
    SETTINGS_DIR="${HOME}/.qoder"
    SETTINGS_FILE="${SETTINGS_DIR}/settings.json"
    HOOKS_DIR="${HOME}/.qoder/hooks/continuous-learning"
    ;;
  qwen-code)
    SETTINGS_DIR="${HOME}/.qwen-code"
    SETTINGS_FILE="${SETTINGS_DIR}/settings.json"
    HOOKS_DIR="${HOME}/.qwen-code/hooks/continuous-learning"
    ;;
  *)
    err "不支持的平台: ${PLATFORM}"
    exit 1
    ;;
esac

# ─── 获取脚本所在目录 ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── 卸载模式 ──────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
  info "卸载持续学习 hooks..."

  if [ -f "$SETTINGS_FILE" ]; then
    # 从 settings.json 中移除 hooks 配置
    tmp_file=$(mktemp)
    jq '
      .hooks.PostToolUse |= (if type == "array" then [.[] | select(.hooks[0].command | test("continuous-learning") | not)] else . end) |
      .hooks.UserPromptSubmit |= (if type == "array" then [.[] | select(.hooks[0].command | test("continuous-learning") | not)] else . end) |
      .hooks.PostToolUseFailure |= (if type == "array" then [.[] | select(.hooks[0].command | test("continuous-learning") | not)] else . end) |
      .hooks.Stop |= (if type == "array" then [.[] | select(.hooks[0].command | test("continuous-learning") | not)] else . end) |
      if .hooks.PostToolUse == [] then del(.hooks.PostToolUse) else . end |
      if .hooks.UserPromptSubmit == [] then del(.hooks.UserPromptSubmit) else . end |
      if .hooks.PostToolUseFailure == [] then del(.hooks.PostToolUseFailure) else . end |
      if .hooks.Stop == [] then del(.hooks.Stop) else . end |
      if .hooks == {} then del(.hooks) else . end
    ' "$SETTINGS_FILE" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$SETTINGS_FILE"
    ok "已从 ${SETTINGS_FILE} 移除 hooks 配置"
  fi

  if [ -d "$HOOKS_DIR" ]; then
    rm -rf "$HOOKS_DIR"
    ok "已删除 hooks 脚本目录: ${HOOKS_DIR}"
  fi

  ok "卸载完成"
  exit 0
fi

# ─── 安装 hooks 脚本 ───────────────────────────────────
info "安装 hooks 脚本..."

mkdir -p "$HOOKS_DIR"
cp "${SCRIPT_DIR}/observe.sh" "${HOOKS_DIR}/observe.sh"
cp "${SCRIPT_DIR}/session-end.sh" "${HOOKS_DIR}/session-end.sh"
chmod +x "${HOOKS_DIR}/observe.sh"
chmod +x "${HOOKS_DIR}/session-end.sh"
ok "脚本已复制到 ${HOOKS_DIR}"

# ─── 创建 homunculus 目录结构 ──────────────────────────
HOMUNCULUS_DIR="${HOME}/.qoder/homunculus"
mkdir -p "${HOMUNCULUS_DIR}/instincts/personal"
mkdir -p "${HOMUNCULUS_DIR}/instincts/inherited"
mkdir -p "${HOMUNCULUS_DIR}/projects"
if [ ! -f "${HOMUNCULUS_DIR}/projects.json" ]; then
  echo '{}' > "${HOMUNCULUS_DIR}/projects.json"
fi
ok "目录结构已创建: ${HOMUNCULUS_DIR}"

# ─── 更新 settings.json ───────────────────────────────
info "更新 ${SETTINGS_FILE}..."

mkdir -p "$SETTINGS_DIR"

# 如果文件不存在，创建空 JSON
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# 构建 hooks 配置
OBSERVE_CMD="${HOOKS_DIR}/observe.sh"
SESSION_END_CMD="${HOOKS_DIR}/session-end.sh"

# 使用 jq 合并配置（保留已有配置）
tmp_file=$(mktemp)
jq --arg obs_cmd "$OBSERVE_CMD" --arg end_cmd "$SESSION_END_CMD" '
  # 确保 hooks 对象存在
  .hooks //= {} |

  # 添加 PostToolUse hook（如果不存在 continuous-learning 的）
  .hooks.PostToolUse //= [] |
  (if (.hooks.PostToolUse | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
    .hooks.PostToolUse += [{"matcher": "*", "hooks": [{"type": "command", "command": $obs_cmd}]}]
  else . end) |

  # 添加 UserPromptSubmit hook
  .hooks.UserPromptSubmit //= [] |
  (if (.hooks.UserPromptSubmit | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
    .hooks.UserPromptSubmit += [{"hooks": [{"type": "command", "command": $obs_cmd}]}]
  else . end) |

  # 添加 PostToolUseFailure hook
  .hooks.PostToolUseFailure //= [] |
  (if (.hooks.PostToolUseFailure | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
    .hooks.PostToolUseFailure += [{"matcher": "*", "hooks": [{"type": "command", "command": $obs_cmd}]}]
  else . end) |

  # 添加 Stop hook
  .hooks.Stop //= [] |
  (if (.hooks.Stop | map(select(.hooks[0].command | test("continuous-learning"))) | length) == 0 then
    .hooks.Stop += [{"hooks": [{"type": "command", "command": $end_cmd}]}]
  else . end)
' "$SETTINGS_FILE" > "$tmp_file" 2>/dev/null

if [ $? -eq 0 ]; then
  mv "$tmp_file" "$SETTINGS_FILE"
  ok "hooks 配置已写入 ${SETTINGS_FILE}"
else
  rm -f "$tmp_file"
  err "写入配置失败。请手动配置。"
  echo ""
  echo "在 ${SETTINGS_FILE} 中添加以下内容："
  cat <<MANUAL
{
  "hooks": {
    "PostToolUse": [{"matcher": "*", "hooks": [{"type": "command", "command": "${OBSERVE_CMD}"}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "${OBSERVE_CMD}"}]}],
    "PostToolUseFailure": [{"matcher": "*", "hooks": [{"type": "command", "command": "${OBSERVE_CMD}"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "${SESSION_END_CMD}"}]}]
  }
}
MANUAL
  exit 1
fi

# ─── 完成 ─────────────────────────────────────────────
echo ""
ok "持续学习 hooks 安装完成！"
echo ""
info "已配置的 hooks："
echo "  PostToolUse       → observe.sh（记录工具调用）"
echo "  UserPromptSubmit  → observe.sh（捕获用户纠正）"
echo "  PostToolUseFailure → observe.sh（记录工具失败）"
echo "  Stop              → session-end.sh（会话结束分析）"
echo ""
info "数据存储位置: ${HOMUNCULUS_DIR}"
echo ""
info "使用 /learn 命令手动触发模式提取"
info "使用 --uninstall 参数卸载 hooks"
echo ""
warn "修改配置后需要重启 IDE 才能生效"
