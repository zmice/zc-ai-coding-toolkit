#!/bin/bash
# continuous-learning/hooks/session-end.sh
# Stop hook — Agent 完成响应时触发
# 统计本次会话的观察数据，提醒 Agent 执行 /learn
#
# 协议：stdin JSON 输入 → stdout JSON 输出（additionalContext）
# 兼容：Qoder + Qwen Code

set -euo pipefail

# ─── 配置 ──────────────────────────────────────────────
HOMUNCULUS_DIR="${HOME}/.qoder/homunculus"
MIN_OBSERVATIONS=5

# ─── 读取 stdin ────────────────────────────────────────
input=$(cat)

# ─── 检查 jq 可用性 ───────────────────────────────────
if ! command -v jq &>/dev/null; then
  exit 0
fi

# ─── 提取字段 ──────────────────────────────────────────
session_id=$(echo "$input" | jq -r '.session_id // empty')
cwd=$(echo "$input" | jq -r '.cwd // empty')

# ─── 项目检测（复用 observe.sh 逻辑）─────────────────
project_id=""
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  remote_url=$(cd "$cwd" && git remote get-url origin 2>/dev/null || true)
  if [ -n "$remote_url" ]; then
    if command -v md5sum &>/dev/null; then
      project_id=$(echo -n "$remote_url" | md5sum | cut -c1-12)
    elif command -v md5 &>/dev/null; then
      project_id=$(echo -n "$remote_url" | md5 | cut -c1-12)
    fi
  fi
  if [ -z "$project_id" ]; then
    repo_root=$(cd "$cwd" && git rev-parse --show-toplevel 2>/dev/null || true)
    if [ -n "$repo_root" ]; then
      if command -v md5sum &>/dev/null; then
        project_id=$(echo -n "$repo_root" | md5sum | cut -c1-12)
      elif command -v md5 &>/dev/null; then
        project_id=$(echo -n "$repo_root" | md5 | cut -c1-12)
      fi
    fi
  fi
fi

# ─── 确定观察文件路径 ──────────────────────────────────
if [ -n "$project_id" ]; then
  obs_file="${HOMUNCULUS_DIR}/projects/${project_id}/observations.jsonl"
else
  obs_file="${HOMUNCULUS_DIR}/observations.jsonl"
fi

# ─── 统计本次会话的观察 ────────────────────────────────
if [ ! -f "$obs_file" ]; then
  exit 0
fi

# 统计本 session 的观察数
if [ -n "$session_id" ]; then
  session_obs_count=$(grep -c "\"session_id\":\"${session_id}\"" "$obs_file" 2>/dev/null || echo "0")
else
  session_obs_count=$(wc -l < "$obs_file" 2>/dev/null || echo "0")
fi

# 统计纠正次数
correction_count=0
if [ -n "$session_id" ]; then
  correction_count=$(grep "\"session_id\":\"${session_id}\"" "$obs_file" 2>/dev/null | grep -c '"is_correction":true' 2>/dev/null || echo "0")
fi

# 统计失败次数
failure_count=0
if [ -n "$session_id" ]; then
  failure_count=$(grep "\"session_id\":\"${session_id}\"" "$obs_file" 2>/dev/null | grep -c '"tool_outcome":"failure"' 2>/dev/null || echo "0")
fi

# ─── 决定是否提醒 ─────────────────────────────────────
if [ "$session_obs_count" -lt "$MIN_OBSERVATIONS" ] 2>/dev/null; then
  exit 0
fi

# ─── 构建提醒消息 ──────────────────────────────────────
hint=""
if [ "$correction_count" -gt 0 ] 2>/dev/null; then
  hint="本次会话检测到 ${correction_count} 次用户纠正和 ${session_obs_count} 条工具观察。建议运行 /learn 提取可复用模式。"
elif [ "$failure_count" -gt 2 ] 2>/dev/null; then
  hint="本次会话有 ${failure_count} 次工具失败和 ${session_obs_count} 条观察。建议运行 /learn 分析错误修复模式。"
elif [ "$session_obs_count" -gt 20 ] 2>/dev/null; then
  hint="本次会话积累了 ${session_obs_count} 条观察。建议运行 /learn 提取可复用模式。"
fi

if [ -n "$hint" ]; then
  # 输出 JSON，通过 additionalContext 注入对话
  jq -n --arg ctx "$hint" '{hookSpecificOutput: {additionalContext: $ctx}}'
fi

exit 0
